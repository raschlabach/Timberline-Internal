import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are an order-parsing assistant for RNR Manufacturing, a wood products manufacturer. 
You will receive the raw text extracted from a customer purchase order (PDF or image).
Your job is to extract all order data into a structured JSON format.

Extract the following fields:
- customer_name: The company/customer placing the order
- po_number: The purchase order number
- order_date: The order date (YYYY-MM-DD format)
- due_date: The due/ship date if present (YYYY-MM-DD format, null if not found)
- is_rush: true if the order is marked as rush/expedite/urgent
- notes: Any special instructions or notes on the order
- items: Array of line items, each with:
  - part_number: The part number (customer's part number or item code)
  - description: Item description
  - quantity: Number ordered (integer)
  - price: Price per unit if shown (number, null if not found)
  - unit: Unit of measure - "BF" for board feet, "LF" for lineal feet, "PC" for pieces (default to "PC" if unclear)

Important rules:
- Extract ALL line items, don't skip any
- If a field is not found, use null
- For dates, convert to YYYY-MM-DD format
- For quantities, extract just the number
- For prices, extract just the number without $ signs
- If you see lumber species mentioned (like Oak, Maple, Poplar, Cherry, etc), note it in the description
- Return ONLY valid JSON, no markdown or explanation

Example output format:
{
  "customer_name": "ABC Furniture Co",
  "po_number": "PO-12345",
  "order_date": "2026-03-04",
  "due_date": "2026-03-18",
  "is_rush": false,
  "notes": "Ship via LTL freight",
  "items": [
    {
      "part_number": "ABC-001",
      "description": "3/4 x 3 x 36 Oak S4S",
      "quantity": 500,
      "price": 2.50,
      "unit": "PC"
    }
  ]
}`

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    let extractedText = ''

    if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer())
      // Use internal module path to avoid pdf-parse's test file loading issue on serverless
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const pdfData = await pdfParse(buffer)
      extractedText = pdfData.text
    } else if (file.type.startsWith('image/')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')

      const visionResponse = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Extract ALL text from this purchase order document. Include every line item, part number, quantity, price, date, and detail you can see. Return only the extracted text, nothing else.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${file.type};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 4000,
      })

      extractedText = visionResponse.choices[0]?.message?.content || ''
    } else {
      const textContent = await file.text()
      extractedText = textContent
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 })
    }

    const knownCustomers = await query(
      `SELECT id, customer_name FROM customers ORDER BY customer_name`
    )
    const customerList = knownCustomers.rows.map((c: { id: number; customer_name: string }) => c.customer_name).join(', ')

    const parseResponse = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here are the known customers in our system: ${customerList}\n\nPlease match the customer name to one of these if possible.\n\nHere is the order text to parse:\n\n${extractedText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    })

    const aiText = parseResponse.choices[0]?.message?.content || ''

    let parsed
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch {
      return NextResponse.json(
        { error: 'AI could not parse order format', raw_text: extractedText, ai_response: aiText },
        { status: 422 }
      )
    }

    let matchedCustomerId: number | null = null
    if (parsed.customer_name) {
      const match = knownCustomers.rows.find(
        (c: { id: number; customer_name: string }) =>
          c.customer_name.toLowerCase() === parsed.customer_name.toLowerCase()
      )
      if (match) {
        matchedCustomerId = match.id
      } else {
        const fuzzyMatch = knownCustomers.rows.find(
          (c: { id: number; customer_name: string }) =>
            c.customer_name.toLowerCase().includes(parsed.customer_name.toLowerCase()) ||
            parsed.customer_name.toLowerCase().includes(c.customer_name.toLowerCase())
        )
        if (fuzzyMatch) matchedCustomerId = fuzzyMatch.id
      }
    }

    const partNumbers = (parsed.items || [])
      .map((i: { part_number?: string }) => i.part_number)
      .filter(Boolean)

    let matchedParts: Record<string, { id: number; rnr_part_number: string | null; customer_part_number: string | null; description: string | null; price: number | null }> = {}

    if (partNumbers.length > 0) {
      const placeholders = partNumbers.map((_: string, idx: number) => `$${idx + 1}`).join(', ')
      const partsResult = await query(
        `SELECT id, rnr_part_number, customer_part_number, description, price
         FROM rnr_parts
         WHERE customer_part_number IN (${placeholders}) OR rnr_part_number IN (${placeholders})`,
        partNumbers
      )

      for (const p of partsResult.rows) {
        if (p.customer_part_number) matchedParts[p.customer_part_number] = p
        if (p.rnr_part_number) matchedParts[p.rnr_part_number] = p
      }
    }

    const enrichedItems = (parsed.items || []).map((item: { part_number?: string; description?: string; quantity?: number; price?: number; unit?: string }) => {
      const matched = item.part_number ? (matchedParts[item.part_number] || null) : null
      return {
        part_number: item.part_number || null,
        description: item.description || matched?.description || null,
        quantity: item.quantity || 0,
        price: item.price ?? matched?.price ?? null,
        unit: item.unit || 'PC',
        matched_part_id: matched?.id || null,
        matched_part_number: matched?.rnr_part_number || matched?.customer_part_number || null,
        is_new_part: !matched,
      }
    })

    return NextResponse.json({
      success: true,
      customer_name: parsed.customer_name || null,
      customer_id: matchedCustomerId,
      po_number: parsed.po_number || null,
      order_date: parsed.order_date || null,
      due_date: parsed.due_date || null,
      is_rush: parsed.is_rush || false,
      notes: parsed.notes || null,
      items: enrichedItems,
      raw_text: extractedText.substring(0, 2000),
    })
  } catch (error: unknown) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse order file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

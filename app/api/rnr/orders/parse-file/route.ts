import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are an order-parsing assistant for RNR Manufacturing, a wood products manufacturer.
You will receive text extracted from a customer purchase order (PDF, image, or text).
Your job is to extract all order data into a structured JSON format.

Extract the following fields:
- customer_name: The company/customer placing the order (the buyer, NOT RNR Enterprises which is the vendor/supplier)
- po_number: The purchase order number
- order_date: The order date (YYYY-MM-DD format). For 2-digit years like 2/25/26, assume 2000s (2026-02-25).
- due_date: The due/delivery/ship date if present (YYYY-MM-DD format, null if not found)
- is_rush: true if the order is marked as rush/expedite/urgent
- notes: Any special instructions, shipping notes, or processing notes on the order
- items: Array of line items, each with:
  - part_number: The part number, item code, or vendor item number as a STRING. CRITICAL: preserve the EXACT text as written including leading zeros, dashes, dots, asterisks, and special characters. "00450" MUST stay "00450", NOT "450". "NDCI*1002" stays "NDCI*1002". "200-12-1062X1150" stays exactly as-is.
  - description: Item description including dimensions, species, finish, and any processing details
  - quantity: Number ordered (integer). Parse comma-separated numbers: "5,040" becomes 5040
  - price: Price per unit if shown (number, null if not found). Do NOT include $ signs.
  - unit: Unit of measure - "BF" for board feet, "LF" for lineal feet, "PC" for pieces, "EA" for each. If the order says "lnft" or "lineal feet", use "LF". Default to "PC" if unclear.

CRITICAL rules:
- Part numbers are STRINGS, never numbers. Preserve them EXACTLY as written.
- Extract ALL line items, don't skip any
- If no part number column exists but items are described by dimensions (like "3/4 x 1 1/4 x 23 1/2"), construct a dimension key like "0.75x1.25x23.5" for the part_number field
- If a field is not found, use null
- For dates, convert to YYYY-MM-DD format. Handle 2-digit years (2/25/26 = 2026-02-25)
- For quantities, extract just the number (remove commas)
- For prices, extract just the number without $ signs
- If lumber species are mentioned (Oak, Maple, Poplar, Cherry, Walnut, etc), include them in the description
- If species applies to multiple items (e.g., "ALL LINES ABOVE ARE WHITE S.MAPLE"), add it to each relevant item's description
- Multi-line items: some orders spread one item across 2-3 lines. Combine them into a single item.
- The vendor/supplier (RNR Enterprises) is NOT the customer. The customer is the buyer.
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
      "part_number": "ABC-00100",
      "description": "3/4 x 3 x 36 Oak S4S",
      "quantity": 500,
      "price": 2.50,
      "unit": "PC"
    }
  ]
}`

async function extractTextFromFile(
  file: File,
  buffer: Buffer,
): Promise<string> {
  if (file.type === 'application/pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text?.trim() || ''
    if (text.length > 20) return text

    // Scanned/image PDF: fall back to OpenAI Responses API which handles PDFs natively
    const base64 = buffer.toString('base64')
    const response = await getOpenAI().responses.create({
      model: 'gpt-4o',
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: file.name || 'order.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
          {
            type: 'input_text',
            text: 'Extract ALL text from this purchase order document. Include every single line item, part number, quantity, price, date, and detail. Return only the extracted text, nothing else.',
          },
        ],
      }],
    })
    return response.output_text || ''
  }

  if (file.type.startsWith('image/')) {
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
            { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 4000,
    })
    return visionResponse.choices[0]?.message?.content || ''
  }

  return await file.text()
}

interface ParsedItem {
  part_number?: string
  description?: string
  quantity?: number
  price?: number
  unit?: string
}

interface MatchedPart {
  id: number
  rnr_part_number: string | null
  customer_part_number: string | null
  description: string | null
  price: number | null
  thickness: number | null
  width: number | null
  length: number | null
}

async function matchPartsByDimensions(
  items: ParsedItem[],
  matchedParts: Record<string, MatchedPart>,
): Promise<Record<string, MatchedPart>> {
  const dimensionItems = items.filter(i => {
    if (!i.part_number) return false
    if (matchedParts[i.part_number]) return false
    return /^\d+\.?\d*x\d+\.?\d*x\d+\.?\d*$/.test(i.part_number)
  })

  if (dimensionItems.length === 0) return matchedParts

  const updated = { ...matchedParts }
  for (const item of dimensionItems) {
    const dims = item.part_number!.split('x').map(Number)
    if (dims.length !== 3 || dims.some(isNaN)) continue
    const [thickness, width, length] = dims
    const tolerance = 0.05

    const result = await query(
      `SELECT id, rnr_part_number, customer_part_number, description, price, thickness, width, length
       FROM rnr_parts
       WHERE ABS(thickness - $1) < $4 AND ABS(width - $2) < $4 AND ABS(length - $3) < $4
       AND is_active = true
       LIMIT 1`,
      [thickness, width, length, tolerance],
    )
    if (result.rows.length > 0) {
      updated[item.part_number!] = result.rows[0]
    }
  }
  return updated
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.' },
        { status: 500 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const userHint = formData.get('user_hint') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extractedText = await extractTextFromFile(file, buffer)

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 })
    }

    const knownCustomers = await query(
      `SELECT id, customer_name FROM customers ORDER BY customer_name`,
    )
    const customerList = knownCustomers.rows
      .map((c: { id: number; customer_name: string }) => c.customer_name)
      .join(', ')

    // Quick customer identification from text to look up parse hints
    let customerHint = ''
    let preMatchedCustomerId: number | null = null
    for (const c of knownCustomers.rows as { id: number; customer_name: string }[]) {
      if (extractedText.toLowerCase().includes(c.customer_name.toLowerCase())) {
        preMatchedCustomerId = c.id
        break
      }
    }

    // Look up customer-specific parse hints
    if (preMatchedCustomerId) {
      try {
        const hintResult = await query(
          `SELECT hint_text FROM rnr_customer_parse_hints WHERE customer_id = $1`,
          [preMatchedCustomerId],
        )
        if (hintResult.rows.length > 0 && hintResult.rows[0].hint_text) {
          customerHint = hintResult.rows[0].hint_text
        }
      } catch {
        // Table may not exist yet; ignore
      }
    }

    let systemPrompt = SYSTEM_PROMPT
    if (customerHint) {
      systemPrompt += `\n\nCUSTOMER-SPECIFIC PARSING INSTRUCTIONS (follow these closely):\n${customerHint}`
    }
    if (userHint) {
      systemPrompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${userHint}`
    }

    const parseResponse = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here are the known customers in our system: ${customerList}\n\nPlease match the customer name to one of these if possible.\n\nHere is the order text to parse:\n\n${extractedText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    })

    const aiText = parseResponse.choices[0]?.message?.content || ''

    let parsed: {
      customer_name?: string
      po_number?: string
      order_date?: string
      due_date?: string
      is_rush?: boolean
      notes?: string
      items?: ParsedItem[]
    }
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
        { status: 422 },
      )
    }

    // Customer matching
    let matchedCustomerId: number | null = preMatchedCustomerId
    if (!matchedCustomerId && parsed.customer_name) {
      const match = knownCustomers.rows.find(
        (c: { id: number; customer_name: string }) =>
          c.customer_name.toLowerCase() === parsed.customer_name!.toLowerCase(),
      )
      if (match) {
        matchedCustomerId = match.id
      } else {
        const fuzzyMatch = knownCustomers.rows.find(
          (c: { id: number; customer_name: string }) =>
            c.customer_name.toLowerCase().includes(parsed.customer_name!.toLowerCase()) ||
            parsed.customer_name!.toLowerCase().includes(c.customer_name.toLowerCase()),
        )
        if (fuzzyMatch) matchedCustomerId = fuzzyMatch.id
      }
    }

    // Part matching by part number
    const partNumbers = (parsed.items || [])
      .map((i: ParsedItem) => i.part_number)
      .filter(Boolean) as string[]

    let matchedParts: Record<string, MatchedPart> = {}

    if (partNumbers.length > 0) {
      const placeholders = partNumbers.map((_: string, idx: number) => `$${idx + 1}`).join(', ')
      const partsResult = await query(
        `SELECT id, rnr_part_number, customer_part_number, description, price, thickness, width, length
         FROM rnr_parts
         WHERE customer_part_number IN (${placeholders}) OR rnr_part_number IN (${placeholders})`,
        partNumbers,
      )

      for (const p of partsResult.rows) {
        if (p.customer_part_number) matchedParts[p.customer_part_number] = p
        if (p.rnr_part_number) matchedParts[p.rnr_part_number] = p
      }
    }

    // Dimension-based part matching for items without part numbers
    matchedParts = await matchPartsByDimensions(parsed.items || [], matchedParts)

    const enrichedItems = (parsed.items || []).map((item: ParsedItem) => {
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
      { status: 500 },
    )
  }
}

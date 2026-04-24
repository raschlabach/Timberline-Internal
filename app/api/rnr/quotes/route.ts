import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let sql = `SELECT id, quote_number, status, customer_name, job_reference,
                      product_name_snapshot, species, grade, quantity, unit_type,
                      final_price, total_cost, margin_percent_applied,
                      created_at, updated_at
               FROM rnr_quotes`
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (status && status !== 'ALL') {
      conditions.push(`status = $${idx}`)
      values.push(status)
      idx++
    }

    if (search) {
      conditions.push(`(customer_name ILIKE $${idx} OR quote_number ILIKE $${idx})`)
      values.push(`%${search}%`)
      idx++
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, values)
    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}

function generateNextQuoteNumber(lastNumber: string | null): string {
  if (!lastNumber) return 'RNR-0001'
  const match = lastNumber.match(/RNR-(\d+)/)
  if (!match) return 'RNR-0001'
  const next = parseInt(match[1], 10) + 1
  return `RNR-${String(next).padStart(4, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const lastQuote = await client.query(
        `SELECT quote_number FROM rnr_quotes ORDER BY created_at DESC LIMIT 1`
      )
      const quoteNumber = generateNextQuoteNumber(
        lastQuote.rows.length > 0 ? lastQuote.rows[0].quote_number : null
      )

      const quoteResult = await client.query(
        `INSERT INTO rnr_quotes (
          quote_number, status, customer_name, job_reference,
          product_template_id, product_name_snapshot,
          species, grade, quantity, unit_type,
          width_inches, thickness_inches, length_inches,
          yield_percent_used, lumber_cost_per_bf, rough_bf_required, lumber_cost_total,
          tooling_surcharges, total_cost, margin_percent_applied, final_price,
          margin_1_snapshot, margin_2_snapshot, margin_3_snapshot, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25
        ) RETURNING *`,
        [
          quoteNumber,
          body.status || 'DRAFT',
          body.customer_name,
          body.job_reference || null,
          body.product_template_id || null,
          body.product_name_snapshot,
          body.species,
          body.grade,
          body.quantity,
          body.unit_type,
          body.width_inches || null,
          body.thickness_inches || null,
          body.length_inches || null,
          body.yield_percent_used,
          body.lumber_cost_per_bf,
          body.rough_bf_required,
          body.lumber_cost_total,
          JSON.stringify(body.tooling_surcharges || []),
          body.total_cost,
          body.margin_percent_applied,
          body.final_price,
          body.margin_1_snapshot || null,
          body.margin_2_snapshot || null,
          body.margin_3_snapshot || null,
          body.notes || null,
        ]
      )

      const quote = quoteResult.rows[0]

      if (body.machine_steps && body.machine_steps.length > 0) {
        for (const step of body.machine_steps) {
          await client.query(
            `INSERT INTO rnr_quote_machine_steps (
              quote_id, machine_name_snapshot, rate_per_hour_snapshot,
              setup_cost_snapshot, throughput_unit_snapshot, throughput_rate_snapshot,
              time_required_hours, machine_cost_total, step_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              quote.id,
              step.machine_name_snapshot,
              step.rate_per_hour_snapshot,
              step.setup_cost_snapshot,
              step.throughput_unit_snapshot,
              step.throughput_rate_snapshot,
              step.time_required_hours,
              step.machine_cost_total,
              step.step_order,
            ]
          )
        }
      }

      await client.query('COMMIT')

      return NextResponse.json(quote, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error creating quote:', error)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}

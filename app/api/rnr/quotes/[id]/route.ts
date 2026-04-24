import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quoteResult = await query(
      `SELECT * FROM rnr_quotes WHERE id = $1`,
      [params.id]
    )

    if (quoteResult.rows.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const stepsResult = await query(
      `SELECT * FROM rnr_quote_machine_steps WHERE quote_id = $1 ORDER BY step_order`,
      [params.id]
    )

    return NextResponse.json({
      ...quoteResult.rows[0],
      machine_steps: stepsResult.rows,
    })
  } catch (error: unknown) {
    console.error('Error fetching quote:', error)
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (body.status !== undefined) {
      const result = await query(
        `UPDATE rnr_quotes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [body.status, params.id]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }

      const steps = await query(
        `SELECT * FROM rnr_quote_machine_steps WHERE quote_id = $1 ORDER BY step_order`,
        [params.id]
      )

      return NextResponse.json({ ...result.rows[0], machine_steps: steps.rows })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const quoteResult = await client.query(
        `UPDATE rnr_quotes SET
          customer_name = $1, job_reference = $2,
          product_template_id = $3, product_name_snapshot = $4,
          species = $5, grade = $6, quantity = $7, unit_type = $8,
          width_inches = $9, thickness_inches = $10, length_inches = $11,
          yield_percent_used = $12, lumber_cost_per_bf = $13,
          rough_bf_required = $14, lumber_cost_total = $15,
          tooling_surcharges = $16, total_cost = $17,
          margin_percent_applied = $18, final_price = $19,
          margin_1_snapshot = $20, margin_2_snapshot = $21, margin_3_snapshot = $22,
          notes = $23, status = $24, updated_at = NOW()
        WHERE id = $25 RETURNING *`,
        [
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
          body.status || 'DRAFT',
          params.id,
        ]
      )

      if (quoteResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }

      await client.query(
        `DELETE FROM rnr_quote_machine_steps WHERE quote_id = $1`,
        [params.id]
      )

      if (body.machine_steps && body.machine_steps.length > 0) {
        for (const step of body.machine_steps) {
          await client.query(
            `INSERT INTO rnr_quote_machine_steps (
              quote_id, machine_name_snapshot, rate_per_hour_snapshot,
              setup_cost_snapshot, throughput_unit_snapshot, throughput_rate_snapshot,
              time_required_hours, machine_cost_total, step_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              params.id,
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

      const steps = await query(
        `SELECT * FROM rnr_quote_machine_steps WHERE quote_id = $1 ORDER BY step_order`,
        [params.id]
      )

      return NextResponse.json({ ...quoteResult.rows[0], machine_steps: steps.rows })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error updating quote:', error)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

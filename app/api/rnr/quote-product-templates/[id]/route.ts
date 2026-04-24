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

    const result = await query(
      `SELECT pt.id, pt.name, pt.active, pt.created_at, pt.updated_at,
              COALESCE(json_agg(
                json_build_object(
                  'id', pms.id,
                  'machine_id', pms.machine_id,
                  'machine_name', m.name,
                  'step_order', pms.step_order,
                  'throughput_override', pms.throughput_override,
                  'throughput_unit', m.throughput_unit,
                  'throughput_rate', m.throughput_rate,
                  'rate_per_hour', m.rate_per_hour,
                  'setup_cost', m.setup_cost
                ) ORDER BY pms.step_order
              ) FILTER (WHERE pms.id IS NOT NULL), '[]') AS steps
       FROM rnr_product_templates pt
       LEFT JOIN rnr_product_machine_steps pms ON pms.product_template_id = pt.id
       LEFT JOIN rnr_machines m ON m.id = pms.machine_id
       WHERE pt.id = $1
       GROUP BY pt.id`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product template not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    console.error('Error fetching product template:', error)
    return NextResponse.json({ error: 'Failed to fetch product template' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, active, steps } = await request.json()

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const updates: string[] = []
      const values: unknown[] = []
      let idx = 1

      if (name !== undefined) {
        updates.push(`name = $${idx}`)
        values.push(name)
        idx++
      }
      if (active !== undefined) {
        updates.push(`active = $${idx}`)
        values.push(active)
        idx++
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        values.push(params.id)
        await client.query(
          `UPDATE rnr_product_templates SET ${updates.join(', ')} WHERE id = $${idx}`,
          values
        )
      }

      if (steps !== undefined) {
        await client.query(
          `DELETE FROM rnr_product_machine_steps WHERE product_template_id = $1`,
          [params.id]
        )

        for (const step of steps) {
          await client.query(
            `INSERT INTO rnr_product_machine_steps (product_template_id, machine_id, step_order, throughput_override)
             VALUES ($1, $2, $3, $4)`,
            [params.id, step.machine_id, step.step_order, step.throughput_override || null]
          )
        }
      }

      await client.query('COMMIT')

      const fullTemplate = await query(
        `SELECT pt.id, pt.name, pt.active, pt.created_at, pt.updated_at,
                COALESCE(json_agg(
                  json_build_object(
                    'id', pms.id,
                    'machine_id', pms.machine_id,
                    'machine_name', m.name,
                    'step_order', pms.step_order,
                    'throughput_override', pms.throughput_override,
                    'throughput_unit', m.throughput_unit,
                    'throughput_rate', m.throughput_rate,
                    'rate_per_hour', m.rate_per_hour,
                    'setup_cost', m.setup_cost
                  ) ORDER BY pms.step_order
                ) FILTER (WHERE pms.id IS NOT NULL), '[]') AS steps
         FROM rnr_product_templates pt
         LEFT JOIN rnr_product_machine_steps pms ON pms.product_template_id = pt.id
         LEFT JOIN rnr_machines m ON m.id = pms.machine_id
         WHERE pt.id = $1
         GROUP BY pt.id`,
        [params.id]
      )

      return NextResponse.json(fullTemplate.rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error updating product template:', error)
    return NextResponse.json({ error: 'Failed to update product template' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      `DELETE FROM rnr_product_templates WHERE id = $1 RETURNING id`,
      [params.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting product template:', error)
    return NextResponse.json({ error: 'Failed to delete product template' }, { status: 500 })
  }
}

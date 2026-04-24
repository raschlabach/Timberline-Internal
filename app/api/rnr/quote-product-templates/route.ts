import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await query(
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
       GROUP BY pt.id
       ORDER BY pt.active DESC, pt.name ASC`
    )

    return NextResponse.json(templates.rows)
  } catch (error: unknown) {
    console.error('Error fetching product templates:', error)
    return NextResponse.json({ error: 'Failed to fetch product templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, steps } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const templateResult = await client.query(
        `INSERT INTO rnr_product_templates (name) VALUES ($1) RETURNING *`,
        [name]
      )
      const template = templateResult.rows[0]

      if (steps && steps.length > 0) {
        for (const step of steps) {
          await client.query(
            `INSERT INTO rnr_product_machine_steps (product_template_id, machine_id, step_order, throughput_override)
             VALUES ($1, $2, $3, $4)`,
            [template.id, step.machine_id, step.step_order, step.throughput_override || null]
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
        [template.id]
      )

      return NextResponse.json(fullTemplate.rows[0], { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error creating product template:', error)
    return NextResponse.json({ error: 'Failed to create product template' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')

    let result
    if (supplierId) {
      result = await query(
        `SELECT lsp.*, ls.name as supplier_name
         FROM lumber_supplier_plants lsp
         JOIN lumber_suppliers ls ON lsp.supplier_id = ls.id
         WHERE lsp.supplier_id = $1
         ORDER BY lsp.plant_name`,
        [supplierId]
      )
    } else {
      result = await query(
        `SELECT lsp.*, ls.name as supplier_name
         FROM lumber_supplier_plants lsp
         JOIN lumber_suppliers ls ON lsp.supplier_id = ls.id
         ORDER BY ls.name, lsp.plant_name`
      )
    }

    return NextResponse.json({ success: true, plants: result.rows })
  } catch (error) {
    console.error('Error fetching supplier plants:', error)
    return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId, plantName } = body as { supplierId: number; plantName: string }

    if (!supplierId || !plantName?.trim()) {
      return NextResponse.json({ error: 'Supplier ID and plant name are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO lumber_supplier_plants (supplier_id, plant_name)
       VALUES ($1, $2)
       ON CONFLICT (supplier_id, plant_name) DO NOTHING
       RETURNING *`,
      [supplierId, plantName.trim()]
    )

    if (result.rows.length === 0) {
      const existing = await query(
        `SELECT * FROM lumber_supplier_plants WHERE supplier_id = $1 AND plant_name = $2`,
        [supplierId, plantName.trim()]
      )
      return NextResponse.json({ success: true, plant: existing.rows[0], existed: true })
    }

    return NextResponse.json({ success: true, plant: result.rows[0] })
  } catch (error) {
    console.error('Error creating supplier plant:', error)
    return NextResponse.json({ error: 'Failed to create plant' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { plantId, plantName } = body as { plantId: number; plantName: string }

    if (!plantId || !plantName?.trim()) {
      return NextResponse.json({ error: 'Plant ID and name are required' }, { status: 400 })
    }

    const result = await query(
      `UPDATE lumber_supplier_plants SET plant_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [plantName.trim(), plantId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    await query(
      `UPDATE lumber_loads SET plant = $1 WHERE plant_id = $2`,
      [plantName.trim(), plantId]
    )

    return NextResponse.json({ success: true, plant: result.rows[0] })
  } catch (error) {
    console.error('Error updating supplier plant:', error)
    return NextResponse.json({ error: 'Failed to update plant' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plantId')
    const mergeIntoId = searchParams.get('mergeIntoId')

    if (!plantId) {
      return NextResponse.json({ error: 'Plant ID is required' }, { status: 400 })
    }

    const usageCheck = await query(
      `SELECT COUNT(*) as count FROM lumber_loads WHERE plant_id = $1`,
      [plantId]
    )
    const loadCount = parseInt(usageCheck.rows[0].count)

    if (loadCount > 0 && !mergeIntoId) {
      return NextResponse.json(
        { error: `This plant is used by ${loadCount} load(s). Choose a plant to merge into.`, loadCount },
        { status: 409 }
      )
    }

    if (loadCount > 0 && mergeIntoId) {
      const targetPlant = await query(
        `SELECT id, plant_name FROM lumber_supplier_plants WHERE id = $1`,
        [mergeIntoId]
      )
      if (targetPlant.rows.length === 0) {
        return NextResponse.json({ error: 'Target plant not found' }, { status: 400 })
      }

      await query(
        `UPDATE lumber_loads SET plant_id = $1, plant = $2 WHERE plant_id = $3`,
        [mergeIntoId, targetPlant.rows[0].plant_name, plantId]
      )
    }

    await query(`DELETE FROM rnr_supplier_customer_map WHERE plant_id = $1`, [plantId])
    await query(`DELETE FROM lumber_supplier_plants WHERE id = $1`, [plantId])

    return NextResponse.json({ success: true, merged: loadCount > 0 ? loadCount : 0 })
  } catch (error) {
    console.error('Error deleting supplier plant:', error)
    return NextResponse.json({ error: 'Failed to delete plant' }, { status: 500 })
  }
}

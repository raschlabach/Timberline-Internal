import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/debug/[loadId] - Show all flags and data for debugging
export async function GET(
  request: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loadId = params.loadId

    // Get complete load details with all flags
    const result = await query(
      `SELECT 
        l.*,
        s.name as supplier_name,
        COUNT(DISTINCT li.id) as item_count,
        COUNT(DISTINCT p.id) as pack_count,
        COUNT(DISTINCT CASE WHEN p.is_finished = TRUE THEN p.id END) as finished_pack_count
      FROM lumber_loads l
      LEFT JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_load_items li ON li.load_id = l.id
      LEFT JOIN lumber_packs p ON p.load_item_id = li.id
      WHERE l.load_id = $1
      GROUP BY l.id, s.name`,
      [loadId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 })
    }

    const load = result.rows[0]

    // Get items with actual footage
    const items = await query(
      `SELECT * FROM lumber_load_items WHERE load_id = $1`,
      [load.id]
    )

    // Determine why it's not showing in different pages
    const visibility = {
      tally_entry: {
        should_show: 
          items.rows.some((i: any) => i.actual_footage !== null) &&
          !load.all_packs_tallied &&
          !load.all_packs_finished,
        reasons: [] as string[]
      },
      rip_entry: {
        should_show:
          load.all_packs_tallied &&
          !load.all_packs_finished,
        reasons: [] as string[]
      },
      inventory: {
        should_show:
          items.rows.some((i: any) => i.actual_footage !== null) &&
          !load.all_packs_finished,
        reasons: [] as string[]
      }
    }

    // Explain why not showing
    if (!items.rows.some((i: any) => i.actual_footage !== null)) {
      visibility.tally_entry.reasons.push('No items with actual_footage set')
    }
    if (load.all_packs_tallied) {
      visibility.tally_entry.reasons.push('all_packs_tallied is TRUE')
    }
    if (load.all_packs_finished) {
      visibility.tally_entry.reasons.push('all_packs_finished is TRUE')
      visibility.rip_entry.reasons.push('all_packs_finished is TRUE')
      visibility.inventory.reasons.push('all_packs_finished is TRUE')
    }
    if (!load.all_packs_tallied) {
      visibility.rip_entry.reasons.push('all_packs_tallied is FALSE')
    }
    if (!items.rows.some((i: any) => i.actual_footage !== null)) {
      visibility.inventory.reasons.push('No items with actual_footage set')
    }

    return NextResponse.json({
      load_id: load.load_id,
      supplier: load.supplier_name,
      flags: {
        actual_arrival_date: load.actual_arrival_date,
        all_packs_tallied: load.all_packs_tallied,
        all_packs_finished: load.all_packs_finished,
        po_generated: load.po_generated,
        entered_in_quickbooks: load.entered_in_quickbooks,
        is_paid: load.is_paid
      },
      counts: {
        items: load.item_count,
        packs: load.pack_count,
        finished_packs: load.finished_pack_count
      },
      items: items.rows.map((i: any) => ({
        id: i.id,
        species: i.species,
        grade: i.grade,
        thickness: i.thickness,
        estimated_footage: i.estimated_footage,
        actual_footage: i.actual_footage,
        price: i.price
      })),
      visibility,
      should_show_in: {
        tally_entry: visibility.tally_entry.should_show,
        rip_entry: visibility.rip_entry.should_show,
        inventory: visibility.inventory.should_show
      }
    })
  } catch (error) {
    console.error('Error debugging load:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

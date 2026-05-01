import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParam = request.nextUrl.searchParams.get('search')

    const baseSelect = `
      SELECT 
        l.*,
        s.name as supplier_name,
        sl.location_name,
        sl.phone_number_1,
        sl.phone_number_2,
        d.name as driver_name,
        json_agg(
          json_build_object(
            'id', li.id,
            'species', li.species,
            'grade', li.grade,
            'thickness', li.thickness,
            'estimated_footage', li.estimated_footage,
            'actual_footage', li.actual_footage,
            'actual_footage_entered_at', li.actual_footage_entered_at,
            'price', li.price
          ) ORDER BY li.id
        ) as items,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', ld.id,
              'file_name', ld.file_name,
              'file_path', ld.file_path,
              'document_type', ld.document_type,
              'created_at', ld.created_at
            )
          ) FROM lumber_load_documents ld WHERE ld.load_id = l.id),
          '[]'::json
        ) as documents,
        COALESCE(pack_stats.total_packs, 0) as total_packs,
        COALESCE(pack_stats.finished_pack_count, 0) as finished_pack_count,
        COALESCE(pack_stats.finished_footage, 0) as finished_footage,
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM lumber_load_items li2
            WHERE li2.load_id = l.id AND li2.actual_footage IS NOT NULL
          ) THEN 'incoming'
          WHEN COALESCE(l.all_packs_finished, FALSE) = TRUE
            AND l.entered_in_quickbooks = TRUE THEN 'complete'
          WHEN COALESCE(l.all_packs_finished, FALSE) = TRUE THEN 'needs_invoice'
          WHEN l.invoice_number IS NULL OR l.invoice_total IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM lumber_load_documents WHERE load_id = l.id LIMIT 1
            ) THEN 'needs_docs'
          ELSE 'inventory'
        END as status
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      LEFT JOIN lumber_drivers d ON l.driver_id = d.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      LEFT JOIN (
        SELECT 
          p.load_id,
          COUNT(*) as total_packs,
          COUNT(CASE WHEN p.is_finished = TRUE THEN 1 END) as finished_pack_count,
          COALESCE(SUM(CASE WHEN p.is_finished = TRUE THEN COALESCE(p.tally_board_feet, p.actual_board_feet) ELSE 0 END), 0) as finished_footage
        FROM lumber_packs p
        GROUP BY p.load_id
      ) pack_stats ON l.id = pack_stats.load_id
    `

    const groupAndOrder = `
      GROUP BY l.id, s.name, sl.location_name, sl.phone_number_1, sl.phone_number_2, d.name,
               pack_stats.total_packs, pack_stats.finished_pack_count, pack_stats.finished_footage
      ORDER BY l.estimated_delivery_date NULLS LAST, l.created_at DESC
    `

    let result
    if (searchParam) {
      result = await query(
        `${baseSelect}
         WHERE l.load_id ILIKE $1 OR s.name ILIKE $1
         ${groupAndOrder}`,
        [`%${searchParam}%`]
      )
    } else {
      result = await query(
        `${baseSelect}
         WHERE NOT (
           COALESCE(l.all_packs_finished, FALSE) = TRUE
           AND COALESCE(l.is_paid, FALSE) = TRUE
         )
         ${groupAndOrder}`
      )
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching boss view loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

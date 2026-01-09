import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/loads/incoming - Get all incoming loads (not arrived yet)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
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
        ) as documents
      FROM lumber_loads l
      JOIN lumber_suppliers s ON l.supplier_id = s.id
      LEFT JOIN lumber_supplier_locations sl ON l.supplier_location_id = sl.id
      LEFT JOIN lumber_drivers d ON l.driver_id = d.id
      LEFT JOIN lumber_load_items li ON l.id = li.load_id
      WHERE COALESCE(l.all_packs_finished, FALSE) = FALSE
        AND (
          li.actual_footage IS NULL
          OR l.invoice_number IS NULL
          OR l.invoice_total IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM lumber_load_documents 
            WHERE load_id = l.id 
            LIMIT 1
          )
        )
      GROUP BY l.id, s.name, sl.location_name, sl.phone_number_1, sl.phone_number_2, d.name
      ORDER BY l.estimated_delivery_date NULLS LAST, l.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching incoming loads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/truckloads/[id]/promote - Promote a draft truckload to active
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    // Verify the truckload is currently a draft
    const checkResult = await query(
      `SELECT id, COALESCE(status, 'active') as status, bill_of_lading_number FROM truckloads WHERE id = $1`,
      [truckloadId]
    )

    if (!checkResult.rows.length) {
      return NextResponse.json({ success: false, error: 'Truckload not found' }, { status: 404 })
    }

    if (checkResult.rows[0].status !== 'draft') {
      return NextResponse.json({ success: false, error: 'Truckload is not a draft' }, { status: 400 })
    }

    // If no BOL number, generate one
    let bolUpdate = ''
    const values: any[] = [truckloadId]

    if (!checkResult.rows[0].bill_of_lading_number) {
      // Generate the next BOL number
      const bolResult = await query(`
        SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM truckloads WHERE bill_of_lading_number IS NOT NULL)
            THEN (
              SELECT TO_CHAR(CURRENT_DATE, 'YYMM') || 
                     LPAD((COALESCE(MAX(CAST(SUBSTRING(bill_of_lading_number FROM 5) AS INTEGER)), 0) + 1)::TEXT, 3, '0')
              FROM truckloads 
              WHERE bill_of_lading_number ~ ('^' || TO_CHAR(CURRENT_DATE, 'YYMM') || '[0-9]{3}$')
            )
            ELSE TO_CHAR(CURRENT_DATE, 'YYMM') || '001'
          END as next_bol_number
      `)
      bolUpdate = `, bill_of_lading_number = $2`
      values.push(bolResult.rows[0].next_bol_number)
    }

    // Promote: set status to 'active'
    const result = await query(
      `UPDATE truckloads 
       SET status = 'active', is_completed = false, updated_at = CURRENT_TIMESTAMP${bolUpdate}
       WHERE id = $1
       RETURNING 
         id,
         driver_id as "driverId",
         TO_CHAR(start_date, 'YYYY-MM-DD') as "startDate",
         TO_CHAR(end_date, 'YYYY-MM-DD') as "endDate",
         trailer_number as "trailerNumber",
         bill_of_lading_number as "billOfLadingNumber",
         description,
         is_completed as "isCompleted",
         COALESCE(status, 'active') as "status"`,
      values
    )

    return NextResponse.json({
      success: true,
      truckload: result.rows[0],
      message: 'Truckload promoted to active successfully'
    })
  } catch (error) {
    console.error('Error promoting truckload:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to promote truckload'
    }, { status: 500 })
  }
}

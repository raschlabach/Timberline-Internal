import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/truckloads/next-bol - Get the next BOL number without incrementing
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get the next BOL number in YYMMXXX format without incrementing it
    const result = await query(`
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

    const nextBolNumber = result.rows[0].next_bol_number

    return NextResponse.json({
      success: true,
      bolNumber: nextBolNumber
    })
  } catch (error) {
    console.error('Error getting next BOL number:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get next BOL number'
    }, { status: 500 })
  }
}

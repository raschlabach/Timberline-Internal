import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export const revalidate = 0

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(`
      SELECT
        fri.id,
        fri.filename,
        fri.date_from,
        fri.date_to,
        fri.total_transactions,
        fri.created_at,
        u.full_name as created_by_name
      FROM fuel_report_imports fri
      LEFT JOIN users u ON fri.created_by = u.id
      ORDER BY fri.created_at DESC
      LIMIT 50
    `)

    return NextResponse.json({ imports: result.rows })
  } catch (error) {
    console.error('Error fetching fuel imports:', error)
    return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 })
  }
}

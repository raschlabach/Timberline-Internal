import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/lumber/analytics/dismissed-warnings - Dismiss a quality warning
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { supplier_id, species, grade } = body

    if (!supplier_id || !species || !grade) {
      return NextResponse.json({ error: 'supplier_id, species, and grade are required' }, { status: 400 })
    }

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'dismissed_quality_warnings'
      ) as table_exists
    `)
    
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json({ 
        error: 'Migration not applied. Please run the dismissed warnings migration first.' 
      }, { status: 400 })
    }

    // Insert or ignore if already exists
    await query(`
      INSERT INTO dismissed_quality_warnings (supplier_id, species, grade, dismissed_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (supplier_id, species, grade) DO NOTHING
    `, [supplier_id, species, grade, session.user?.id || null])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error dismissing warning:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/lumber/analytics/dismissed-warnings - Restore a dismissed warning
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const supplier_id = searchParams.get('supplier_id')
    const species = searchParams.get('species')
    const grade = searchParams.get('grade')

    if (!supplier_id || !species || !grade) {
      return NextResponse.json({ error: 'supplier_id, species, and grade are required' }, { status: 400 })
    }

    // Check if table exists first
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'dismissed_quality_warnings'
      ) as table_exists
    `)
    
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json({ success: true }) // Nothing to delete if table doesn't exist
    }

    await query(`
      DELETE FROM dismissed_quality_warnings 
      WHERE supplier_id = $1 AND species = $2 AND grade = $3
    `, [supplier_id, species, grade])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error restoring warning:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

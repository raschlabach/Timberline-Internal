import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Change pack_id from BIGINT to VARCHAR to allow text, dashes, and spaces
    await query(`
      ALTER TABLE lumber_packs 
      ALTER COLUMN pack_id TYPE VARCHAR(50) 
      USING pack_id::VARCHAR;
    `)

    return NextResponse.json({ 
      success: true, 
      message: 'Pack ID column updated to accept text successfully' 
    })

  } catch (error: any) {
    console.error('Error applying pack ID migration:', error)
    return NextResponse.json({ 
      error: 'Failed to apply migration', 
      details: error.message 
    }, { status: 500 })
  }
}

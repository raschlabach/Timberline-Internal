import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Make pack_id nullable (might already be done from previous migration)
    try {
      await query('ALTER TABLE lumber_packs ALTER COLUMN pack_id DROP NOT NULL')
    } catch (e: any) {
      console.log('pack_id already nullable or error:', e.message)
    }

    // Make length nullable
    try {
      await query('ALTER TABLE lumber_packs ALTER COLUMN length DROP NOT NULL')
    } catch (e: any) {
      console.log('length already nullable or error:', e.message)
    }

    // Make tally_board_feet nullable
    try {
      await query('ALTER TABLE lumber_packs ALTER COLUMN tally_board_feet DROP NOT NULL')
    } catch (e: any) {
      console.log('tally_board_feet already nullable or error:', e.message)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Pack fields made nullable successfully.' 
    })
  } catch (error: any) {
    console.error('Error applying pack nullable migration:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to apply migration', 
      details: error.message 
    }, { status: 500 })
  }
}

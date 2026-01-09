import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { loadId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loadId = parseInt(params.loadId)

    // Mark PO as generated
    await query(
      `UPDATE lumber_loads 
       SET po_generated = TRUE, 
           po_generated_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [loadId]
    )

    return NextResponse.json({ 
      success: true, 
      message: 'PO marked as sent' 
    })
  } catch (error) {
    console.error('Error marking PO as sent:', error)
    return NextResponse.json(
      { error: 'Failed to mark PO as sent' },
      { status: 500 }
    )
  }
}

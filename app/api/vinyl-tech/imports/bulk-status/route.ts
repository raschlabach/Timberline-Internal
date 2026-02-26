import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { importIds, status } = body as {
      importIds: number[]
      status: 'active' | 'hidden' | 'completed'
    }

    if (!importIds?.length) {
      return NextResponse.json({ error: 'No imports selected' }, { status: 400 })
    }

    if (!['active', 'hidden', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    await query(
      `UPDATE vinyl_tech_imports
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2)`,
      [status, importIds]
    )

    return NextResponse.json({
      success: true,
      message: `${importIds.length} import(s) updated to ${status}`,
    })
  } catch (error) {
    console.error('Error updating import statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update imports' },
      { status: 500 }
    )
  }
}

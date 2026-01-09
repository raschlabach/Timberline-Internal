import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// DELETE /api/lumber/packs/[packId] - Delete a pack
export async function DELETE(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if pack exists and is not finished
    const checkResult = await query(
      `SELECT is_finished FROM lumber_packs WHERE id = $1`,
      [params.packId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    if (checkResult.rows[0].is_finished) {
      return NextResponse.json(
        { error: 'Cannot delete a finished pack' },
        { status: 400 }
      )
    }

    // Delete the pack
    await query(`DELETE FROM lumber_packs WHERE id = $1`, [params.packId])

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

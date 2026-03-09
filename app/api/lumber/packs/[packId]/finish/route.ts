import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { withTransaction } from '@/lib/db'

// PATCH /api/lumber/packs/[packId]/finish - Mark pack as finished
export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const result = await withTransaction(async (client) => {
      return client.query(
        `UPDATE lumber_packs
         SET 
           is_finished = TRUE,
           finished_at = CURRENT_TIMESTAMP,
           operator_id = $1,
           stacker_1_id = $2,
           stacker_2_id = $3,
           stacker_3_id = $4,
           stacker_4_id = $5,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING load_id`,
        [
          body.operator_id,
          body.stacker_1_id || null,
          body.stacker_2_id || null,
          body.stacker_3_id || null,
          body.stacker_4_id || null,
          params.packId
        ]
      )
    })

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error finishing pack:', error)
    return NextResponse.json({ 
      error: 'Failed to finish pack', 
      details: error?.message || String(error)
    }, { status: 500 })
  }
}

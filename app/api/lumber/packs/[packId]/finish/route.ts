import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/packs/[packId]/finish - Mark pack as finished
export async function PATCH(
  request: NextRequest,
  { params }: { params: { packId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    await query('BEGIN')

    try {
      // Mark pack as finished
      const result = await query(
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
          body.stacker_1_id,
          body.stacker_2_id,
          body.stacker_3_id,
          body.stacker_4_id,
          params.packId
        ]
      )

      const loadId = result.rows[0].load_id

      // Check if all packs in the load are finished
      const totalPacksResult = await query(
        'SELECT COUNT(*) as total FROM lumber_packs WHERE load_id = $1',
        [loadId]
      )
      const finishedPacksResult = await query(
        'SELECT COUNT(*) as finished FROM lumber_packs WHERE load_id = $1 AND is_finished = TRUE',
        [loadId]
      )

      if (totalPacksResult.rows[0].total === finishedPacksResult.rows[0].finished) {
        await query(
          'UPDATE lumber_loads SET all_packs_finished = TRUE WHERE id = $1',
          [loadId]
        )
      }

      await query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error finishing pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

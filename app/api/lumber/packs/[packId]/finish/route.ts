import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, withTransaction } from '@/lib/db'

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

    const operatorId = body.operator_id != null ? Number(body.operator_id) : null
    if (!operatorId || isNaN(operatorId) || operatorId <= 0) {
      return NextResponse.json({ 
        error: 'Valid operator_id is required',
        details: `Received operator_id: ${JSON.stringify(body.operator_id)}`
      }, { status: 400 })
    }

    // Validate operator exists before trying the update
    const opCheck = await query(
      'SELECT id FROM lumber_operators WHERE id = $1',
      [operatorId]
    )
    if (opCheck.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Operator not found',
        details: `Operator ID ${operatorId} does not exist. Please re-select from the dropdown.`
      }, { status: 400 })
    }

    const cleanStacker = (val: any) => {
      if (val == null) return null
      const num = Number(val)
      return isNaN(num) || num <= 0 ? null : num
    }

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
          operatorId,
          cleanStacker(body.stacker_1_id),
          cleanStacker(body.stacker_2_id),
          cleanStacker(body.stacker_3_id),
          cleanStacker(body.stacker_4_id),
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// PATCH /api/lumber/packs/[packId]/partial-finish - Partially finish a pack and create remainder pack
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
    const { 
      actual_board_feet, 
      tally_board_feet: bodyTallyBF,
      pack_id: bodyPackId,
      length: bodyLength,
      operator_id, 
      stacker_1_id, 
      stacker_2_id, 
      stacker_3_id, 
      stacker_4_id 
    } = body

    if (!actual_board_feet) {
      return NextResponse.json({ error: 'actual_board_feet is required' }, { status: 400 })
    }

    await query('BEGIN')

    try {
      // Get the original pack data
      const packResult = await query(
        `SELECT * FROM lumber_packs WHERE id = $1`,
        [params.packId]
      )

      if (packResult.rows.length === 0) {
        await query('ROLLBACK')
        return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
      }

      const originalPack = packResult.rows[0]
      
      // Use tally_board_feet from body if provided (for unsaved packs), otherwise use DB value
      const originalTallyBF = bodyTallyBF != null ? Number(bodyTallyBF) : (Number(originalPack.tally_board_feet) || 0)
      const actualBF = Number(actual_board_feet)
      const remainingBF = originalTallyBF - actualBF

      if (originalTallyBF <= 0) {
        await query('ROLLBACK')
        return NextResponse.json({ 
          error: 'Tally board feet must be greater than 0 for partial finish' 
        }, { status: 400 })
      }

      if (remainingBF <= 0) {
        await query('ROLLBACK')
        return NextResponse.json({ 
          error: 'Actual board feet must be less than tally board feet for partial finish' 
        }, { status: 400 })
      }
      
      // Use pack_id and length from body if provided (for unsaved packs)
      // Convert pack_id to string since it could be a number
      const packIdToUse = bodyPackId != null ? String(bodyPackId) : (originalPack.pack_id != null ? String(originalPack.pack_id) : null)
      const lengthToUse = bodyLength != null ? bodyLength : originalPack.length

      // Create the new pack ID (original + "*2", or increment if already has suffix)
      // Convert to string first since pack_id might be a number
      let newPackId = packIdToUse != null ? String(packIdToUse) : null
      if (newPackId) {
        const suffixMatch = newPackId.match(/\*(\d+)$/)
        if (suffixMatch) {
          // Already has a suffix like *2, increment it
          const nextNum = parseInt(suffixMatch[1]) + 1
          newPackId = newPackId.replace(/\*\d+$/, `*${nextNum}`)
        } else {
          // Add *2 suffix
          newPackId = `${newPackId}*2`
        }
      }

      // Create the new pack with remaining board feet
      const newPackResult = await query(
        `INSERT INTO lumber_packs (
          load_id, 
          item_id, 
          pack_id, 
          length, 
          tally_board_feet,
          is_finished
        )
        VALUES ($1, $2, $3, $4, $5, FALSE)
        RETURNING *`,
        [
          originalPack.load_id,
          originalPack.item_id,
          newPackId,
          lengthToUse,
          remainingBF
        ]
      )

      // Update the original pack's tally_board_feet to the actual ripped amount
      // and mark it as finished. Also update pack_id and length if provided.
      await query(
        `UPDATE lumber_packs
         SET 
           pack_id = $1,
           length = $2,
           tally_board_feet = $3,
           actual_board_feet = $3,
           rip_yield = CASE WHEN $3 > 0 THEN ROUND(($3::DECIMAL / $3) * 100, 2) ELSE NULL END,
           is_finished = TRUE,
           finished_at = CURRENT_DATE,
           operator_id = $4,
           stacker_1_id = $5,
           stacker_2_id = $6,
           stacker_3_id = $7,
           stacker_4_id = $8,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [
          packIdToUse,
          lengthToUse,
          actualBF,
          operator_id || null,
          stacker_1_id || null,
          stacker_2_id || null,
          stacker_3_id || null,
          stacker_4_id || null,
          params.packId
        ]
      )

      await query('COMMIT')

      return NextResponse.json({ 
        success: true, 
        originalPack: { id: params.packId, tally_board_feet: actual_board_feet },
        newPack: newPackResult.rows[0]
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error partial finishing pack:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

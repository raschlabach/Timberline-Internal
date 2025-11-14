import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/truckloads/[id]/layout - Get layout for a truckload
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const layoutType = searchParams.get('type') || 'delivery'
    
    if (layoutType !== 'delivery' && layoutType !== 'pickup') {
      return NextResponse.json({ success: false, error: 'Invalid layout type. Must be "delivery" or "pickup"' }, { status: 400 })
    }

    console.log(`Fetching ${layoutType} layout for truckload ${truckloadId}...`)

    // Get or create the layout for this truckload and type
    let layoutResult = await query(
      `SELECT id FROM trailer_layouts 
       WHERE truckload_id = $1 AND layout_type = $2`,
      [truckloadId, layoutType]
    )

    let layoutId: number
    if (layoutResult.rows.length === 0) {
      // Create a new layout if it doesn't exist
      const createResult = await query(
        `INSERT INTO trailer_layouts (truckload_id, layout_type)
         VALUES ($1, $2)
         RETURNING id`,
        [truckloadId, layoutType]
      )
      layoutId = createResult.rows[0].id
    } else {
      layoutId = layoutResult.rows[0].id
    }

    // Fetch all items for this layout
    const itemsResult = await query(
      `SELECT 
        id,
        item_type,
        item_id,
        x_position as x,
        y_position as y,
        width,
        length,
        rotation,
        stack_id as "stackId",
        stack_position as "stackPosition",
        customer_id as "customerId",
        customer_name as "customerName"
      FROM trailer_layout_items
      WHERE trailer_layout_id = $1
      ORDER BY id`,
      [layoutId]
    )

    return NextResponse.json({
      success: true,
      layout: itemsResult.rows
    })
  } catch (error) {
    console.error('Error fetching layout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch layout',
      details: errorMessage
    }, { status: 500 })
  }
}

// POST /api/truckloads/[id]/layout - Save layout for a truckload
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await getClient()
  
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      client.release()
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const truckloadId = parseInt(params.id)
    if (isNaN(truckloadId)) {
      client.release()
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const layoutType = searchParams.get('type') || 'delivery'
    
    if (layoutType !== 'delivery' && layoutType !== 'pickup') {
      client.release()
      return NextResponse.json({ success: false, error: 'Invalid layout type. Must be "delivery" or "pickup"' }, { status: 400 })
    }

    const body = await request.json()
    const layout: Array<{
      x: number
      y: number
      width: number
      length: number
      item_id: number
      type: 'skid' | 'vinyl'
      customerId: number
      rotation: number
      customerName: string
      stackId?: number
      stackPosition?: number
    }> = body.layout || []

    console.log(`Saving ${layoutType} layout for truckload ${truckloadId} with ${layout.length} items...`)

    await client.query('BEGIN')

    try {
      // Get or create the layout for this truckload and type
      let layoutResult = await client.query(
        `SELECT id FROM trailer_layouts 
         WHERE truckload_id = $1 AND layout_type = $2`,
        [truckloadId, layoutType]
      )

      let layoutId: number
      if (layoutResult.rows.length === 0) {
        // Create a new layout if it doesn't exist
        const createResult = await client.query(
          `INSERT INTO trailer_layouts (truckload_id, layout_type)
           VALUES ($1, $2)
           RETURNING id`,
          [truckloadId, layoutType]
        )
        layoutId = createResult.rows[0].id
      } else {
        layoutId = layoutResult.rows[0].id
      }

      // Delete all existing items for this layout
      await client.query(
        `DELETE FROM trailer_layout_items WHERE trailer_layout_id = $1`,
        [layoutId]
      )

      // Insert new items
      if (layout.length > 0) {
        for (const item of layout) {
          await client.query(
            `INSERT INTO trailer_layout_items (
              trailer_layout_id,
              item_type,
              item_id,
              x_position,
              y_position,
              width,
              length,
              rotation,
              stack_id,
              stack_position,
              customer_id,
              customer_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              layoutId,
              item.type,
              item.item_id,
              item.x,
              item.y,
              item.width,
              item.length,
              item.rotation || 0,
              item.stackId || null,
              item.stackPosition || null,
              item.customerId,
              item.customerName
            ]
          )
        }
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Layout saved successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error saving layout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to save layout',
      details: errorMessage
    }, { status: 500 })
  }
}


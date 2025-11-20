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

    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body. Expected JSON.' 
      }, { status: 400 })
    }

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

    // Validate layout items
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i]
      const errors: string[] = []
      
      if (typeof item.x !== 'number' || isNaN(item.x)) errors.push(`item[${i}].x is missing or invalid`)
      if (typeof item.y !== 'number' || isNaN(item.y)) errors.push(`item[${i}].y is missing or invalid`)
      if (typeof item.width !== 'number' || isNaN(item.width) || item.width <= 0) errors.push(`item[${i}].width is missing or invalid`)
      if (typeof item.length !== 'number' || isNaN(item.length) || item.length <= 0) errors.push(`item[${i}].length is missing or invalid`)
      if (typeof item.item_id !== 'number' || isNaN(item.item_id)) errors.push(`item[${i}].item_id is missing or invalid`)
      if (typeof item.customerId !== 'number' || isNaN(item.customerId)) errors.push(`item[${i}].customerId is missing or invalid`)
      if (!item.type || (item.type !== 'skid' && item.type !== 'vinyl')) errors.push(`item[${i}].type is missing or invalid (must be 'skid' or 'vinyl')`)
      if (!item.customerName || typeof item.customerName !== 'string') errors.push(`item[${i}].customerName is missing or invalid`)
      if (typeof item.rotation !== 'number') errors.push(`item[${i}].rotation is missing or invalid`)
      
      if (errors.length > 0) {
        console.error('Invalid layout item:', item)
        console.error('Validation errors:', errors)
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid layout item data. All required fields must be present and valid.',
          details: errors.join('; ')
        }, { status: 400 })
      }
    }

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
          try {
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
          } catch (insertError) {
            console.error('Error inserting layout item:', insertError, item)
            throw new Error(`Failed to insert layout item: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`)
          }
        }
      }

      await client.query('COMMIT')

      console.log(`Successfully saved ${layoutType} layout for truckload ${truckloadId}`)

      return NextResponse.json({
        success: true,
        message: 'Layout saved successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => {
        console.error('Error during rollback:', rollbackError)
      })
      throw error
    }
  } catch (error) {
    console.error('Error saving layout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: 'Failed to save layout',
      details: errorMessage
    }, { status: 500 })
  } finally {
    client.release()
  }
}


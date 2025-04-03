import { NextRequest, NextResponse } from 'next/server'
import { dbQuery, getPool, getClient } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface LayoutItem {
  skidId?: number | null
  x: number
  y: number
  width: number
  length: number
  type: 'skid' | 'vinyl'
  rotation?: number
  customerId?: number
  customerName?: string
  stackId?: number
  stackPosition?: number
}

interface SaveLayoutRequest {
  layout: LayoutItem[]
}

// Export for testing
export function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && value > 0
}

// Export for testing
export function isValidPosition(value: unknown): value is number {
  return typeof value === 'number' && value >= 0
}

// Export for testing
export function isValidLayoutItem(item: any): item is LayoutItem {
  if (!item || typeof item !== 'object') {
    console.error('Invalid item: not an object', item)
    return false
  }

  // Validate type first since other validations depend on it
  if (!['skid', 'vinyl'].includes(item.type)) {
    console.error('Invalid item: incorrect type', item)
    return false
  }

  // Validate dimensions and positions
  if (!isValidPosition(item.x) || !isValidPosition(item.y)) {
    console.error('Invalid item: invalid position', item)
    return false
  }
  if (!isValidDimension(item.width) || !isValidDimension(item.length)) {
    console.error('Invalid item: invalid dimensions', item)
    return false
  }

  // Validate skidId for both types
  if (typeof item.skidId !== 'number' || item.skidId <= 0) {
    console.error('Invalid item: invalid skidId', item)
    return false
  }

  // Validate stackId and stackPosition consistently for both types
  if (item.stackId !== undefined) {
    if (typeof item.stackId !== 'number' || item.stackId <= 0) {
      console.error('Invalid item: invalid stackId', item)
      return false
    }
    // stackPosition is required if stackId is present
    if (item.stackPosition === undefined || typeof item.stackPosition !== 'number' || item.stackPosition <= 0) {
      console.error('Invalid item: missing or invalid stackPosition for stacked item', item)
      return false
    }
  }

  // Validate rotation if present
  if (item.rotation !== undefined) {
    if (typeof item.rotation !== 'number' || ![0, 90, 180, 270].includes(item.rotation)) {
      console.error('Invalid item: invalid rotation', item)
      return false
    }
  }

  // Validate customer info if present
  if (item.customerId !== undefined) {
    if (typeof item.customerId !== 'number' || item.customerId <= 0) {
      console.error('Invalid item: invalid customerId', item)
      return false
    }
  }
  if (item.customerName !== undefined && typeof item.customerName !== 'string') {
    console.error('Invalid item: invalid customerName', item)
    return false
  }

  return true
}

// Export for testing
export function validateLayout(layout: unknown): layout is LayoutItem[] {
  if (!Array.isArray(layout)) {
    console.error('Invalid layout: not an array', layout)
    throw new Error('Layout must be an array')
  }

  // Validate each item
  for (const item of layout) {
    if (!isValidLayoutItem(item)) {
      console.error('Invalid layout item:', item)
      throw new Error(`Invalid layout item: ${JSON.stringify(item)}`)
    }
  }

  // Validate stack consistency
  const stackItems = layout.filter(item => item.stackId !== undefined)
  const stackGroups = new Map<number, LayoutItem[]>()
  
  stackItems.forEach((item: LayoutItem) => {
    if (!item.stackId) return
    if (!stackGroups.has(item.stackId)) {
      stackGroups.set(item.stackId, [])
    }
    stackGroups.get(item.stackId)?.push(item)
  })

  // Check each stack
  for (const [stackId, items] of Array.from(stackGroups.entries())) {
    // All items in a stack should have the same x,y coordinates
    const firstItem = items[0]
    const invalidPosition = items.some((item: LayoutItem) => 
      item.x !== firstItem.x || item.y !== firstItem.y
    )
    if (invalidPosition) {
      console.error(`Stack ${stackId} has inconsistent positions:`, items)
      throw new Error(`Stack ${stackId} has items with different positions`)
    }

    // Find items without a position (new items)
    const existingItems = items.filter(item => item.stackPosition !== undefined)
    const newItems = items.filter(item => item.stackPosition === undefined)

    // Get the highest existing position
    const highestPosition = existingItems.length > 0 
      ? Math.max(...existingItems.map(item => item.stackPosition || 0))
      : 0

    // Add new items at the top of the stack with highest positions
    newItems.forEach((item, index) => {
      item.stackPosition = highestPosition + index + 1
    })

    // Sort all items by position in descending order (highest first)
    const sortedItems = [...items].sort((a, b) => {
      const aPos = a.stackPosition || 0
      const bPos = b.stackPosition || 0
      return bPos - aPos // Sort in descending order (highest first)
    })

    // Update positions to be sequential from top down
    sortedItems.forEach((item, index) => {
      item.stackPosition = items.length - index // Assign highest numbers to top items
    })
  }

  return true
}

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

    // Get layout type from query params
    const searchParams = new URL(request.url).searchParams
    const layoutType = searchParams.get('type') || 'delivery'

    // Ensure database connection is initialized
    getPool()

    console.log('🔍 GET: Fetching layout:', {
      truckloadId,
      layoutType
    })

    // Modified query to properly order by stack position
    const result = await dbQuery(
      `SELECT tli.*, 
              COALESCE(tli.stack_position, 
                ROW_NUMBER() OVER (PARTITION BY tli.stack_id ORDER BY tli.id DESC)
              ) as stack_position
       FROM trailer_layouts tl 
       JOIN trailer_layout_items tli ON tl.id = tli.trailer_layout_id 
       WHERE tl.truckload_id = $1 AND tl.layout_type = $2
       ORDER BY 
         CASE 
           WHEN tli.stack_id IS NULL THEN 2
           ELSE 1
         END,
         tli.stack_id,
         tli.stack_position DESC,
         tli.id DESC`,
      [truckloadId, layoutType]
    )

    console.log('📊 GET: Query results:', {
      rowCount: result.rows.length,
      rows: result.rows
    })

    // Group items by stack_id
    const stackMap = new Map<number, LayoutItem[]>()
    const nonStackedItems: LayoutItem[] = []

    console.log('🔄 GET: Starting first pass - organizing items into stacks')
    
    // Process each item from the database
    for (const row of result.rows) {
      const item: LayoutItem = {
        skidId: row.item_id,
        type: row.item_type,
        x: row.x_position,
        y: row.y_position,
        width: row.width,
        length: row.length,
        rotation: row.rotation || 0,
        customerId: row.customer_id,
        customerName: row.customer_name,
        stackId: row.stack_id,
        stackPosition: row.stack_position
      }

      if (item.stackId) {
        console.log(`📦 GET: Processing stacked item:`, {
          id: item.skidId,
          type: item.type,
          stackId: item.stackId,
          pos: item.stackPosition,
          x: item.x,
          y: item.y
        })
        
        if (!stackMap.has(item.stackId)) {
          stackMap.set(item.stackId, [])
        }
        stackMap.get(item.stackId)?.push(item)
      } else {
        console.log('🔂 GET: Added non-stacked item:', {
          id: item.skidId,
          type: item.type,
          x: item.x,
          y: item.y
        })
        nonStackedItems.push(item)
      }
    }

    console.log('📋 GET: Processing complete:', {
      nonStackedItems: nonStackedItems.length,
      stacks: stackMap.size,
      totalItems: nonStackedItems.length + Array.from(stackMap.values()).reduce((acc, items) => acc + items.length, 0)
    })

    // Process stacks to ensure proper positioning
    console.log('🔄 GET: Starting second pass - processing stacks')
    stackMap.forEach((items, stackId) => {
      if (items.length > 0) {
        // Sort items by stack position (highest number on top)
        items.sort((a: LayoutItem, b: LayoutItem) => (b.stackPosition || 0) - (a.stackPosition || 0))
        
        // Use position of bottom item for all items in stack
        const bottomItem = items[items.length - 1]
        items.forEach(item => {
          item.x = bottomItem.x
          item.y = bottomItem.y
        })
        
        console.log(`📚 Stack ${stackId} processed:`, {
          items: items.map(i => ({
            id: i.skidId,
            type: i.type,
            pos: i.stackPosition,
            x: i.x,
            y: i.y
          }))
        })
      }
    })

    // Combine all items for response
    const layout = [
      ...nonStackedItems,
      ...Array.from(stackMap.values()).flat()
    ]

    console.log('✅ GET: Returning layout:', {
      success: true,
      itemCount: layout.length
    })

    return NextResponse.json({
      success: true,
      layout
    })
  } catch (error) {
    console.error('❌ GET: Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred' 
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await getClient()
  
  try {
    const truckloadId = params.id
    const body = await request.json()
    
    // Get layout type from query params
    const searchParams = new URL(request.url).searchParams
    const layoutType = searchParams.get('type') || 'delivery'
    
    console.log('📥 POST: Received layout save request:', {
      truckloadId,
      layoutType,
      bodyLength: body.layout?.length,
      body: body
    })
    
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (isNaN(parseInt(truckloadId))) {
      return NextResponse.json({ success: false, error: 'Invalid truckload ID' }, { status: 400 })
    }

    try {
      validateLayout(body.layout)
    } catch (error) {
      console.error('❌ POST: Layout validation error:', error)
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Invalid layout data'
      }, { status: 400 })
    }

    // Start transaction
    await client.query('BEGIN')
    console.log('🔄 POST: Started database transaction')

    // Get or create layout ID
    const layoutResult = await client.query(
      `SELECT id FROM trailer_layouts WHERE truckload_id = $1 AND layout_type = $2`,
      [truckloadId, layoutType]
    )

    let layoutId: number
    if (layoutResult.rows.length === 0) {
      console.log('📝 POST: Creating new layout for truckload:', truckloadId, 'type:', layoutType)
      const newLayoutResult = await client.query(
        `INSERT INTO trailer_layouts (truckload_id, layout_type) VALUES ($1, $2) RETURNING id`,
        [truckloadId, layoutType]
      )
      layoutId = newLayoutResult.rows[0].id
      console.log('✅ POST: Created new layout with ID:', layoutId)
    } else {
      layoutId = layoutResult.rows[0].id
      console.log('📋 POST: Using existing layout with ID:', layoutId)
    }

    // Delete existing layout items
    const deleteResult = await client.query(
      `DELETE FROM trailer_layout_items WHERE trailer_layout_id = $1 RETURNING id`,
      [layoutId]
    )
    console.log('🗑️ POST: Deleted existing layout items:', deleteResult.rowCount, 'items')

    // Group items by stack for ordered insertion
    const stackMap = new Map<number, LayoutItem[]>()
    const nonStackedItems: LayoutItem[] = []

    console.log('🔄 POST: Processing layout items:', body.layout.length, 'total items')
    body.layout.forEach((item: LayoutItem) => {
      if (item.stackId !== undefined) {
        const stack = stackMap.get(item.stackId) || []
        stack.push(item)
        stackMap.set(item.stackId, stack)
        console.log(`📚 POST: Added item to stack ${item.stackId}:`, {
          id: item.skidId,
          type: item.type,
          pos: item.stackPosition,
          x: item.x,
          y: item.y
        })
      } else {
        nonStackedItems.push(item)
        console.log('🔂 POST: Added non-stacked item:', {
          id: item.skidId,
          type: item.type,
          x: item.x,
          y: item.y
        })
      }
    })

    // Process and insert non-stacked items
    console.log('📝 POST: Inserting', nonStackedItems.length, 'non-stacked items')
    for (const item of nonStackedItems) {
      const result = await client.query(
        `INSERT INTO trailer_layout_items (
          trailer_layout_id,
          item_type,
          item_id,
          x_position,
          y_position,
          width,
          length,
          rotation,
          customer_id,
          customer_name,
          stack_id,
          stack_position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          layoutId,
          item.type,
          item.skidId,
          item.x,
          item.y,
          item.width,
          item.length,
          item.rotation || 0,
          item.customerId,
          item.customerName,
          null,
          null
        ]
      )
      console.log('✅ POST: Inserted non-stacked item:', {
        id: item.skidId,
        type: item.type,
        dbId: result.rows[0].id
      })
    }

    // Process and insert stacked items
    console.log('📝 POST: Processing', stackMap.size, 'stacks')
    for (const [stackId, items] of Array.from(stackMap)) {
      console.log(`🔄 POST: Processing stack ${stackId} with ${items.length} items`)
      
      // Sort items by stack position (highest number on top)
      items.sort((a: LayoutItem, b: LayoutItem) => (b.stackPosition || 0) - (a.stackPosition || 0))
      
      // Use the bottom item's position for the entire stack
      const bottomItem = items[items.length - 1]
      const stackX = bottomItem.x
      const stackY = bottomItem.y

      // Insert items in order (from bottom to top)
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i]
        const stackPosition = items.length - i // Position 1 is bottom
        
        console.log(`📦 POST: Inserting stack item:`, {
          id: item.skidId,
          type: item.type,
          stackId,
          position: stackPosition,
          x: stackX,
          y: stackY
        })
        
        const result = await client.query(
          `INSERT INTO trailer_layout_items (
            trailer_layout_id,
            item_type,
            item_id,
            x_position,
            y_position,
            width,
            length,
            rotation,
            customer_id,
            customer_name,
            stack_id,
            stack_position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            layoutId,
            item.type,
            item.skidId,
            stackX,
            stackY,
            item.width,
            item.length,
            item.rotation || 0,
            item.customerId,
            item.customerName,
            stackId,
            stackPosition
          ]
        )
        console.log(`✅ POST: Inserted stack item with DB ID:`, result.rows[0].id)
      }
      
      console.log(`✅ POST: Completed stack ${stackId} insertion`)
    }

    // Commit transaction
    await client.query('COMMIT')
    console.log('✅ POST: Transaction committed successfully')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ POST: Error:', error)
    try {
      await client.query('ROLLBACK')
      console.log('🔄 POST: Transaction rolled back')
    } catch (rollbackError) {
      console.error('❌ POST: Error during rollback:', rollbackError)
    }
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred' 
    }, { status: 500 })
  } finally {
    client.release()
  }
} 
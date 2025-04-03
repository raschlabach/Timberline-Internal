console.log('Mapped layout items:', layout) // Debug log

// Group vinyl items by stack ID
const stackItems = layout.filter((item: GridPosition) => item.type === 'vinyl' && item.stackId)
const stackGroups = new Map<number, GridPosition[]>()

// First, group items by stack
stackItems.forEach((item: GridPosition) => {
  if (!item.stackId) return
  if (!stackGroups.has(item.stackId)) {
    stackGroups.set(item.stackId, [])
  }
  stackGroups.get(item.stackId)?.push(item)
})

// Sort items within each stack by position (1 at bottom)
stackGroups.forEach(items => {
  // First ensure all items have a valid position
  items.forEach(item => {
    if (!item.stackPosition) {
      console.warn(`Item ${item.skidId} in stack ${item.stackId} has no position, defaulting to 999`)
      item.stackPosition = 999
    }
  })

  // Sort by position, with 1 at the bottom
  items.sort((a, b) => {
    const posA = a.stackPosition || 999
    const posB = b.stackPosition || 999
    return posA - posB
  })

  console.log('Stack positions after sort:', items.map(item => ({
    id: item.skidId,
    pos: item.stackPosition,
    customer: item.customerName
  })))
})

// Create vinyl stacks with sorted items
const stacks: VinylStack[] = []
stackGroups.forEach((items, stackId) => {
  if (items.length > 0) {
    // Create stack with sorted items
    const stack: VinylStack = {
      stackId,
      x: items[0].x,
      y: items[0].y,
      skids: items
    }
    stacks.push(stack)

    console.log(`Stack ${stackId} order:`, stack.skids.map(s => ({
      id: s.skidId,
      pos: s.stackPosition,
      customer: s.customerName
    })))
  }
})

// Update the placedSkids to match the stack order
const updatedLayout = layout.map(item => {
  if (item.type === 'vinyl' && item.stackId) {
    const stack = stacks.find(s => s.stackId === item.stackId)
    if (stack) {
      const stackItem = stack.skids.find(s => s.skidId === item.skidId)
      if (stackItem) {
        return {
          ...item,
          stackPosition: stackItem.stackPosition
        }
      }
    }
  }
  return item
})

console.log('Final stack configuration:', stacks.map(s => ({
  id: s.stackId,
  positions: s.skids.map(sk => ({
    id: sk.skidId,
    pos: sk.stackPosition,
    customer: sk.customerName
  }))
}
)))

setPlacedSkids(updatedLayout)
setVinylStacks(stacks) 
import { CharcoalOrder, CharcoalProjectedSkid, CharcoalAllocation } from '@/types/charcoal'

interface PoolProjection {
  count: number
  readyDate: string
}

/**
 * Allocates inventory and projected production to orders in priority order.
 * Inventory is split by WC/standard (skids are already bagged).
 * Projections are a single shared pool (raw charcoal, not yet bagged as WC or std).
 */
export function computeAllocations(
  orders: CharcoalOrder[],
  stdInvCount: number,
  wcInvCount: number,
  projections: CharcoalProjectedSkid[]
): Record<string, CharcoalAllocation> {
  const sharedProjections: PoolProjection[] = projections
    .sort((a, b) => String(a.ready_date).localeCompare(String(b.ready_date)))
    .map(p => ({ count: p.count, readyDate: String(p.ready_date).substring(0, 10) }))

  let stdInv = stdInvCount
  let wcInv = wcInvCount

  const allocation: Record<string, CharcoalAllocation> = {}

  for (const order of orders) {
    const isWC = order.customer_is_walnut_creek
    let needed = order.quantity

    const invAvailable = isWC ? wcInv : stdInv
    const fromInventory = Math.min(needed, invAvailable)
    if (isWC) wcInv -= fromInventory
    else stdInv -= fromInventory
    needed -= fromInventory

    const fromProjected: { count: number; readyDate: string }[] = []
    let i = 0
    while (needed > 0 && i < sharedProjections.length) {
      const available = sharedProjections[i].count
      const take = Math.min(needed, available)
      if (take > 0) {
        fromProjected.push({ count: take, readyDate: sharedProjections[i].readyDate })
        sharedProjections[i].count -= take
        needed -= take
      }
      if (sharedProjections[i].count === 0) i++
      else break
    }

    allocation[order.id] = {
      greenCount: fromInventory,
      orangePieces: fromProjected,
      unallocated: needed,
    }
  }

  return allocation
}

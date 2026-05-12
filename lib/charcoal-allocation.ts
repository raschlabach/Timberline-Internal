import { CharcoalOrder, CharcoalProjectedSkid, CharcoalAllocation } from '@/types/charcoal'

interface PoolProjection {
  count: number
  readyDate: string
}

interface Pool {
  inventory: number
  projections: PoolProjection[]
}

export function computeAllocations(
  orders: CharcoalOrder[],
  stdInvCount: number,
  wcInvCount: number,
  projections: CharcoalProjectedSkid[]
): Record<string, CharcoalAllocation> {
  const stdProjections: PoolProjection[] = projections
    .filter(p => !p.is_walnut_creek)
    .sort((a, b) => a.ready_date.localeCompare(b.ready_date))
    .map(p => ({ count: p.count, readyDate: p.ready_date }))

  const wcProjections: PoolProjection[] = projections
    .filter(p => p.is_walnut_creek)
    .sort((a, b) => a.ready_date.localeCompare(b.ready_date))
    .map(p => ({ count: p.count, readyDate: p.ready_date }))

  const pools = {
    std: { inventory: stdInvCount, projections: stdProjections } as Pool,
    wc: { inventory: wcInvCount, projections: wcProjections } as Pool,
  }

  const allocation: Record<string, CharcoalAllocation> = {}

  for (const order of orders) {
    const pool = order.customer_is_walnut_creek ? pools.wc : pools.std
    let needed = order.quantity

    const fromInventory = Math.min(needed, pool.inventory)
    pool.inventory -= fromInventory
    needed -= fromInventory

    const fromProjected: { count: number; readyDate: string }[] = []
    let i = 0
    while (needed > 0 && i < pool.projections.length) {
      const available = pool.projections[i].count
      const take = Math.min(needed, available)
      if (take > 0) {
        fromProjected.push({ count: take, readyDate: pool.projections[i].readyDate })
        pool.projections[i].count -= take
        needed -= take
      }
      if (pool.projections[i].count === 0) i++
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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/lumber/rip-report - Get rip production report for date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Adjust end date to include the full day
    const adjustedEndDate = new Date(endDate)
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1)
    const endDateStr = adjustedEndDate.toISOString().split('T')[0]

    // Get all finished regular packs for the date range with load item info
    const regularPacksResult = await query(
      `SELECT 
         p.id,
         p.pack_id,
         p.load_item_id,
         p.actual_board_feet,
         p.tally_board_feet,
         p.is_finished,
         p.finished_at,
         p.operator_id,
         p.stacker_1_id,
         p.stacker_2_id,
         p.stacker_3_id,
         p.stacker_4_id,
         li.species,
         li.grade,
         li.thickness,
         ll.load_id,
         ll.id as lumber_load_id,
         lo_op.name as operator_name,
         lo_s1.name as stacker_1_name,
         lo_s2.name as stacker_2_name,
         lo_s3.name as stacker_3_name,
         lo_s4.name as stacker_4_name,
         DATE(p.finished_at) as finished_date
       FROM lumber_packs p
       JOIN lumber_load_items li ON p.load_item_id = li.id
       JOIN lumber_loads ll ON li.load_id = ll.id
       LEFT JOIN lumber_operators lo_op ON p.operator_id = lo_op.id
       LEFT JOIN lumber_operators lo_s1 ON p.stacker_1_id = lo_s1.id
       LEFT JOIN lumber_operators lo_s2 ON p.stacker_2_id = lo_s2.id
       LEFT JOIN lumber_operators lo_s3 ON p.stacker_3_id = lo_s3.id
       LEFT JOIN lumber_operators lo_s4 ON p.stacker_4_id = lo_s4.id
       WHERE p.is_finished = TRUE
         AND p.finished_at >= $1
         AND p.finished_at < $2
       ORDER BY li.thickness, li.species, li.grade, p.finished_at`,
      [startDate, endDateStr]
    )

    // Get all finished misc packs for the date range
    const miscPacksResult = await query(
      `SELECT 
         mp.id,
         mp.pack_id,
         mp.species,
         mp.grade,
         mp.thickness,
         mp.actual_board_feet,
         mp.is_finished,
         mp.finished_at,
         mp.operator_id,
         mp.stacker_1_id,
         mp.stacker_2_id,
         mp.stacker_3_id,
         mp.stacker_4_id,
         lo_op.name as operator_name,
         lo_s1.name as stacker_1_name,
         lo_s2.name as stacker_2_name,
         lo_s3.name as stacker_3_name,
         lo_s4.name as stacker_4_name,
         DATE(mp.finished_at) as finished_date
       FROM misc_rip_packs mp
       LEFT JOIN lumber_operators lo_op ON mp.operator_id = lo_op.id
       LEFT JOIN lumber_operators lo_s1 ON mp.stacker_1_id = lo_s1.id
       LEFT JOIN lumber_operators lo_s2 ON mp.stacker_2_id = lo_s2.id
       LEFT JOIN lumber_operators lo_s3 ON mp.stacker_3_id = lo_s3.id
       LEFT JOIN lumber_operators lo_s4 ON mp.stacker_4_id = lo_s4.id
       WHERE mp.is_finished = TRUE
         AND mp.finished_at >= $1
         AND mp.finished_at < $2
       ORDER BY mp.thickness, mp.species, mp.grade, mp.finished_at`,
      [startDate, endDateStr]
    )

    // Get work sessions for hours calculation
    const workSessionsResult = await query(
      `SELECT *
       FROM lumber_work_sessions
       WHERE work_date >= $1 AND work_date < $2
       ORDER BY work_date`,
      [startDate, endDateStr]
    )

    // Get unique load counts from regular packs
    const loadCountResult = await query(
      `SELECT COUNT(DISTINCT ll.id) as load_count
       FROM lumber_packs p
       JOIN lumber_load_items li ON p.load_item_id = li.id
       JOIN lumber_loads ll ON li.load_id = ll.id
       WHERE p.is_finished = TRUE
         AND p.finished_at >= $1
         AND p.finished_at < $2`,
      [startDate, endDateStr]
    )

    const regularPacks = regularPacksResult.rows
    const miscPacks = miscPacksResult.rows
    const workSessions = workSessionsResult.rows
    const uniqueLoadCount = parseInt(loadCountResult.rows[0]?.load_count || '0')

    // Group regular packs by thickness -> species -> grade
    const groupedData: Record<string, Record<string, Record<string, {
      packs: any[],
      totalBF: number,
      packCount: number,
      loadIds: Set<string>
    }>>> = {}

    for (const pack of regularPacks) {
      const thickness = pack.thickness || 'Unknown'
      const species = pack.species || 'Unknown'
      const grade = pack.grade || 'Unknown'

      if (!groupedData[thickness]) groupedData[thickness] = {}
      if (!groupedData[thickness][species]) groupedData[thickness][species] = {}
      if (!groupedData[thickness][species][grade]) {
        groupedData[thickness][species][grade] = {
          packs: [],
          totalBF: 0,
          packCount: 0,
          loadIds: new Set()
        }
      }

      groupedData[thickness][species][grade].packs.push(pack)
      groupedData[thickness][species][grade].totalBF += Number(pack.actual_board_feet) || 0
      groupedData[thickness][species][grade].packCount++
      if (pack.load_id) groupedData[thickness][species][grade].loadIds.add(pack.load_id)
    }

    // Group misc packs by thickness -> species -> grade
    const miscGroupedData: Record<string, Record<string, Record<string, {
      packs: any[],
      totalBF: number,
      packCount: number
    }>>> = {}

    for (const pack of miscPacks) {
      const thickness = pack.thickness || 'Unknown'
      const species = pack.species || 'Unknown'
      const grade = pack.grade || 'Unknown'

      if (!miscGroupedData[thickness]) miscGroupedData[thickness] = {}
      if (!miscGroupedData[thickness][species]) miscGroupedData[thickness][species] = {}
      if (!miscGroupedData[thickness][species][grade]) {
        miscGroupedData[thickness][species][grade] = {
          packs: [],
          totalBF: 0,
          packCount: 0
        }
      }

      miscGroupedData[thickness][species][grade].packs.push(pack)
      miscGroupedData[thickness][species][grade].totalBF += Number(pack.actual_board_feet) || 0
      miscGroupedData[thickness][species][grade].packCount++
    }

    // Calculate operator statistics
    const operatorStats: Record<string, { name: string, totalBF: number, packCount: number }> = {}
    const allPacks = [...regularPacks, ...miscPacks]

    for (const pack of allPacks) {
      const operatorId = pack.operator_id
      const operatorName = pack.operator_name || 'Unknown'
      const bf = Number(pack.actual_board_feet) || 0

      if (operatorId) {
        if (!operatorStats[operatorId]) {
          operatorStats[operatorId] = { name: operatorName, totalBF: 0, packCount: 0 }
        }
        operatorStats[operatorId].totalBF += bf
        operatorStats[operatorId].packCount++
      }
    }

    // Calculate stacker statistics
    let totalStackerCount = 0
    let packsWithStackers = 0

    for (const pack of allPacks) {
      let stackerCount = 0
      if (pack.stacker_1_id) stackerCount++
      if (pack.stacker_2_id) stackerCount++
      if (pack.stacker_3_id) stackerCount++
      if (pack.stacker_4_id) stackerCount++
      
      if (stackerCount > 0) {
        totalStackerCount += stackerCount
        packsWithStackers++
      }
    }

    const averageStackers = packsWithStackers > 0 ? totalStackerCount / packsWithStackers : 0

    // Calculate total hours and BF/hour
    let totalHours = 0
    for (const session of workSessions) {
      totalHours += Number(session.total_hours) || 0
    }

    const totalRegularBF = regularPacks.reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0)
    const totalMiscBF = miscPacks.reduce((sum, p) => sum + (Number(p.actual_board_feet) || 0), 0)
    const grandTotalBF = totalRegularBF + totalMiscBF

    const bfPerHour = totalHours > 0 ? grandTotalBF / totalHours : 0

    // Calculate species totals for "most ripped" stat
    const speciesTotal: Record<string, number> = {}
    for (const pack of allPacks) {
      const species = pack.species || 'Unknown'
      speciesTotal[species] = (speciesTotal[species] || 0) + (Number(pack.actual_board_feet) || 0)
    }

    const mostRippedSpecies = Object.entries(speciesTotal)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([species, bf]) => ({ species, totalBF: bf }))

    // Calculate operator BF/hour
    const operatorHours: Record<string, number> = {}
    for (const session of workSessions) {
      // Distribute hours among operators who worked that day
      const dateStr = new Date(session.work_date).toISOString().split('T')[0]
      const packsOnDate = allPacks.filter(p => {
        const packDate = new Date(p.finished_at).toISOString().split('T')[0]
        return packDate === dateStr
      })
      
      const operatorsOnDate = Array.from(new Set(packsOnDate.map(p => p.operator_id).filter(Boolean)))
      const hoursPerOperator = operatorsOnDate.length > 0 ? (Number(session.total_hours) || 0) / operatorsOnDate.length : 0
      
      for (const opId of operatorsOnDate) {
        operatorHours[opId] = (operatorHours[opId] || 0) + hoursPerOperator
      }
    }

    // Add hours and BF/hour to operator stats
    const operatorStatsWithHours = Object.entries(operatorStats).map(([id, stats]) => ({
      id,
      ...stats,
      totalHours: operatorHours[id] || 0,
      bfPerHour: operatorHours[id] ? stats.totalBF / operatorHours[id] : 0
    })).sort((a, b) => b.totalBF - a.totalBF)

    // Convert grouped data to serializable format
    const serializableGroupedData: Record<string, Record<string, Record<string, {
      totalBF: number,
      packCount: number,
      loadCount: number
    }>>> = {}

    for (const [thickness, speciesData] of Object.entries(groupedData)) {
      serializableGroupedData[thickness] = {}
      for (const [species, gradeData] of Object.entries(speciesData)) {
        serializableGroupedData[thickness][species] = {}
        for (const [grade, data] of Object.entries(gradeData)) {
          serializableGroupedData[thickness][species][grade] = {
            totalBF: data.totalBF,
            packCount: data.packCount,
            loadCount: data.loadIds.size
          }
        }
      }
    }

    // Convert misc grouped data to serializable format
    const serializableMiscGroupedData: Record<string, Record<string, Record<string, {
      totalBF: number,
      packCount: number
    }>>> = {}

    for (const [thickness, speciesData] of Object.entries(miscGroupedData)) {
      serializableMiscGroupedData[thickness] = {}
      for (const [species, gradeData] of Object.entries(speciesData)) {
        serializableMiscGroupedData[thickness][species] = {}
        for (const [grade, data] of Object.entries(gradeData)) {
          serializableMiscGroupedData[thickness][species][grade] = {
            totalBF: data.totalBF,
            packCount: data.packCount
          }
        }
      }
    }

    return NextResponse.json({
      dateRange: { startDate, endDate },
      regularData: serializableGroupedData,
      miscData: serializableMiscGroupedData,
      totals: {
        regularBF: totalRegularBF,
        regularPacks: regularPacks.length,
        regularLoads: uniqueLoadCount,
        miscBF: totalMiscBF,
        miscPacks: miscPacks.length,
        grandTotalBF,
        grandTotalPacks: allPacks.length
      },
      statistics: {
        totalHours,
        bfPerHour,
        averageStackers,
        operatorStats: operatorStatsWithHours,
        mostRippedSpecies,
        workDays: workSessions.length
      }
    })
  } catch (error) {
    console.error('Error generating rip report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

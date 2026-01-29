import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { MonthlyRipReport, DailyRipSummary, OperatorBreakdown, OperatorTotal } from '@/types/lumber'

// GET /api/lumber/rip-bonus/report - Get monthly rip bonus report
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || '0')
    const year = parseInt(searchParams.get('year') || '0')

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = month === 12 
      ? `${year + 1}-01-01`
      : `${year}-${(month + 1).toString().padStart(2, '0')}-01`

    // Get bonus parameters
    const bonusParams = await query(
      'SELECT * FROM lumber_bonus_parameters WHERE is_active = TRUE ORDER BY bf_min'
    )

    // Function to calculate bonus rate based on BF per hour
    const calculateBonusRate = (bfPerHour: number): number => {
      for (const param of bonusParams.rows) {
        if (bfPerHour >= param.bf_min && bfPerHour <= param.bf_max) {
          return param.bonus_amount
        }
      }
      return 0
    }

    // Get all work sessions for the month (team hours per day)
    const workSessions = await query(
      `SELECT *
       FROM lumber_work_sessions
       WHERE work_date >= $1 AND work_date < $2
       ORDER BY work_date`,
      [startDate, endDate]
    )

    // Get all finished regular packs for the month with operator/stacker info
    const packsResult = await query(
      `SELECT 
         p.*,
         lo_op.id as operator_user_id,
         lo_op.name as operator_name,
         lo_s1.id as stacker_1_user_id,
         lo_s1.name as stacker_1_name,
         lo_s2.id as stacker_2_user_id,
         lo_s2.name as stacker_2_name,
         lo_s3.id as stacker_3_user_id,
         lo_s3.name as stacker_3_name,
         lo_s4.id as stacker_4_user_id,
         lo_s4.name as stacker_4_name,
         DATE(p.finished_at) as finished_date,
         'rnr' as pack_type
       FROM lumber_packs p
       LEFT JOIN lumber_operators lo_op ON p.operator_id = lo_op.id
       LEFT JOIN lumber_operators lo_s1 ON p.stacker_1_id = lo_s1.id
       LEFT JOIN lumber_operators lo_s2 ON p.stacker_2_id = lo_s2.id
       LEFT JOIN lumber_operators lo_s3 ON p.stacker_3_id = lo_s3.id
       LEFT JOIN lumber_operators lo_s4 ON p.stacker_4_id = lo_s4.id
       WHERE p.is_finished = TRUE
         AND p.finished_at >= $1
         AND p.finished_at < $2
       ORDER BY p.finished_at`,
      [startDate, endDate]
    )

    // Get all finished misc packs for the month
    const miscPacksResult = await query(
      `SELECT 
         mp.*,
         lo_op.id as operator_user_id,
         lo_op.name as operator_name,
         lo_s1.id as stacker_1_user_id,
         lo_s1.name as stacker_1_name,
         lo_s2.id as stacker_2_user_id,
         lo_s2.name as stacker_2_name,
         lo_s3.id as stacker_3_user_id,
         lo_s3.name as stacker_3_name,
         lo_s4.id as stacker_4_user_id,
         lo_s4.name as stacker_4_name,
         DATE(mp.finished_at) as finished_date,
         'misc' as pack_type
       FROM misc_rip_packs mp
       LEFT JOIN lumber_operators lo_op ON mp.operator_id = lo_op.id
       LEFT JOIN lumber_operators lo_s1 ON mp.stacker_1_id = lo_s1.id
       LEFT JOIN lumber_operators lo_s2 ON mp.stacker_2_id = lo_s2.id
       LEFT JOIN lumber_operators lo_s3 ON mp.stacker_3_id = lo_s3.id
       LEFT JOIN lumber_operators lo_s4 ON mp.stacker_4_id = lo_s4.id
       WHERE mp.is_finished = TRUE
         AND mp.finished_at >= $1
         AND mp.finished_at < $2
       ORDER BY mp.finished_at`,
      [startDate, endDate]
    )

    // Combine regular and misc packs
    const allPacks = [...packsResult.rows, ...miscPacksResult.rows]
    
    // Debug logging
    console.log('Rip Bonus Report Debug:', {
      month, year,
      startDate, endDate,
      workSessionCount: workSessions.rows.length,
      regularPackCount: packsResult.rows.length,
      miscPackCount: miscPacksResult.rows.length,
      sampleWorkSession: workSessions.rows[0] || null,
      samplePack: packsResult.rows[0] || null
    })

    // Helper function to convert any date format to YYYY-MM-DD string
    const toDateString = (date: any): string => {
      if (!date) return ''
      // Try to create a Date object and format it
      const d = new Date(date)
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0]
      }
      // Fallback: try to extract date from string
      const str = String(date)
      if (str.includes('T')) {
        return str.split('T')[0]
      }
      return str
    }

    // Group packs by date (both regular and misc)
    const packsByDate: { [date: string]: any[] } = {}
    for (const pack of allPacks) {
      const dateStr = toDateString(pack.finished_date)
      if (!dateStr) continue
      
      if (!packsByDate[dateStr]) {
        packsByDate[dateStr] = []
      }
      packsByDate[dateStr].push(pack)
    }

    // Group work sessions by date
    const sessionsByDate: { [date: string]: any[] } = {}
    for (const session of workSessions.rows) {
      const dateStr = toDateString(session.work_date)
      if (!dateStr) continue
      
      if (!sessionsByDate[dateStr]) {
        sessionsByDate[dateStr] = []
      }
      sessionsByDate[dateStr].push(session)
    }
    
    // Debug: log the grouped dates
    console.log('Grouped dates:', {
      packDates: Object.keys(packsByDate),
      sessionDates: Object.keys(sessionsByDate)
    })

    // Calculate daily summaries
    const dailySummaries: DailyRipSummary[] = []
    const operatorTotalsMap: { [userId: number]: { user_name: string, total_rip_ft: number, total_bonus: number } } = {}

    // Threshold for qualifying as a major contributor (30% of daily BF)
    const QUALIFYING_THRESHOLD = 0.30

    // Also include days that have work sessions but no packs
    const allDates = new Set([...Object.keys(packsByDate), ...Object.keys(sessionsByDate)])
    
    for (const date of Array.from(allDates).sort()) {
      const packsForDay = packsByDate[date] || []
      const sessionsForDay = sessionsByDate[date] || []
      
      // Skip days with no packs (no BF to calculate)
      if (packsForDay.length === 0) continue
      
      const totalHours = sessionsForDay.reduce((sum, s) => sum + parseFloat(s.total_hours || '0'), 0)
      const totalBF = packsForDay.reduce((sum, p) => sum + parseFloat(p.actual_board_feet || '0'), 0)
      const bfPerHour = totalHours > 0 ? totalBF / totalHours : 0
      const bonusRate = calculateBonusRate(bfPerHour)

      // Step 1: Calculate each person's BF contribution for the day
      // Track two values per person:
      // - bf_touched: total BF of all packs they worked on (for qualification)
      // - bf_split: their split share of BF (for bonus distribution)
      const operatorContributions: { [userId: number]: { user_name: string, bf_touched: number, bf_split: number } } = {}
      
      for (const pack of packsForDay) {
        const contributors = []
        if (pack.operator_user_id) contributors.push({ id: pack.operator_user_id, name: pack.operator_name })
        if (pack.stacker_1_user_id) contributors.push({ id: pack.stacker_1_user_id, name: pack.stacker_1_name })
        if (pack.stacker_2_user_id) contributors.push({ id: pack.stacker_2_user_id, name: pack.stacker_2_name })
        if (pack.stacker_3_user_id) contributors.push({ id: pack.stacker_3_user_id, name: pack.stacker_3_name })
        if (pack.stacker_4_user_id) contributors.push({ id: pack.stacker_4_user_id, name: pack.stacker_4_name })
        
        const packBF = parseFloat(pack.actual_board_feet || '0')
        const bfPerContributor = contributors.length > 0 ? packBF / contributors.length : 0
        
        for (const contributor of contributors) {
          if (!operatorContributions[contributor.id]) {
            operatorContributions[contributor.id] = { user_name: contributor.name, bf_touched: 0, bf_split: 0 }
          }
          // bf_touched = total BF of packs they worked on (not split)
          operatorContributions[contributor.id].bf_touched += packBF
          // bf_split = their equal share of the BF
          operatorContributions[contributor.id].bf_split += bfPerContributor
        }
      }

      // Step 2: Count qualifying people (those who touched ≥30% of the day's total BF)
      // If someone works on every pack, they touched 100% of the daily BF
      const qualifyingPeopleCount = Object.values(operatorContributions).filter(
        data => totalBF > 0 && (data.bf_touched / totalBF) >= QUALIFYING_THRESHOLD
      ).length

      // Step 3: Calculate daily bonus pool
      // Daily Pool = Bonus Rate × Hours Worked × Number of Qualifying People
      const dailyBonusPool = bonusRate * totalHours * qualifyingPeopleCount

      // Step 4: Calculate total split BF (sum of all contributors' split shares)
      const totalSplitBF = Object.values(operatorContributions).reduce((sum, data) => sum + data.bf_split, 0)

      // Step 5: Calculate each person's share based on their percentage of split BF
      const operatorBreakdowns: OperatorBreakdown[] = []
      
      for (const [operatorIdStr, data] of Object.entries(operatorContributions)) {
        const operatorId = parseInt(operatorIdStr)
        // Percentage for bonus distribution is based on split share
        const percentage = totalSplitBF > 0 ? (data.bf_split / totalSplitBF) * 100 : 0
        const bonusAmount = totalSplitBF > 0 ? (data.bf_split / totalSplitBF) * dailyBonusPool : 0
        // Qualification percentage is based on touched BF (for display purposes)
        const touchedPercentage = totalBF > 0 ? (data.bf_touched / totalBF) * 100 : 0
        
        operatorBreakdowns.push({
          user_id: operatorId,
          user_name: data.user_name,
          bf_contributed: data.bf_split,
          percentage,
          bonus_amount: bonusAmount,
          touched_percentage: touchedPercentage
        })

        // Accumulate operator totals for monthly summary
        if (!operatorTotalsMap[operatorId]) {
          operatorTotalsMap[operatorId] = {
            user_name: data.user_name,
            total_rip_ft: 0,
            total_bonus: 0
          }
        }
        operatorTotalsMap[operatorId].total_rip_ft += data.bf_split
        operatorTotalsMap[operatorId].total_bonus += bonusAmount
      }

      dailySummaries.push({
        work_date: date,
        total_hours: totalHours,
        total_bf: totalBF,
        bf_per_hour: bfPerHour,
        bonus_rate: bonusRate,
        bonus_total: dailyBonusPool,
        qualifying_people: qualifyingPeopleCount,
        operator_breakdowns: operatorBreakdowns.sort((a, b) => b.bf_contributed - a.bf_contributed)
      })
    }

    // Convert operator totals map to array
    const operatorTotals: OperatorTotal[] = Object.entries(operatorTotalsMap).map(([userId, data]) => ({
      user_id: parseInt(userId),
      user_name: data.user_name,
      total_rip_ft: data.total_rip_ft,
      total_bonus: data.total_bonus
    })).sort((a, b) => b.total_rip_ft - a.total_rip_ft)

    // Calculate overall totals
    const totalHours = workSessions.rows.reduce((sum, s) => sum + parseFloat(s.total_hours || '0'), 0)
    const totalRnr = packsResult.rows.reduce((sum, p) => sum + parseFloat(p.actual_board_feet || '0'), 0)
    const totalMisc = miscPacksResult.rows.reduce((sum, p) => sum + parseFloat(p.actual_board_feet || '0'), 0)
    const totalBF = totalRnr + totalMisc
    const totalBonus = dailySummaries.reduce((sum, d) => sum + d.bonus_total, 0)

    const report: MonthlyRipReport = {
      month,
      year,
      daily_summaries: dailySummaries,
      total_hours: totalHours,
      total_rnr: totalRnr,
      total_misc: totalMisc,
      total_bf: totalBF,
      total_bonus: totalBonus,
      operator_totals: operatorTotals
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error generating rip bonus report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

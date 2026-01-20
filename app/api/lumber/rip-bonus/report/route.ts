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

    // Get all work sessions for the month
    const workSessions = await query(
      `SELECT 
         ws.*,
         u.full_name as user_name
       FROM lumber_work_sessions ws
       JOIN users u ON ws.user_id = u.id
       WHERE ws.work_date >= $1 AND ws.work_date < $2
       ORDER BY ws.work_date, u.full_name`,
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

    // Group packs by date (both regular and misc)
    const packsByDate: { [date: string]: any[] } = {}
    for (const pack of allPacks) {
      const date = pack.finished_date
      if (!packsByDate[date]) {
        packsByDate[date] = []
      }
      packsByDate[date].push(pack)
    }

    // Group work sessions by date
    const sessionsByDate: { [date: string]: any[] } = {}
    for (const session of workSessions.rows) {
      const date = session.work_date.toISOString().split('T')[0]
      if (!sessionsByDate[date]) {
        sessionsByDate[date] = []
      }
      sessionsByDate[date].push(session)
    }

    // Calculate daily summaries
    const dailySummaries: DailyRipSummary[] = []
    const operatorTotalsMap: { [userId: number]: { user_name: string, total_rip_ft: number, total_bonus: number } } = {}

    for (const date of Object.keys(packsByDate).sort()) {
      const packsForDay = packsByDate[date]
      const sessionsForDay = sessionsByDate[date] || []
      
      const totalHours = sessionsForDay.reduce((sum, s) => sum + parseFloat(s.total_hours), 0)
      const totalBF = packsForDay.reduce((sum, p) => sum + (p.actual_board_feet || 0), 0)
      const bfPerHour = totalHours > 0 ? totalBF / totalHours : 0
      const bonusRate = calculateBonusRate(bfPerHour)
      const bonusTotal = bonusRate * totalBF / 100 // Assuming bonus is per 100 BF

      // Calculate operator breakdowns
      const operatorContributions: { [userId: number]: { user_name: string, bf: number } } = {}
      
      for (const pack of packsForDay) {
        const contributors = []
        if (pack.operator_user_id) contributors.push({ id: pack.operator_user_id, name: pack.operator_name })
        if (pack.stacker_1_user_id) contributors.push({ id: pack.stacker_1_user_id, name: pack.stacker_1_name })
        if (pack.stacker_2_user_id) contributors.push({ id: pack.stacker_2_user_id, name: pack.stacker_2_name })
        if (pack.stacker_3_user_id) contributors.push({ id: pack.stacker_3_user_id, name: pack.stacker_3_name })
        if (pack.stacker_4_user_id) contributors.push({ id: pack.stacker_4_user_id, name: pack.stacker_4_name })
        
        const bfPerContributor = contributors.length > 0 ? (pack.actual_board_feet || 0) / contributors.length : 0
        
        for (const contributor of contributors) {
          if (!operatorContributions[contributor.id]) {
            operatorContributions[contributor.id] = { user_name: contributor.name, bf: 0 }
          }
          operatorContributions[contributor.id].bf += bfPerContributor
        }
      }

      const operatorBreakdowns: OperatorBreakdown[] = []
      
      for (const [userId, data] of Object.entries(operatorContributions)) {
        const percentage = totalBF > 0 ? (data.bf / totalBF) * 100 : 0
        const bonusAmount = (bonusTotal * percentage) / 100
        
        operatorBreakdowns.push({
          user_id: parseInt(userId),
          user_name: data.user_name,
          bf_contributed: data.bf,
          percentage,
          bonus_amount: bonusAmount
        })

        // Accumulate operator totals
        if (!operatorTotalsMap[parseInt(userId)]) {
          operatorTotalsMap[parseInt(userId)] = {
            user_name: data.user_name,
            total_rip_ft: 0,
            total_bonus: 0
          }
        }
        operatorTotalsMap[parseInt(userId)].total_rip_ft += data.bf
        operatorTotalsMap[parseInt(userId)].total_bonus += bonusAmount
      }

      dailySummaries.push({
        work_date: date,
        total_hours: totalHours,
        total_bf: totalBF,
        bf_per_hour: bfPerHour,
        bonus_rate: bonusRate,
        bonus_total: bonusTotal,
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
    const totalHours = workSessions.rows.reduce((sum, s) => sum + parseFloat(s.total_hours), 0)
    const totalRnr = packsResult.rows.reduce((sum, p) => sum + (p.actual_board_feet || 0), 0)
    const totalMisc = miscPacksResult.rows.reduce((sum, p) => sum + (p.actual_board_feet || 0), 0)
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

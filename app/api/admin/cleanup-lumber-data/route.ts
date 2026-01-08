import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST /api/admin/cleanup-lumber-data - Clean up problematic lumber data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body // 'fix_duplicates', 'delete_all', or 'fix_orphans'

    const report: any = {
      actions_taken: [],
      rows_affected: 0
    }

    await query('BEGIN')

    try {
      if (action === 'fix_duplicates' || action === 'all') {
        // Fix duplicate pack_ids by keeping only the first occurrence
        const result = await query(`
          DELETE FROM lumber_packs
          WHERE id IN (
            SELECT id
            FROM (
              SELECT id, 
                     ROW_NUMBER() OVER (PARTITION BY load_id, pack_id ORDER BY created_at) as rn
              FROM lumber_packs
            ) t
            WHERE rn > 1
          )
          RETURNING *
        `)
        
        report.actions_taken.push({
          action: 'Removed duplicate packs',
          rows_deleted: result.rows.length
        })
        report.rows_affected += result.rows.length
      }

      if (action === 'fix_orphans' || action === 'all') {
        // Delete orphaned load items
        const orphanedItems = await query(`
          DELETE FROM lumber_load_items
          WHERE id IN (
            SELECT li.id
            FROM lumber_load_items li
            LEFT JOIN lumber_loads l ON li.load_id = l.id
            WHERE l.id IS NULL
          )
          RETURNING *
        `)
        
        report.actions_taken.push({
          action: 'Removed orphaned load items',
          rows_deleted: orphanedItems.rows.length
        })
        report.rows_affected += orphanedItems.rows.length

        // Delete orphaned packs (CASCADE should handle this, but just in case)
        const orphanedPacks = await query(`
          DELETE FROM lumber_packs
          WHERE id IN (
            SELECT p.id
            FROM lumber_packs p
            LEFT JOIN lumber_load_items li ON p.load_item_id = li.id
            WHERE li.id IS NULL
          )
          RETURNING *
        `)
        
        report.actions_taken.push({
          action: 'Removed orphaned packs',
          rows_deleted: orphanedPacks.rows.length
        })
        report.rows_affected += orphanedPacks.rows.length
      }

      if (action === 'delete_all') {
        // Nuclear option - delete all lumber data (but keep tables)
        const tables = [
          'lumber_packs',
          'lumber_load_documents', 
          'lumber_load_items',
          'lumber_loads',
          'lumber_work_sessions',
          'lumber_trucking_notes',
          'lumber_supplier_locations',
          'lumber_suppliers',
          'lumber_drivers'
        ]

        for (const table of tables) {
          try {
            const result = await query(`TRUNCATE TABLE ${table} CASCADE`)
            report.actions_taken.push({
              action: `Truncated ${table}`,
              status: 'success'
            })
          } catch (e: any) {
            // Table might not exist yet
            report.actions_taken.push({
              action: `Truncated ${table}`,
              status: 'skipped',
              reason: e.message
            })
          }
        }
      }

      await query('COMMIT')

      report.success = true
      report.message = `✅ Cleanup completed - ${report.rows_affected} rows affected`

      return NextResponse.json(report)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error: any) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed', 
      details: error.message 
    }, { status: 500 })
  }
}

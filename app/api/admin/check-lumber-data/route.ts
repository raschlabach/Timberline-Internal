import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/admin/check-lumber-data - Check existing lumber data for issues
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    const report: any = {
      tables: [],
      issues: [],
      warnings: [],
      safe_to_migrate: true
    }

    // Check which lumber tables exist
    const existingTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'lumber_%'
      ORDER BY table_name
    `)

    if (existingTables.rows.length === 0) {
      report.message = '✅ No existing lumber tables - clean slate!'
      report.safe_to_migrate = true
      return NextResponse.json(report)
    }

    report.tables = existingTables.rows.map(t => t.table_name)

    // Check for data in each table
    for (const table of existingTables.rows) {
      const tableName = table.table_name
      const count = await query(`SELECT COUNT(*) as count FROM ${tableName}`)
      const rowCount = parseInt(count.rows[0].count)
      
      report[tableName] = {
        exists: true,
        row_count: rowCount
      }
    }

    // CRITICAL CHECK: Look for duplicate pack_ids within loads
    if (report.tables.includes('lumber_packs')) {
      const duplicates = await query(`
        SELECT load_id, pack_id, COUNT(*) as duplicate_count
        FROM lumber_packs
        GROUP BY load_id, pack_id
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC
      `)

      if (duplicates.rows.length > 0) {
        report.issues.push({
          severity: 'HIGH',
          table: 'lumber_packs',
          issue: 'Duplicate pack_ids found within loads',
          count: duplicates.rows.length,
          details: duplicates.rows.slice(0, 10), // Show first 10
          fix: 'Run the cleanup endpoint to remove duplicates'
        })
        report.safe_to_migrate = false
      }

      // Check if unique constraint exists
      const constraints = await query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'lumber_packs'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'unique_pack_per_load'
      `)

      if (constraints.rows.length === 0) {
        report.warnings.push({
          severity: 'MEDIUM',
          table: 'lumber_packs',
          warning: 'Missing unique constraint on (load_id, pack_id)',
          fix: 'Migration will add this constraint'
        })
      }
    }

    // Check for orphaned data (items without loads, packs without items, etc.)
    if (report.tables.includes('lumber_load_items') && report.tables.includes('lumber_loads')) {
      const orphanedItems = await query(`
        SELECT COUNT(*) as count
        FROM lumber_load_items li
        LEFT JOIN lumber_loads l ON li.load_id = l.id
        WHERE l.id IS NULL
      `)
      
      const orphanCount = parseInt(orphanedItems.rows[0].count)
      if (orphanCount > 0) {
        report.warnings.push({
          severity: 'LOW',
          table: 'lumber_load_items',
          warning: `Found ${orphanCount} orphaned load items (no parent load)`,
          fix: 'These will be ignored or can be cleaned up'
        })
      }
    }

    if (report.tables.includes('lumber_packs') && report.tables.includes('lumber_load_items')) {
      const orphanedPacks = await query(`
        SELECT COUNT(*) as count
        FROM lumber_packs p
        LEFT JOIN lumber_load_items li ON p.load_item_id = li.id
        WHERE li.id IS NULL
      `)
      
      const orphanCount = parseInt(orphanedPacks.rows[0].count)
      if (orphanCount > 0) {
        report.warnings.push({
          severity: 'LOW',
          table: 'lumber_packs',
          warning: `Found ${orphanCount} orphaned packs (no parent load item)`,
          fix: 'These will be cleaned up by cascade deletes'
        })
      }
    }

    // Summary
    if (report.safe_to_migrate) {
      report.message = '✅ Data looks clean - safe to run migration'
    } else {
      report.message = '⚠️ Issues found - run cleanup before migration'
    }

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('Check error:', error)
    return NextResponse.json({ 
      error: 'Check failed', 
      details: error.message 
    }, { status: 500 })
  }
}

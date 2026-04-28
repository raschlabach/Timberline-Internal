import { query } from './index'

const columnCache = new Map<string, Set<string>>()

export async function tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
  let columns = columnCache.get(tableName)

  if (!columns) {
    const result = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `, [tableName])

    columns = new Set(result.rows.map((r: any) => r.column_name))
    columnCache.set(tableName, columns)
  }

  return columns.has(columnName)
}

export async function tableExists(tableName: string): Promise<boolean> {
  if (columnCache.has(tableName)) return true

  const result = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    )
  `, [tableName])

  return result.rows[0].exists
}

export function invalidateTableCache(tableName: string) {
  columnCache.delete(tableName)
}

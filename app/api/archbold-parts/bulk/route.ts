import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

export async function POST(request: NextRequest) {
  const client = await getClient()
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parts: Array<{ item_code: string; width: number | null; length: number | null; used_for: string | null }> = body.parts

    if (!Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'No parts provided' }, { status: 400 })
    }

    const existingResult = await query('SELECT item_code FROM archbold_parts')
    const existingCodes = new Set(existingResult.rows.map((r: { item_code: string }) => r.item_code.toLowerCase()))

    const toCreate = parts.filter(p => p.item_code && !existingCodes.has(p.item_code.toLowerCase()))

    const seenCodes = new Set<string>()
    const deduplicated = toCreate.filter(p => {
      const key = p.item_code.toLowerCase()
      if (seenCodes.has(key)) return false
      seenCodes.add(key)
      return true
    })

    if (deduplicated.length === 0) {
      return NextResponse.json({ created: 0, skipped: parts.length, parts: [] })
    }

    await client.query('BEGIN')

    const created = []
    for (const part of deduplicated) {
      const result = await client.query(
        `INSERT INTO archbold_parts (item_code, width, length, used_for)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_code, width, length, used_for`,
        [part.item_code, part.width, part.length, part.used_for]
      )
      created.push(result.rows[0])
    }

    await client.query('COMMIT')

    return NextResponse.json({
      created: created.length,
      skipped: parts.length - created.length,
      parts: created,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error bulk creating archbold parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
}

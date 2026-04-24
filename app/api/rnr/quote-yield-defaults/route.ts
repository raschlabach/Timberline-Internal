import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const species = searchParams.get('species')
    const grade = searchParams.get('grade')

    if (species && grade) {
      const result = await query(
        `SELECT id, species, grade, yield_percent FROM rnr_yield_defaults WHERE species = $1 AND grade = $2`,
        [species, grade]
      )
      return NextResponse.json(result.rows[0] || null)
    }

    const result = await query(
      `SELECT id, species, grade, yield_percent, created_at, updated_at
       FROM rnr_yield_defaults
       ORDER BY species ASC, grade ASC`
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    console.error('Error fetching yield defaults:', error)
    return NextResponse.json({ error: 'Failed to fetch yield defaults' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await request.json()

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      for (const row of rows) {
        if (!row.species || !row.grade || row.yield_percent == null) continue

        await client.query(
          `INSERT INTO rnr_yield_defaults (species, grade, yield_percent)
           VALUES ($1, $2, $3)
           ON CONFLICT (species, grade)
           DO UPDATE SET yield_percent = $3, updated_at = NOW()`,
          [row.species, row.grade, row.yield_percent]
        )
      }

      await client.query('COMMIT')

      const result = await query(
        `SELECT id, species, grade, yield_percent, created_at, updated_at
         FROM rnr_yield_defaults
         ORDER BY species ASC, grade ASC`
      )

      return NextResponse.json(result.rows)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error updating yield defaults:', error)
    return NextResponse.json({ error: 'Failed to update yield defaults' }, { status: 500 })
  }
}

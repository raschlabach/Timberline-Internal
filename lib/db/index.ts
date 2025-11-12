import { Pool } from 'pg'
import type { PoolClient, QueryResult } from 'pg'

import fs from 'fs'
import path from 'path'

const isProduction = process.env.NODE_ENV === 'production'
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

const PREVIEW_URL = process.env.DB_CONNECTION_STRING_PREVIEW || process.env.DATABASE_URL || ''
const MAIN_URL = process.env.DB_CONNECTION_STRING_MAIN || process.env.DATABASE_URL || ''
const RAW_URL = isProduction ? (MAIN_URL || PREVIEW_URL) : (PREVIEW_URL || MAIN_URL)
const HAS_CONNECTION_STRING = Boolean(RAW_URL)

if (!HAS_CONNECTION_STRING && !isBuildPhase) {
  throw new Error('Missing DB envs. Set DB_CONNECTION_STRING_PREVIEW and/or DB_CONNECTION_STRING_MAIN or DATABASE_URL.')
}

if (!process.env.DATABASE_URL && RAW_URL) {
  process.env.DATABASE_URL = RAW_URL
}

function parseConnectionString(connectionString: string) {
  const url = new URL(connectionString)
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  }
}

const connectionConfig = HAS_CONNECTION_STRING ? parseConnectionString(RAW_URL) : null

const CONNECTION_TIMEOUT_MS = 10000
const IDLE_TIMEOUT_MS = 30000
const MAX_POOL_SIZE = 20

let pool: Pool | null = null
let migrationsRun = false

export async function runMigrations() {
  if (migrationsRun) return
  const pool = createPool()
  if (!pool) {
    if (isBuildPhase) return
    throw new Error('Database pool not available for migrations.')
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) NOT NULL DEFAULT 'success',
      error_message TEXT
    );
  `)
  const { rows: applied } = await pool.query('SELECT name, status FROM migrations')
  const appliedSet = new Set(applied.filter(m => m.status === 'success').map(m => m.name))

  const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (appliedSet.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO migrations (name, status) VALUES ($1, $2)', [file, 'success'])
      await pool.query('COMMIT')
    } catch (e: any) {
      await pool.query('ROLLBACK')
      await pool.query('INSERT INTO migrations (name, status, error_message) VALUES ($1, $2, $3)', [file, 'failed', e?.message ?? String(e)])
      throw e
    }
  }
  migrationsRun = true
}

function createPool() {
  if (pool) return pool
  if (!connectionConfig) {
    if (!isBuildPhase) {
      throw new Error('Database connection configuration unavailable.')
    }
    return null
  }

  pool = new Pool({
    ...connectionConfig,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    max: MAX_POOL_SIZE,
  })
  pool.on('error', (err) => {
    console.error('Idle client error', err)
    pool = null
  })
  return pool
}

export async function query(text: string, params: any[] = [], retry = 0): Promise<QueryResult<any>> {
  const start = Date.now()
  try {
    const p = createPool()
    if (!p) {
      if (isBuildPhase) {
        console.warn('Database query skipped during build phase', { text: text.slice(0, 60) })
        const lower = text.toLowerCase()
        const isCountQuery = lower.includes('count(')
        const stubRows = isCountQuery ? [{ count: '0' }] : []
        const stubRowCount = isCountQuery ? 1 : 0
        return {
          rows: stubRows,
          rowCount: stubRowCount,
          command: 'SKIPPED',
          fields: [],
        } as unknown as QueryResult<any>
      }
      throw new Error('Database pool not initialized')
    }
    const res = await p.query(text, params)
    const dur = Date.now() - start
    if (dur > 100) console.log('Slow query', { text: text.slice(0, 60), dur, rows: res.rowCount })
    return res
  } catch (err: any) {
    const transient = ['ECONNREFUSED','ETIMEDOUT','08006','08001'].includes(err?.code)
    if (transient && retry < 2) {
      pool = null
      await new Promise(r => setTimeout(r, Math.pow(2, retry) * 500))
      return query(text, params, retry + 1)
    }
    throw err
  }
}

export async function getClient() {
  const p = createPool()
  if (!p) {
    if (isBuildPhase) {
      throw new Error('Database client unavailable during build phase.')
    }
    throw new Error('Database pool not initialized')
  }
  return p.connect()
}

export async function withTransaction<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = createPool()
  if (!p) {
    if (isBuildPhase) {
      throw new Error('Transactions are unavailable during build phase.')
    }
    throw new Error('Database pool not initialized')
  }
  const client = await p.connect()
  try {
    await client.query('BEGIN')
    const result = await cb(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}


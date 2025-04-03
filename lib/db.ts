import { sql } from '@vercel/postgres'
import { query, getClient, withTransaction } from './db/index'
import { Pool } from 'pg'

export { sql, query, getClient, withTransaction }

let pool: Pool | null = null

// Parse connection string to explicit config
function parseConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    return {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: url.pathname.slice(1),
      ssl: true
    }
  } catch (error) {
    console.error('Error parsing connection string:', error)
    throw error
  }
}

// Database configuration
const config = {
  preview: parseConnectionString("postgresql://neondb_owner:npg_D5hj1egPlAok@ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech/neondb?sslmode=require"),
  main: parseConnectionString("postgresql://neondb_owner:npg_D5hj1egPlAok@ep-calm-frog-a8qxyo8o-pooler.eastus2.azure.neon.tech/neondb?sslmode=require")
}

// Determine which database branch to use based on environment
const isProduction = process.env.NODE_ENV === 'production'
const branch = isProduction ? 'main' : 'preview'

export function getPool() {
  if (!pool) {
    const branchConfig = config[branch]
    pool = new Pool({
      ...branchConfig,
      ssl: {
        rejectUnauthorized: true
      }
    })

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
      // Reset pool on error
      pool = null
    })

    // Add connection logging
    pool.on('connect', () => {
      console.log('New database connection established')
    })

    pool.on('acquire', () => {
      console.log('Client acquired from pool')
    })

    pool.on('remove', () => {
      console.log('Client removed from pool')
    })
  }
  return pool
}

export async function dbQuery(text: string, params?: any[]) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

// Clean up function for tests
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// Helper function to check database connection
export async function checkDatabaseConnection() {
  try {
    await sql`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection error:', error)
    return false
  }
} 
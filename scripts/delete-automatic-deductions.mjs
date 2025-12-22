import { Pool } from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const isProduction = process.env.NODE_ENV === 'production'
const PREVIEW_URL = process.env.DB_CONNECTION_STRING_PREVIEW || process.env.DATABASE_URL || ''
const MAIN_URL = process.env.DB_CONNECTION_STRING_MAIN || process.env.DATABASE_URL || ''
const RAW_URL = isProduction ? (MAIN_URL || PREVIEW_URL) : (PREVIEW_URL || MAIN_URL)

if (!RAW_URL) {
  console.error('Error: Missing database connection string. Set DB_CONNECTION_STRING_PREVIEW or DATABASE_URL.')
  process.exit(1)
}

function parseConnectionString(connectionString) {
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

const connectionConfig = parseConnectionString(RAW_URL)
const usingPreview = RAW_URL === PREVIEW_URL && PREVIEW_URL !== ''
console.log(`[DB] Using ${usingPreview ? 'PREVIEW' : 'MAIN'} database: ${connectionConfig.database}`)

const pool = new Pool({
  ...connectionConfig,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
})

async function deleteAutomaticDeductions() {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // First, count how many automatic deductions exist
    const countResult = await client.query(`
      SELECT COUNT(*) as count
      FROM cross_driver_freight_deductions
      WHERE is_manual = false
    `)
    
    const count = parseInt(countResult.rows[0].count)
    console.log(`Found ${count} automatic deductions to delete.`)
    
    if (count === 0) {
      console.log('No automatic deductions found. Nothing to delete.')
      await client.query('ROLLBACK')
      return
    }
    
    // Delete all automatic deductions
    const deleteResult = await client.query(`
      DELETE FROM cross_driver_freight_deductions
      WHERE is_manual = false
    `)
    
    await client.query('COMMIT')
    
    console.log(`Successfully deleted ${deleteResult.rowCount} automatic deduction(s).`)
    console.log('Script completed successfully.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

deleteAutomaticDeductions()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

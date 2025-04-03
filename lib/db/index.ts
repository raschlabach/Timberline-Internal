import { Pool } from 'pg'

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

console.log(`Using database branch: ${branch}`);
console.log('Database config:', {
  host: config[branch].host,
  port: config[branch].port,
  database: config[branch].database,
  user: config[branch].user,
  // password is masked for security
  ssl: config[branch].ssl
});

// Connection pool settings
const CONNECTION_TIMEOUT_MS = 10000
const IDLE_TIMEOUT_MS = 30000
const MAX_POOL_SIZE = 20
const CONNECTION_RETRY_ATTEMPTS = 3
const CONNECTION_RETRY_DELAY_MS = 1000

// Create a connection pool with enhanced settings
let pool: Pool | null = null

// Migration SQL
const MIGRATIONS = [
  `
  -- Fix stack columns in trailer_layout_items
  ALTER TABLE trailer_layout_items
  DROP CONSTRAINT IF EXISTS fk_trailer_layout_items_stack;

  ALTER TABLE trailer_layout_items
  DROP CONSTRAINT IF EXISTS check_stack_position;

  ALTER TABLE trailer_layout_items
  DROP CONSTRAINT IF EXISTS check_stack_id_vinyl;

  -- Ensure the columns exist with correct types
  ALTER TABLE trailer_layout_items
  DROP COLUMN IF EXISTS stack_id;

  ALTER TABLE trailer_layout_items
  DROP COLUMN IF EXISTS stack_position;

  ALTER TABLE trailer_layout_items
  ADD COLUMN stack_id INTEGER,
  ADD COLUMN stack_position INTEGER;

  -- Add index for stack-related queries
  DROP INDEX IF EXISTS idx_layout_items_stack;
  CREATE INDEX idx_layout_items_stack ON trailer_layout_items(stack_id, stack_position);

  -- Add constraint to ensure stack_position is positive when present
  ALTER TABLE trailer_layout_items
  ADD CONSTRAINT check_stack_position 
  CHECK (stack_position IS NULL OR stack_position > 0);

  -- Add constraint to ensure stack_id and stack_position are used together
  ALTER TABLE trailer_layout_items
  ADD CONSTRAINT check_stack_consistency
  CHECK (
      (stack_id IS NULL AND stack_position IS NULL) OR
      (stack_id IS NOT NULL AND stack_position IS NOT NULL)
  );
  `
]

async function runMigrations(pool: Pool) {
  try {
    console.log('Running database migrations...')
    for (const migration of MIGRATIONS) {
      await pool.query(migration)
    }
    console.log('Database migrations completed successfully')
  } catch (error) {
    console.error('Error running migrations:', error)
    throw error
  }
}

function createPool() {
  if (pool) return pool;

  try {
    const branchConfig = config[branch]
    if (!branchConfig) {
      throw new Error(`No configuration found for branch: ${branch}`)
    }

    pool = new Pool({
      ...branchConfig,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      max: MAX_POOL_SIZE,
      // Force SSL mode
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

    // Run migrations
    runMigrations(pool).catch(error => {
      console.error('Failed to run migrations:', error)
      pool = null
      throw error
    })

    return pool
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Error initializing database pool for ${branch} branch:`, errorMessage)
    throw new Error(`Database connection error: ${errorMessage}`)
  }
}

/**
 * Execute a SQL query on the database with retry logic
 */
export async function query(text: string, params: any[] = [], retryCount = 0) {
  const MAX_RETRIES = 2
  const start = Date.now()
  
  try {
    const currentPool = createPool()
    if (!currentPool) {
      throw new Error('Database pool not initialized')
    }
    
    const res = await currentPool.query(text, params)
    const duration = Date.now() - start
    
    // Only log if query took longer than 100ms for performance monitoring
    if (duration > 100) {
      console.log('Slow query detected', { 
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
        duration, 
        rows: res.rowCount 
      })
    }
    
    return res
  } catch (error: any) {
    const duration = Date.now() - start
    
    // Retry on connection errors, but not on syntax or constraint errors
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                             error.code === 'ETIMEDOUT' || 
                             error.code === '08006' || // connection_failure
                             error.code === '08001';   // unable_to_connect
    
    if (isConnectionError && retryCount < MAX_RETRIES) {
      console.warn(`Database connection error, retrying (${retryCount + 1}/${MAX_RETRIES})...`)
      // Reset pool on connection error
      pool = null
      // Exponential backoff
      const delay = Math.pow(2, retryCount) * 500
      await new Promise(resolve => setTimeout(resolve, delay))
      return query(text, params, retryCount + 1)
    }
    
    console.error('Error executing query', { 
      text: text.substring(0, 100), 
      error: error.message,
      duration,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    })
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  const currentPool = createPool()
  if (!currentPool) {
    throw new Error('Database pool not initialized')
  }
  
  try {
    const client = await currentPool.connect()
    return client
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error getting database client:', errorMessage)
    throw new Error(`Failed to get database client: ${errorMessage}`)
  }
}

/**
 * Convenient wrapper for transactions
 */
export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const currentPool = createPool()
  if (!currentPool) {
    throw new Error('Database pool not initialized')
  }
  
  const client = await currentPool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Transaction error:', error)
    throw error
  } finally {
    client.release()
  }
} 
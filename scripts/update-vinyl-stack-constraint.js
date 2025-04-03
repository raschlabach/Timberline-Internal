const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Load database config
const config = require('../database/config')

// Use preview branch for development
const branch = process.env.NODE_ENV === 'production' ? 'main' : 'preview'

// Create a connection pool
const pool = new Pool(config[branch])

async function query(text, params = []) {
  try {
    const res = await pool.query(text, params)
    return res
  } catch (error) {
    console.error('Error executing query:', error)
    throw error
  }
}

async function applyMigration() {
  try {
    console.log('Starting vinyl stacks constraint update...')
    console.log(`Using database branch: ${branch}`)
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'update-vinyl-stack-constraint.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    
    // Start transaction
    await query('BEGIN')
    
    try {
      // Apply the migration
      await query(migrationSql)
      
      // Commit the transaction
      await query('COMMIT')
      console.log('Migration completed successfully')
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK')
      throw error
    } finally {
      // Close the pool
      await pool.end()
    }
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  }
}

// Run the migration
applyMigration() 
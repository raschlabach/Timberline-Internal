#!/usr/bin/env node

/**
 * Script to run database migrations manually
 * 
 * Usage:
 *   node scripts/run-migrations.js [preview|main]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  preview: {
    user: 'neondb_owner',
    password: 'npg_D5hj1egPlAok',
    host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
    port: 5432,
    database: 'neondb',
    ssl: {
      rejectUnauthorized: true
    }
  }
};

async function runMigration(pool, migrationFile) {
  try {
    console.log(`Running migration: ${migrationFile}`);
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    console.log(`✅ Migration ${migrationFile} completed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    throw error;
  }
}

async function runMigrations() {
  const pool = new Pool(config.preview);
  
  try {
    console.log('Starting database migrations...');
    
    // Run migrations in order
    const migrations = [
      '20240402_add_layout_type.sql',
      '20240403_consolidate_layout_items.sql'
    ];
    
    for (const migration of migrations) {
      await runMigration(pool, migration);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigrations();

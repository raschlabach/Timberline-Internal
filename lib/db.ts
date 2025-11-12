/**
 * Database Module - Main Export
 * 
 * This module serves as the primary entry point for database operations throughout the application.
 * It re-exports all database functions from './db/index' which contains the actual implementation.
 * 
 * Architecture:
 * - lib/db/index.ts: Core implementation with connection pooling, migrations, and query functions
 * - lib/db.ts (this file): Public API that re-exports functions and adds Vercel Postgres support
 * 
 * Usage:
 * - API routes should import from '@/lib/db'
 * - Use query() for simple queries
 * - Use getClient() for transactions
 * - Use withTransaction() for automatic transaction management
 * 
 * Database Branch Selection:
 * - Development (NODE_ENV !== 'production'): Uses 'preview' branch
 * - Production (NODE_ENV === 'production'): Uses 'main' branch
 */

import { sql } from '@vercel/postgres'
import { query, getClient, withTransaction } from './db/index'

// Re-export all database functions from the core implementation
export { sql, query, getClient, withTransaction }

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
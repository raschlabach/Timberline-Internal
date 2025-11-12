#!/usr/bin/env node

/**
 * Script to check the status of the preview database
 * 
 * Usage:
 *   node scripts/check-db-status.js
 */

const { Pool } = require('pg');

// Database configuration for preview branch
const config = {
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: {
    rejectUnauthorized: true
  }
};

async function checkDatabaseStatus() {
  console.log('🔍 Checking Preview Database Status...\n');
  
  const pool = new Pool(config);
  
  try {
    // Check if we can connect
    console.log('📡 Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful');
    console.log(`   Current time: ${connectionTest.rows[0].current_time}\n`);
    
    // Check all tables exist
    console.log('📋 Checking table structure...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`✅ Found ${tables.rows.length} tables:`);
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log('');
    
    // Check data counts
    console.log('📊 Checking data counts...');
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM customers) as customers_count,
        (SELECT COUNT(*) FROM orders) as orders_count,
        (SELECT COUNT(*) FROM truckloads) as truckloads_count,
        (SELECT COUNT(*) FROM drivers) as drivers_count,
        (SELECT COUNT(*) FROM locations) as locations_count
    `);
    
    const data = counts.rows[0];
    console.log('✅ Data counts:');
    console.log(`   - Users: ${data.users_count}`);
    console.log(`   - Customers: ${data.customers_count}`);
    console.log(`   - Orders: ${data.orders_count}`);
    console.log(`   - Truckloads: ${data.truckloads_count}`);
    console.log(`   - Drivers: ${data.drivers_count}`);
    console.log(`   - Locations: ${data.locations_count}`);
    console.log('');
    
    // Check for any issues
    console.log('🔧 Checking for potential issues...');
    
    // Check if Timberline warehouse exists
    const warehouse = await pool.query(`
      SELECT COUNT(*) as count 
      FROM locations 
      WHERE is_timberline_warehouse = true
    `);
    
    if (warehouse.rows[0].count === '0') {
      console.log('⚠️  Warning: Timberline warehouse location not found');
    } else {
      console.log('✅ Timberline warehouse location exists');
    }
    
    // Check for orders without assignments
    const unassignedOrders = await pool.query(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE status = 'unassigned'
    `);
    
    console.log(`✅ Unassigned orders: ${unassignedOrders.rows[0].count}`);
    
    // Check for active truckloads
    const activeTruckloads = await pool.query(`
      SELECT COUNT(*) as count 
      FROM truckloads 
      WHERE is_completed = false
    `);
    
    console.log(`✅ Active truckloads: ${activeTruckloads.rows[0].count}`);
    console.log('');
    
    console.log('🎉 Preview Database Status: EXCELLENT!');
    console.log('   Your preview database is ready for development and testing.');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();

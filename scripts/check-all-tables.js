const { Pool } = require('pg');

// Database configuration for Neon
const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function checkAllTables() {
  const client = await pool.connect();
  try {
    // Get all tables and their column counts
    const { rows: tables } = await client.query(`
      SELECT 
        table_name,
        COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      ORDER BY column_count DESC
    `);

    console.log('Table column counts:');
    tables.forEach(table => {
      console.log(`${table.table_name}: ${table.column_count} columns`);
    });

  } catch (error) {
    console.error('Error checking tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

checkAllTables()
  .then(() => {
    console.log('Table check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to check tables:', error);
    process.exit(1);
  }); 
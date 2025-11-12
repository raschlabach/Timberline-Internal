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

async function checkTableSchema() {
  const client = await pool.connect();
  try {
    // Get column count for trailer_layout_items
    const { rows: [columnCount] } = await client.query(`
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'trailer_layout_items'
    `);

    // Get all columns for trailer_layout_items
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'trailer_layout_items'
      ORDER BY ordinal_position
    `);

    console.log('Column count:', columnCount.column_count);
    console.log('\nColumns:');
    columns.forEach(col => {
      console.log(`${col.column_name} (${col.data_type})`);
    });

  } catch (error) {
    console.error('Error checking schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

checkTableSchema()
  .then(() => {
    console.log('Schema check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to check schema:', error);
    process.exit(1);
  }); 
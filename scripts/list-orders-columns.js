const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_D5hj1egPlAok',
  ssl: true
});

async function listOrderColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    console.log('Columns in orders table:');
    console.table(result.rows);
    console.log(`\nTotal columns: ${result.rows.length}`);
  } catch (error) {
    console.error('Error listing columns:', error);
  } finally {
    await pool.end();
  }
}

listOrderColumns(); 
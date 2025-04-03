const { Pool } = require('pg');
const config = require('../database/config');

const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Invalid branch. Use "preview" or "main"');
  process.exit(1);
}

console.log(`Checking schema in ${branch} branch...`);

const pool = new Pool({
  ...config[branch],
  ssl: true
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    // Check if tables exist
    const tables = ['order_presets', 'preset_skids', 'preset_links'];
    for (const table of tables) {
      console.log(`\nChecking table: ${table}`);
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      
      if (result.rows.length === 0) {
        console.error(`Table ${table} does not exist!`);
      } else {
        console.log('Columns:');
        result.rows.forEach(row => {
          console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
      }

      // Check for indexes
      const indexResult = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1;
      `, [table]);

      console.log('\nIndexes:');
      indexResult.rows.forEach(row => {
        console.log(`  ${row.indexname}: ${row.indexdef}`);
      });
    }

    // Check for sample data
    const dataResult = await client.query('SELECT COUNT(*) FROM order_presets');
    console.log('\nData count:', dataResult.rows[0].count);

  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema().catch(error => {
  console.error('Error checking schema:', error);
  process.exit(1);
}); 
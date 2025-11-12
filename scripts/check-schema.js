const { Pool } = require('pg');

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

async function checkSchema() {
  const pool = new Pool(config.preview);
  
  try {
    console.log('Checking trailer_layouts table...');
    
    // Check trailer_layouts table
    const layoutTable = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trailer_layouts' 
      ORDER BY ordinal_position
    `);
    
    console.log('trailer_layouts columns:');
    layoutTable.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\nChecking trailer_layout_items table...');
    
    // Check trailer_layout_items table
    const itemsTable = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trailer_layout_items' 
      ORDER BY ordinal_position
    `);
    
    console.log('trailer_layout_items columns:');
    itemsTable.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema(); 
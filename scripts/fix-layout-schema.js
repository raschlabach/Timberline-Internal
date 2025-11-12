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

async function fixLayoutSchema() {
  const pool = new Pool(config.preview);
  
  try {
    console.log('🔧 Fixing layout schema...');
    
    // Step 1: Add layout_type to trailer_layouts
    console.log('1. Adding layout_type column to trailer_layouts...');
    try {
      await pool.query(`
        ALTER TABLE trailer_layouts 
        ADD COLUMN layout_type VARCHAR(20) DEFAULT 'delivery'
      `);
      console.log('✅ Added layout_type column');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ layout_type column already exists');
      } else {
        throw error;
      }
    }
    
    // Step 2: Add stack_id to trailer_layout_items
    console.log('2. Adding stack_id column to trailer_layout_items...');
    try {
      await pool.query(`
        ALTER TABLE trailer_layout_items 
        ADD COLUMN stack_id INTEGER
      `);
      console.log('✅ Added stack_id column');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ stack_id column already exists');
      } else {
        throw error;
      }
    }
    
    // Step 3: Add stack_position to trailer_layout_items
    console.log('3. Adding stack_position column to trailer_layout_items...');
    try {
      await pool.query(`
        ALTER TABLE trailer_layout_items 
        ADD COLUMN stack_position INTEGER
      `);
      console.log('✅ Added stack_position column');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ stack_position column already exists');
      } else {
        throw error;
      }
    }
    
    // Step 4: Create indexes
    console.log('4. Creating indexes...');
    try {
      await pool.query(`
        CREATE INDEX idx_trailer_layouts_type 
        ON trailer_layouts(layout_type)
      `);
      console.log('✅ Created layout_type index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ layout_type index already exists');
      } else {
        console.log('⚠️ Could not create layout_type index:', error.message);
      }
    }
    
    try {
      await pool.query(`
        CREATE INDEX idx_layout_items_stack 
        ON trailer_layout_items(stack_id, stack_position)
      `);
      console.log('✅ Created stack index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ stack index already exists');
      } else {
        console.log('⚠️ Could not create stack index:', error.message);
      }
    }
    
    console.log('✅ Layout schema fixed successfully!');
    
    // Verify the schema
    console.log('\n📋 Verifying schema...');
    const layoutColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trailer_layouts' 
      ORDER BY ordinal_position
    `);
    
    console.log('trailer_layouts columns:');
    layoutColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    const itemsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trailer_layout_items' 
      ORDER BY ordinal_position
    `);
    
    console.log('\ntrailer_layout_items columns:');
    itemsColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
  } finally {
    await pool.end();
  }
}

fixLayoutSchema();

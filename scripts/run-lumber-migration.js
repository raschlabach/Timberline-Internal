const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL or POSTGRES_URL environment variable found');
    console.error('   Please set your database connection string');
    process.exit(1);
  }

  console.log('🔍 Checking database connection...');
  console.log(`   Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}`);
  console.log('');

  const sql = neon(databaseUrl);

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await sql`SELECT NOW()`;
    console.log('✅ Database connection successful!\n');

    // Check if lumber tables already exist
    console.log('🔍 Checking for existing lumber tables...');
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'lumber_%'
      ORDER BY table_name
    `;

    if (existingTables.length > 0) {
      console.log('⚠️  WARNING: Found existing lumber tables:');
      existingTables.forEach(t => console.log(`   - ${t.table_name}`));
      console.log('');
      console.log('   This migration uses CREATE TABLE IF NOT EXISTS, so it will:');
      console.log('   ✓ Skip tables that already exist');
      console.log('   ✓ Create any missing tables');
      console.log('   ✓ Add the UNIQUE constraint on (load_id, pack_id) if not exists');
      console.log('');
    } else {
      console.log('✓ No existing lumber tables found - clean install\n');
    }

    // Read migration file
    console.log('📄 Reading migration file...');
    const migrationPath = path.join(__dirname, '../database/migrations/VERIFIED-lumber-complete-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✓ Loaded migration (${migrationSQL.length} characters)\n`);

    // Run migration
    console.log('🚀 Running migration...');
    console.log('   This may take a minute...\n');
    
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const newTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'lumber_%'
      ORDER BY table_name
    `;

    console.log(`✓ Found ${newTables.length} lumber tables:`);
    newTables.forEach(t => console.log(`   ✓ ${t.table_name}`));
    console.log('');

    // Check the critical constraint
    console.log('🔍 Verifying unique constraint on lumber_packs...');
    const constraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'lumber_packs'
      AND constraint_type = 'UNIQUE'
    `;

    if (constraints.length > 0) {
      console.log('✓ Unique constraints found:');
      constraints.forEach(c => console.log(`   ✓ ${c.constraint_name}`));
    } else {
      console.log('⚠️  WARNING: No unique constraint found on lumber_packs');
    }
    console.log('');

    console.log('🎉 ALL DONE!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy your application');
    console.log('2. Navigate to Lumber Admin to set up your load ID range');
    console.log('3. Add suppliers, species, and grades');
    console.log('4. Start creating loads!');
    console.log('');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('Error details:', error.message);
    console.error('');
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();

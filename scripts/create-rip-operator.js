/**
 * Script to create a rip_operator user
 * 
 * Usage: node scripts/create-rip-operator.js <username> <password> <fullName> [email]
 * 
 * Example: node scripts/create-rip-operator.js sawoperator1 password123 "John Smith" john@example.com
 * 
 * The rip_operator role can only access:
 * - Overview page
 * - Rip Entry page
 * - Daily Hours page
 * - Ripped Packs page
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function createRipOperator() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node scripts/create-rip-operator.js <username> <password> <fullName> [email]');
    console.log('Example: node scripts/create-rip-operator.js sawoperator1 password123 "John Smith" john@example.com');
    process.exit(1);
  }
  
  const [username, password, fullName, email = null] = args;
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      console.error(`Error: User with username "${username}" already exists.`);
      process.exit(1);
    }
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert the new user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, 'rip_operator', true)
       RETURNING id, username, full_name, role`,
      [username, passwordHash, fullName, email]
    );
    
    const newUser = result.rows[0];
    
    console.log('\n✅ Rip operator user created successfully!\n');
    console.log('User Details:');
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Username: ${newUser.username}`);
    console.log(`  Full Name: ${newUser.full_name}`);
    console.log(`  Role: ${newUser.role}`);
    console.log('\nThis user can access:');
    console.log('  - Overview page (/dashboard/lumber/overview)');
    console.log('  - Rip Entry page (/dashboard/lumber/rip-entry)');
    console.log('  - Daily Hours page (/dashboard/lumber/daily-hours)');
    console.log('  - Ripped Packs page (/dashboard/lumber/ripped-packs)');
    
  } catch (error) {
    console.error('Error creating rip operator:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createRipOperator();

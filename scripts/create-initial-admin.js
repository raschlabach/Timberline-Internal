/**
 * Script to create the initial admin user for the system
 * 
 * Usage:
 *   node scripts/create-initial-admin.js [branch]
 * 
 * Where [branch] is either 'preview' or 'main' (defaults to 'preview')
 */

const { hash } = require('bcryptjs');
const { Pool } = require('pg');

// Load database config
let config;
try {
  config = require('../database/config');
} catch (error) {
  console.error('Database config not found. Please create a config.js file based on config.example.js');
  process.exit(1);
}

// Determine which branch to use
const branch = process.argv[2] || 'preview';
if (!['preview', 'main'].includes(branch)) {
  console.error('Error: Branch must be either "preview" or "main"');
  process.exit(1);
}

async function createInitialAdmin() {
  try {
    // Default admin credentials - CHANGE THESE!
    const adminCredentials = {
      username: 'admin',
      password: 'admin123', // CHANGE THIS PASSWORD!
      fullName: 'System Administrator',
      email: 'admin@timberline.com',
      role: 'admin'
    };

    console.log('Creating initial admin user...');
    console.log(`Username: ${adminCredentials.username}`);
    console.log(`Password: ${adminCredentials.password}`);
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    
    // Hash the password
    const passwordHash = await hash(adminCredentials.password, 10);
    
    // Connect to the database
    const pool = new Pool(config[branch]);
    
    // Check if admin user already exists
    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1', [adminCredentials.username]);
    
    if (checkResult.rowCount > 0) {
      console.log(`Admin user '${adminCredentials.username}' already exists. Updating...`);
      
      // Update existing user
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, email = $3, role = $4, is_active = TRUE WHERE username = $5',
        [passwordHash, adminCredentials.fullName, adminCredentials.email, adminCredentials.role, adminCredentials.username]
      );
      
      console.log(`✅ Admin user '${adminCredentials.username}' updated successfully.`);
    } else {
      // Insert new user
      await pool.query(
        'INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminCredentials.username, passwordHash, adminCredentials.fullName, adminCredentials.email, adminCredentials.role, true]
      );
      
      console.log(`✅ Admin user '${adminCredentials.username}' created successfully.`);
    }
    
    console.log('\n🎉 Initial admin setup complete!');
    console.log('You can now:');
    console.log('1. Log in with the credentials above');
    console.log('2. Go to User Management in the dashboard');
    console.log('3. Create additional users and change the default password');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

// Run the script
createInitialAdmin();

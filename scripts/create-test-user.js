const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database configuration (using the same config as the app)
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

async function createTestUser() {
  const pool = new Pool(config.preview);
  
  try {
    console.log('Connecting to database...');
    
    // Hash the password
    const passwordHash = await bcrypt.hash('test123', 10);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      ['testuser']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Test user already exists!');
      console.log('Username: testuser');
      console.log('Password: test123');
      return;
    }
    
    // Create test user
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['testuser', passwordHash, 'Test User', 'test@example.com', 'admin', true]
    );
    
    console.log('✅ Test user created successfully!');
    console.log('Username: testuser');
    console.log('Password: test123');
    console.log('User ID:', result.rows[0].id);
    
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
  } finally {
    await pool.end();
  }
}

createTestUser();

#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const dbConfig = require('../database/config');

// Get the SQL file content
const sqlFile = path.join(__dirname, '../database/migrations/add-quotes-table.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

// Function to apply migration to a specific branch
async function applyMigration(branchName) {
  try {
    console.log(`Applying quotes table migration to ${branchName} branch...`);
    
    // Get the connection string for the specified branch
    const connectionString = dbConfig[branchName].connectionString;
    
    // Create a temporary file with the SQL command
    const tempFile = path.join(__dirname, `temp-quotes-migration-${branchName}.sql`);
    fs.writeFileSync(tempFile, sqlContent);
    
    // Execute the SQL command
    execSync(`psql "${connectionString}" -f ${tempFile}`, { stdio: 'inherit' });
    
    // Clean up the temporary file
    fs.unlinkSync(tempFile);
    
    console.log(`Successfully applied quotes table migration to ${branchName} branch`);
  } catch (error) {
    console.error(`Error applying migration to ${branchName} branch:`, error.message);
    process.exit(1);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // Default to preview branch if no arguments provided
  const branch = args[0] || 'preview';
  
  if (branch === 'both') {
    // Apply to both branches
    await applyMigration('preview');
    await applyMigration('main');
  } else if (branch === 'preview' || branch === 'main') {
    // Apply to the specified branch
    await applyMigration(branch);
  } else {
    console.error('Invalid branch. Use "preview", "main", or "both"');
    process.exit(1);
  }
}

main(); 
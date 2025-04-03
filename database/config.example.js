/**
 * Database configuration example file
 * 
 * Copy this file to config.js and fill in your Neon.tech connection details
 * DO NOT commit the actual config.js file with credentials to version control
 */

module.exports = {
  // Production database (main branch)
  main: {
    connectionString: "postgresql://neondb_owner:npg_D5hj1egPlAok@ep-calm-frog-a8qxyo8o-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
    ssl: true,
  },
  
  // Development/staging database (preview branch)
  preview: {
    connectionString: "postgresql://neondb_owner:npg_D5hj1egPlAok@ep-proud-glitter-a85pbrz6-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
    ssl: true,
  }
}; 
# Database Migrations

This directory contains database migration scripts to update the database schema.

## Migration Files

- `add-order-tracking-fields.sql`: Adds user tracking fields to the orders table and creates a consolidated freight_items table
- `migrate-freight-data.sql`: Migrates existing freight data from the orders table to the new freight_items table

## How to Apply Migrations

### Using the Migration Script

You can apply migrations using the `apply-migration.js` script in the parent directory:

```bash
# Apply schema changes first
node apply-migration.js migrations/add-order-tracking-fields.sql

# Then migrate the data
node apply-migration.js migrations/migrate-freight-data.sql
```

### Important Notes

- Always apply migrations to the `preview` branch first to verify they work as expected
- Always back up the database before applying migrations to the `main` branch
- Migrations are applied in a transaction and will roll back if any step fails
- Check the console output for any errors or warnings

## Verifying Migrations

After applying migrations, you can verify they worked correctly by:

1. Checking the database tables and columns
2. Running the application and testing affected features
3. Checking the logs for any errors

## Rollback

If a migration needs to be rolled back, you'll need to create a new migration script that reverses the changes. 
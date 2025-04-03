#!/bin/bash

# Run database migrations in correct order

echo "Starting database migrations..."

# Step 1: Run schema changes first
echo "Applying schema changes..."
node apply-migration.js migrations/add-order-tracking-fields.sql
if [ $? -ne 0 ]; then
    echo "Error applying schema changes. Exiting."
    exit 1
fi
echo "Schema changes applied successfully."

# Step 2: Migrate existing data
echo "Migrating existing freight data..."
node apply-migration.js migrations/migrate-freight-data.sql
if [ $? -ne 0 ]; then
    echo "Error migrating data. Please check the logs."
    exit 1
fi
echo "Data migration completed successfully."

echo "All migrations completed successfully!"
echo "Please restart your application for changes to take effect." 
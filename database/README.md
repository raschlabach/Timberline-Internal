# Timberline Logistics Database Setup

This directory contains the PostgreSQL database schema for the Timberline Logistics Dashboard application.

## Database Structure

The schema (`schema.sql`) contains all necessary tables, indices, relationships, views, functions, and triggers for the application to function properly. It follows a structured design to manage:

- Users and authentication
- Customers and locations
- Orders and freight (skids, vinyl, footage)
- Truckloads and assignments
- Route planning and optimization
- Trailer layouts and visualization

## Setup Instructions

### Connecting to Neon.tech PostgreSQL Database

1. **Create a Neon.tech Account** (if you don't have one already)
   - Visit [Neon.tech](https://neon.tech) to sign up
   - Create a new project

2. **Create the Preview Branch**
   - In the Neon dashboard, create a branch named "preview" from your main branch
   - This will be used for development and testing

3. **Connect to the Preview Branch**
   - From the Neon dashboard, get your connection string for the preview branch
   - It should look something like: `postgres://user:password@ep-something.us-east-2.aws.neon.tech/neondb`

4. **Install PostgreSQL Client** (if not already installed)
   - On macOS with Homebrew: `brew install postgresql`
   - On other platforms, follow [PostgreSQL installation instructions](https://www.postgresql.org/download/)

5. **Apply the Schema**
   ```bash
   # Connect to your Neon database (preview branch)
   psql postgres://user:password@your-neon-endpoint.neon.tech/dbname

   # Or apply directly from the file
   psql postgres://user:password@your-neon-endpoint.neon.tech/dbname -f schema.sql
   ```

### Development Workflow

1. Always make schema changes to the preview branch first
2. Test thoroughly before promoting changes to the main branch
3. Use database migrations for future schema updates

## Branch Management

- **preview**: Development and testing environment
- **main**: Production environment (only apply well-tested changes)

## Important Notes

- The database is designed to be flexible and does not impose artificial constraints on truckload capacity
- Timestamps are automatically updated via triggers when rows are modified
- The Timberline Warehouse location is automatically inserted as a fixed location
- Indexes are provided on frequently queried columns for performance 
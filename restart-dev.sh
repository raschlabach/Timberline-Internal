#!/bin/bash

# Kill any existing Next.js development servers
echo "Stopping any running Next.js servers..."
pkill -f "next dev" || true

# Wait a moment to ensure ports are freed
sleep 2

# Start the development server
echo "Starting development server..."
npm run dev 
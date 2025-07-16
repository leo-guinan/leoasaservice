#!/bin/bash

# Force migration script for ResearchBuddy
# This script forces migrations to run and checks database state

echo "Force running production migrations..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Set production environment
export NODE_ENV=production

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is required"
  exit 1
fi

echo "Using database: $DATABASE_URL"

# Add SSL mode to DATABASE_URL if not present
if [[ "$DATABASE_URL" != *"sslmode="* ]]; then
  export DATABASE_URL="${DATABASE_URL}?sslmode=require"
  echo "Added SSL mode to DATABASE_URL"
fi

# Drop and recreate the drizzle migrations table to force re-run
echo "Resetting migration state..."
npx drizzle-kit drop

# Run migrations
echo "Running migrations..."
npx drizzle-kit migrate

# Check if tables exist
echo "Checking if tables were created..."
npx drizzle-kit studio --port 4983 &
STUDIO_PID=$!

sleep 5
echo "Drizzle Studio started on port 4983 - check http://localhost:4983 to verify tables"

# Keep the script running so you can check the studio
echo "Press Ctrl+C to stop..."
wait $STUDIO_PID 
#!/bin/bash

# Production migration script for ResearchBuddy
# This script runs migrations with proper SSL settings for production

echo "Running production migrations..."

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

# Run migrations with production settings
echo "Running migrations..."
npx drizzle-kit migrate

echo "Migrations completed!" 
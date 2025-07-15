#!/bin/bash

# Setup script for local PostgreSQL database
# This script creates a local PostgreSQL database for development

echo "Setting up local PostgreSQL database for ResearchBuddy..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL service is running
if ! pg_isready -q; then
    echo "PostgreSQL service is not running. Starting it..."
    if command -v brew &> /dev/null; then
        brew services start postgresql
    else
        sudo systemctl start postgresql
    fi
fi

# Create database and user
echo "Creating database and user..."
psql -d postgres -c "CREATE USER researchbuddy WITH PASSWORD 'researchbuddy';" 2>/dev/null || echo "User already exists"
psql -d postgres -c "CREATE DATABASE researchbuddy OWNER researchbuddy;" 2>/dev/null || echo "Database already exists"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE researchbuddy TO researchbuddy;" 2>/dev/null || echo "Privileges already granted"

echo "Database setup complete!"
echo "Add this to your .env file:"
echo "DATABASE_URL=\"postgresql://researchbuddy:researchbuddy@localhost:5432/researchbuddy\"" 
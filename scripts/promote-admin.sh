#!/bin/bash

# Production script to promote a user to admin role
# Usage: ./scripts/promote-admin.sh <userId>
# Example: ./scripts/promote-admin.sh 2

if [ $# -eq 0 ]; then
    echo "❌ User ID is required"
    echo "Usage: ./scripts/promote-admin.sh <userId>"
    echo "Example: ./scripts/promote-admin.sh 2"
    exit 1
fi

USER_ID=$1

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    echo "Please set DATABASE_URL before running this script"
    exit 1
fi

echo "🚀 Promoting user ID $USER_ID to admin role..."
echo "📊 Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/@***:***@/')"

# Run the Node.js script
node scripts/promote-admin.js $USER_ID

if [ $? -eq 0 ]; then
    echo "✅ Script completed successfully"
else
    echo "❌ Script failed"
    exit 1
fi 
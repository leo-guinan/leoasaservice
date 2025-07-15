#!/bin/bash

echo "Setting up Redis for background processing..."

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "Redis is not installed. Installing Redis..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install redis
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update
        sudo apt-get install -y redis-server
    else
        echo "Please install Redis manually for your operating system"
        exit 1
    fi
fi

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis server..."
    redis-server --daemonize yes
else
    echo "Redis server is already running"
fi

echo "Redis setup complete!"
echo "You can now run the worker process with: pnpm run dev:worker" 
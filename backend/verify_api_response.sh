#!/bin/bash
# Start server in background
PORT=4001 node src/server.js > /dev/null 2>&1 &
SERVER_PID=$!

echo "Server started with PID $SERVER_PID on port 4001, waiting for 5 seconds..."
sleep 5

# Make request
echo "Fetching resources..."
curl -s "http://localhost:4001/api/resources?limit=1" | python3 -m json.tool

# Cleanup
echo "Stopping server..."
kill $SERVER_PID

#!/bin/bash

# Create temporary log files
mkdir -p logs
SERVER_LOG="logs/server.log"
UI_LOG="logs/ui.log"

# Function to stop background processes on script exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p)
    rm -f "$SERVER_LOG" "$UI_LOG"
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT

# Clear existing logs
> "$SERVER_LOG"
> "$UI_LOG"

# Start the Python backend and redirect output to log file
echo "Starting Python backend..."
export PYTHONPATH="$PYTHONPATH:$(pwd)"
(cd server && python main.py) > "$SERVER_LOG" 2>&1 &

# Wait a bit for the backend to start
sleep 2

# Start the frontend and redirect output to log file
echo "Starting frontend..."
(cd ui && npm run dev) > "$UI_LOG" 2>&1 &

# Use split terminal to show both logs
clear
echo "=== Server Log (left) === | === UI Log (right) ==="
echo "Press Ctrl+C to stop all servers"
(
    # Show logs side by side using paste
    tail -f "$SERVER_LOG" | sed 's/^/[Server] /' & 
    tail -f "$UI_LOG" | sed 's/^/[UI] /' &
    wait
) 
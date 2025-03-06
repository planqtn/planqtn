#!/bin/bash

# Function to stop background processes on script exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p)
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT

# Start the Python backend
echo "Starting Python backend..."
cd server
python main.py &

# Wait a bit for the backend to start
sleep 2

# Start the frontend
echo "Starting frontend..."
cd ../ui
npm run dev &

# Keep the script running
echo "Both servers are running. Press Ctrl+C to stop."
wait 
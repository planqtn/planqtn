#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default ports
BACKEND_PORT=5005
FRONTEND_PORT=5173
DEV_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if virtualenv is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}No virtual environment is currently activated ('VIRTUAL_ENV' is empty) - if you have a preferred virtualenv, please activate it before running the script.${NC}"
    
    # Check if .virtualenvs directory exists and has environments
    VENV_DIR="$HOME/.virtualenvs"
    if [ ! -d "$VENV_DIR" ] || [ -z "$(ls -A $VENV_DIR)" ]; then
        echo -e "${RED}No virtual environments found in $VENV_DIR${NC}"
        echo -e "${YELLOW}Please run ./setup.sh first to create a virtual environment.${NC}"
        exit 1
    fi
    
    # Check if tnqec environment exists
    if [ -d "$VENV_DIR/tnqec" ]; then
        echo -e "${GREEN}Found tnqec virtual environment, activating it...${NC}"
        source "$VENV_DIR/tnqec/bin/activate"
    else
        # List available virtual environments
        echo -e "${GREEN}Available virtual environments:${NC}"
        ls -1 "$VENV_DIR"
        echo
        
        # Ask user to select environment
        read -p "Enter the name of the virtual environment to activate: " venv_name
        
        if [ ! -d "$VENV_DIR/$venv_name" ]; then
            echo -e "${RED}Virtual environment '$venv_name' not found.${NC}"
            exit 1
        fi
        
        # Activate the selected virtual environment
        source "$VENV_DIR/$venv_name/bin/activate"
    fi
    
    if [ -z "$VIRTUAL_ENV" ]; then
        echo -e "${RED}Failed to activate virtual environment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Activated virtual environment: $(basename $VIRTUAL_ENV)${NC}"
fi

# Create temporary log files
mkdir -p logs
SERVER_LOG="logs/server.log"
UI_LOG="logs/ui.log"

# Function to stop background processes on script exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p)
    rm -f "$SERVER_LOG" "$UI_LOG"
    pkill -e -9 -f "main.py|npm|vite"
    exit
}

# Set up cleanup on script exit
trap cleanup EXIT

# Clear existing logs
> "$SERVER_LOG"
> "$UI_LOG"

# Start the Python backend and redirect output to log file
echo "Starting Python backend..."
(cd server && python main.py --port "$BACKEND_PORT" --ui-port "$FRONTEND_PORT") > "$SERVER_LOG" 2>&1 &

# Wait a bit for the backend to start
sleep 2

# Start the frontend and redirect output to log file
set -e
if [ "$DEV_MODE" = false ]; then
    echo "Building frontend..."
    (cd ui && npm run build)
    echo "Starting frontend in preview mode..."
    export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
    (cd ui && npm run preview -- --port "$FRONTEND_PORT") > "$UI_LOG" 2>&1 &
else
    echo "Starting frontend in development mode..."
    export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
    (cd ui && npm run dev -- --port "$FRONTEND_PORT") > "$UI_LOG" 2>&1 &
fi

# Use split terminal to show both logs
clear
echo "Press Ctrl+C to stop all servers"
(
    # Show logs side by side using paste
    tail -f "$SERVER_LOG" | sed 's/^/[Server] /' & 
    tail -f "$UI_LOG" | sed 's/^/[UI] /' &
    wait
) 
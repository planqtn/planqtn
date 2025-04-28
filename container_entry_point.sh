#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default ports and host
BACKEND_PORT=5005
FRONTEND_PORT=${FRONTEND_PORT:-5173}
FRONTEND_HOST=${FRONTEND_HOST:-localhost}
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
        --frontend-host)
            FRONTEND_HOST="$2"
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

# Create temporary log files
mkdir -p logs
SERVER_LOG="logs/server.log"
UI_LOG="logs/ui.log"
CELERY_LOG="logs/celery.log"

# Clear existing logs
> "$SERVER_LOG"
> "$UI_LOG"
> "$CELERY_LOG"

echo "Starting Redis server..."
redis-server --daemonize yes

redis-cli ping

echo Starting Celery worker...
celery -A server.tasks worker --loglevel=INFO > "$CELERY_LOG" 2>&1 &
CELERY_PID=$!   

echo celery pid: $CELERY_PID

# Start the Python backend and redirect output to log file
echo "Starting Python backend with frontend host $FRONTEND_HOST and port $FRONTEND_PORT"
export PYTHONPATH="$PYTHONPATH:$(pwd)"
(cd server && python main.py --port "$BACKEND_PORT" --ui-port "$FRONTEND_PORT" --ui-host "$FRONTEND_HOST") > "$SERVER_LOG" 2>&1 &
BACKEND_PID=$!

echo backend pid: $BACKEND_PID
# Wait a bit for the backend to start and check if it's still running
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Failed to start Python backend${NC}"
    cat "$SERVER_LOG"
    exit 1
fi

echo "It seems the backend started..."
ps ax 
cat $SERVER_LOG

if ! kill -0 $CELERY_PID 2>/dev/null; then
    echo -e "${RED}Failed to start Celery worker${NC}"
    cat "$CELERY_LOG"
    exit 1
fi


# Start the frontend and redirect output to log file
if [ "$DEV_MODE" = false ]; then
    echo "Building frontend..."
    if ! (cd ui && npm run build); then
        echo -e "${RED}Failed to build frontend${NC}"
        exit 1
    fi
    echo "Starting frontend in preview mode with host $FRONTEND_HOST and port $FRONTEND_PORT"
    export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
    (cd ui && npm run preview -- --port "$FRONTEND_PORT" ) > "$UI_LOG" 2>&1 &
    FRONTEND_PID=$!

    echo frontend pid: $FRONTEND_PID
else
    echo "Starting frontend in development mode with host $FRONTEND_HOST and port $FRONTEND_PORT"
    export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
    (cd ui && npm run dev -- --port "$FRONTEND_PORT" ) > "$UI_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo frontend pid: $FRONTEND_PID
fi

# Wait a bit for the frontend to start and check if it's still running
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Failed to start frontend${NC}"
    cat "$UI_LOG"
    exit 1
fi

ps ax 
cat $SERVER_LOG
echo "Press Ctrl+C to stop all servers"

# Show logs side by side using paste
(tail -f "$SERVER_LOG" | sed 's/^/[Server] /' & 
tail -f "$UI_LOG" | sed 's/^/[UI] /' &
tail -f "$CELERY_LOG" | sed 's/^/[Celery] /' &    
wait -n)


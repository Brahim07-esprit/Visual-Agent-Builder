#!/bin/bash

echo "Starting Agent Builder..."

cleanup() {
    echo "Shutting down servers..."
    # Kill by PID first
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    
    # Kill any remaining processes by name/port
    pkill -f "react-scripts/scripts/start.js" 2>/dev/null
    pkill -f "python main.py" 2>/dev/null
    pkill -f "uvicorn" 2>/dev/null
    
    # Kill processes using ports 3000 and 8000
    fuser -k 3000/tcp 2>/dev/null
    fuser -k 8000/tcp 2>/dev/null
    
    exit
}

trap cleanup EXIT INT TERM

# Clean up any existing processes before starting
echo "Cleaning up any existing processes..."
pkill -f "react-scripts/scripts/start.js" 2>/dev/null
pkill -f "python main.py" 2>/dev/null
pkill -f "uvicorn" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
sleep 2

echo "Starting backend server..."
cd backend

echo "Checking backend dependencies..."
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    uv init
    if [ $? -ne 0 ]; then
        echo "Failed to create virtual environment"
        exit 1
    fi
fi

echo "Installing/updating dependencies..."
uv add -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

echo "Dependencies installed successfully"

if [ ! -f ".env" ]; then
    echo "WARNING: No .env file found in backend directory!"
    echo "Creating .env file with the parent directory's OPENAI_API_KEY..."
    if [ -f "../.env" ]; then
        grep "OPENAI_API_KEY" ../.env > .env
        echo "Created .env file from parent directory"
    else
        echo "WARNING: No .env file found in parent directory either!"
        echo "Please create backend/.env with your OPENAI_API_KEY"
        echo "Example: OPENAI_API_KEY=your-key-here"
        exit 1
    fi
fi

echo "Starting backend server..."
.venv/bin/python main.py &
BACKEND_PID=$!
cd ..

sleep 3

echo "Starting frontend server..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

npm start &
FRONTEND_PID=$!

echo ""
echo "Agent Builder is running!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

wait 

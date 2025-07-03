#!/bin/bash

echo "Starting Agent Builder..."

cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

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

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing/updating dependencies..."
uv add -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

echo "Dependencies installed successfully"
sleep 2

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

python main.py &
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
echo ""
echo "Press Ctrl+C to stop both servers"

wait 

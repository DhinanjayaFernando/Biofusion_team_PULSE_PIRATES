#!/bin/bash

# ML Blood Smear Detection App - Ubuntu/Debian Run Script
# Optimized for Ubuntu, Linux Mint, Debian, and other Debian-based systems

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "ML Blood Smear Detection App"
echo "Ubuntu/Debian Setup"
echo "================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    echo ""
    echo "Installing Python 3 and pip..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install Python 3"
        echo "Please run manually: sudo apt-get install python3 python3-pip python3-venv"
        exit 1
    fi
fi

# Check for required system dependencies for OpenCV
if ! dpkg -l | grep -q "libopencv"; then
    echo "Installing OpenCV system dependencies..."
    sudo apt-get update
    sudo apt-get install -y libsm6 libxext6 libxrender-dev
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing Python dependencies from requirements.txt..."
pip3 install --upgrade pip setuptools wheel
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    echo "Try running: pip3 install --upgrade pip && pip3 install -r requirements.txt"
    exit 1
fi

# Start the server
echo ""
echo "=========================================="
echo "Starting Uvicorn server (Production Mode)"
echo "Application URL: http://127.0.0.1:8000"
echo "=========================================="
echo "Optimizations enabled:"
echo "  ✓ Debug mode disabled"
echo "  ✓ Source maps disabled"
echo "  ✓ API docs disabled"
echo "  ✓ IPv4-only binding (faster than localhost DNS)"
echo "Press Ctrl+C to stop the server"
echo ""

# Set production environment variables
export PRODUCTION=true
export LOG_LEVEL=WARNING
export ALLOWED_ORIGINS=http://127.0.0.1:3000

# Start the server on IPv4 (127.0.0.1) for better performance
uvicorn app:app --host 127.0.0.1 --port 8000 &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Try to open the app in the default browser
if command -v xdg-open &> /dev/null; then
    echo "Opening application in default browser..."
    xdg-open "http://127.0.0.1:8000" 2>/dev/null
else
    echo "Please open http://127.0.0.1:8000 in your web browser"
fi

echo ""
echo "Server is running with PID: $SERVER_PID"

# Wait for the server process
wait $SERVER_PID

#!/bin/bash

# ML Blood Smear Detection App - Arch Linux Run Script
# Optimized for Arch Linux, Manjaro, EndeavourOS, and other Arch-based systems

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "ML Blood Smear Detection App"
echo "Arch Linux Setup"
echo "================================"
echo ""

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "Error: Python is not installed."
    echo ""
    echo "Installing Python and pip..."
    sudo pacman -Syu python python-pip
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install Python"
        echo "Please run manually: sudo pacman -S python python-pip"
        exit 1
    fi
fi

# Check for required system dependencies for OpenCV
echo "Ensuring system dependencies are installed..."
sudo pacman -S --needed opencv python-opencv

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
    
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
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    echo "Try running: pip install --upgrade pip && pip install -r requirements.txt"
    exit 1
fi

# Start the server
echo ""
echo "=========================================="
echo "Starting Uvicorn server..."
echo "Application URL: http://localhost:8000"
echo "=========================================="
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
uvicorn app:app --reload --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Try to open the app in the default browser
if command -v xdg-open &> /dev/null; then
    echo "Opening application in default browser..."
    xdg-open "http://localhost:8000" 2>/dev/null
else
    echo "Please open http://localhost:8000 in your web browser"
fi

echo ""
echo "Server is running with PID: $SERVER_PID"

# Wait for the server process
wait $SERVER_PID

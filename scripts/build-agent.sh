#!/bin/bash
set -e

echo "=== Building DevPanel Go Kernel Agent ==="
mkdir -p bin

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "Go not found. Installing golang-go..."
    sudo apt-get update && sudo apt-get install -y golang-go
fi

echo "Compiling agent/main.go into bin/devpanel-agent..."
CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/devpanel-agent agent/main.go

echo "Setting permissions..."
chmod +x bin/devpanel-agent

echo "Setting up systemd service..."
if [ -f "/etc/systemd/system/devpanel-agent.service" ]; then
    sudo systemctl stop devpanel-agent || true
fi

sudo cp scripts/devpanel-agent.service /etc/systemd/system/devpanel-agent.service
sudo systemctl daemon-reload
sudo systemctl enable devpanel-agent
sudo systemctl restart devpanel-agent

echo "=== DevPanel Go Kernel Agent successfully installed & started! ==="
sudo systemctl status devpanel-agent --no-pager


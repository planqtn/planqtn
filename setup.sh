#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check version requirements
version_greater_equal() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
    return $?
}

# Check Python version
echo -e "${YELLOW}Checking Python version...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3.10 or higher.${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if ! version_greater_equal "$PYTHON_VERSION" "3.10"; then
    echo -e "${RED}Python 3.10 or higher is required. Found version: $PYTHON_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}Python version $PYTHON_VERSION found.${NC}"

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 10.8 or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f2)
if ! version_greater_equal "$NODE_VERSION" "10.8"; then
    echo -e "${RED}Node.js 10.8 or higher is required. Found version: $NODE_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js version $NODE_VERSION found.${NC}"

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}npm found.${NC}"

# Create virtual environment directory if it doesn't exist
mkdir -p "$HOME/.virtualenvs"

# Ask for virtual environment name and check if it exists
while true; do
    read -p "Enter virtual environment name (default: tnqec): " venv_name
    venv_name=${venv_name:-tnqec}
    venv_path="$HOME/.virtualenvs/$venv_name"
    
    if [ -d "$venv_path" ]; then
        echo -e "${RED}Error: Virtual environment '$venv_name' already exists at $venv_path${NC}"
        echo -e "${YELLOW}Please choose a different name. A clean virtual environment is preferred.${NC}"
    else
        break
    fi
done

echo -e "${YELLOW}Creating virtual environment at $venv_path...${NC}"
python3 -m venv "$venv_path"

if [ ! -d "$venv_path" ]; then
    echo -e "${RED}Failed to create virtual environment.${NC}"
    exit 1
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source "$venv_path/bin/activate"

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
if [ -f "./requirements.txt" ]; then
    pip install -r ./requirements.txt
else
    echo -e "${RED}Warning: ./requirements.txt not found${NC}"
fi

if [ -f "./server/requirements.txt" ]; then
    pip install -r ./server/requirements.txt
else
    echo -e "${RED}Warning: ./server/requirements.txt not found${NC}"
fi

# Install Node.js dependencies
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
if [ -d "./ui" ]; then
    cd ui
    npm install
    cd ..
else
    echo -e "${RED}Warning: ui directory not found${NC}"
fi

echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${GREEN}Welcome to Quantum Lego Tools!${NC}"
echo -e "${YELLOW}You can start the server with ./start.sh${NC}"

# Deactivate virtual environment
deactivate

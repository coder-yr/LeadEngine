#!/bin/bash

# LeadEngine Bootstrap Verification Script
# Verifies all Phase 0 setup is complete

set -e

echo "🔍 LeadEngine Bootstrap Verification"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    return 0
  else
    echo -e "${RED}✗${NC} $1"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    return 0
  else
    echo -e "${RED}✗${NC} $1/"
    return 1
  fi
}

echo "Checking directory structure..."
check_dir "frontend"
check_dir "backend"
check_dir "workers"
check_dir "docs"
echo ""

echo "Checking configuration files..."
check_file ".prettierrc"
check_file ".gitignore"
check_file "package.json"
check_file "docker-compose.yml"
check_file "docker-compose.override.yml"
echo ""

echo "Checking frontend..."
check_file "frontend/package.json"
check_file "frontend/vite.config.ts"
check_file "frontend/tsconfig.json"
check_file "frontend/.env.example"
check_file "frontend/index.html"
check_file "frontend/src/App.tsx"
echo ""

echo "Checking backend..."
check_file "backend/package.json"
check_file "backend/tsconfig.json"
check_file "backend/.env.example"
check_file "backend/src/index.ts"
check_file "backend/Dockerfile"
echo ""

echo "Checking workers..."
check_file "workers/requirements.txt"
check_file "workers/.env.example"
check_file "workers/src/worker.py"
check_file "workers/Dockerfile"
echo ""

echo "Checking documentation..."
check_file "README.md"
check_file "docs/ARCHITECTURE.md"
check_file "docs/API.md"
check_file "docs/SETUP.md"
check_file "CONTRIBUTING.md"
check_file "ROADMAP.md"
check_file "CHANGELOG.md"
check_file "QUICK_REFERENCE.md"
check_file "LICENSE"
echo ""

echo "Checking IDE configuration..."
check_file ".vscode/settings.json"
check_file ".vscode/extensions.json"
echo ""

echo "===================================="
echo -e "${GREEN}✓ Phase 0: Bootstrap Complete!${NC}"
echo ""
echo "Next Steps:"
echo "1. Copy environment files: cp frontend/.env.example frontend/.env.local"
echo "2. Install dependencies: npm install"
echo "3. Start Docker: npm run docker:up"
echo "4. Run servers: npm run dev (in separate terminals)"
echo ""
echo "See README.md for detailed setup instructions"

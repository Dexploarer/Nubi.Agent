#!/bin/bash

echo "========================================="
echo "CI/CD and Docker Setup Verification"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 missing"
        return 1
    fi
}

# Function to check if a directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 directory exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 directory missing"
        return 1
    fi
}

echo ""
echo "1. Checking CI/CD Files:"
echo "------------------------"
check_file ".github/workflows/ci-cd.yml"
check_file "scripts/health-check.sh"
check_file "scripts/verify-deployment.sh"

echo ""
echo "2. Checking Docker Files:"
echo "-------------------------"
check_file "docker/Dockerfile.agent"
check_file "docker/Dockerfile.api"
check_file "docker/docker-compose.yml"
check_file "docker/docker-compose.test.yml"
check_file ".dockerignore"

echo ""
echo "3. Checking Project Structure:"
echo "------------------------------"
check_dir "src"
check_dir "src/api"
check_dir "src/services"
check_dir "src/utils"
check_dir "tests"
check_dir "k8s/production/green"

echo ""
echo "4. Checking Configuration Files:"
echo "--------------------------------"
check_file "package.json"
check_file "tsconfig.json"
check_file "jest.config.js"
check_file ".eslintrc.json"
check_file ".prettierrc.json"

echo ""
echo "5. Testing Build Process:"
echo "-------------------------"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} TypeScript build successful"
else
    echo -e "${RED}✗${NC} TypeScript build failed"
fi

echo ""
echo "6. Testing Docker Build:"
echo "------------------------"
if docker build -f docker/Dockerfile.agent -t nubi-agent:cicd-test . > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Docker build successful"
    docker rmi nubi-agent:cicd-test > /dev/null 2>&1
else
    echo -e "${RED}✗${NC} Docker build failed"
fi

echo ""
echo "7. Checking npm scripts:"
echo "------------------------"
for script in build start test lint type-check docker:build; do
    if grep -q "\"$script\":" package.json; then
        echo -e "${GREEN}✓${NC} npm run $script defined"
    else
        echo -e "${RED}✗${NC} npm run $script missing"
    fi
done

echo ""
echo "========================================="
echo "Verification Complete!"
echo "========================================="

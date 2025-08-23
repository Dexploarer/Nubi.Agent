#!/bin/bash

# NUBI ElizaOS Pre-commit Hook
# Validates code quality, ElizaOS compliance, and runs essential checks

set -e  # Exit on any error

echo "🔮 NUBI Pre-commit Hook - Starting validation..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run command with status
run_check() {
    local check_name=$1
    local command=$2
    
    print_status $BLUE "🔍 Running ${check_name}..."
    
    if eval $command; then
        print_status $GREEN "✅ ${check_name} passed"
        return 0
    else
        print_status $RED "❌ ${check_name} failed"
        return 1
    fi
}

# Store original directory
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_DIR"

# Counter for failed checks
FAILED_CHECKS=0

# 1. Type checking
if ! run_check "TypeScript Type Check" "bun run type-check"; then
    ((FAILED_CHECKS++))
fi

# 2. Code formatting check
if ! run_check "Code Formatting" "bun run format --check || (echo 'Running formatter...' && bun run format)"; then
    # If format check fails, try to format and continue
    print_status $YELLOW "⚠️  Code was reformatted. Please review changes."
    bun run format
fi

# 3. Linting
if ! run_check "ESLint/TSLint" "bun run lint"; then
    ((FAILED_CHECKS++))
fi

# 4. ElizaOS Compliance Checks
print_status $BLUE "🏛️  Checking ElizaOS compliance..."

# Check service implementations
SERVICE_ERRORS=0
for service_file in src/services/*.ts; do
    if [[ -f "$service_file" ]]; then
        # Check if service extends ElizaOS Service class
        if ! grep -q "extends Service" "$service_file"; then
            print_status $RED "❌ $service_file: Missing 'extends Service'"
            ((SERVICE_ERRORS++))
        fi
        
        # Check for serviceType constant
        if ! grep -q "static serviceType.*const" "$service_file"; then
            print_status $RED "❌ $service_file: Missing 'static serviceType' constant"
            ((SERVICE_ERRORS++))
        fi
        
        # Check for proper constructor
        if ! grep -q "constructor.*IAgentRuntime" "$service_file"; then
            print_status $RED "❌ $service_file: Missing IAgentRuntime constructor parameter"
            ((SERVICE_ERRORS++))
        fi
    fi
done

# Check evaluator implementations
EVALUATOR_ERRORS=0
for evaluator_file in src/evaluators/*.ts; do
    if [[ -f "$evaluator_file" ]]; then
        # Check for validate method
        if ! grep -q "validate.*async" "$evaluator_file"; then
            print_status $RED "❌ $evaluator_file: Missing async validate() method"
            ((EVALUATOR_ERRORS++))
        fi
        
        # Check for handler method with ActionResult
        if ! grep -q "handler.*ActionResult" "$evaluator_file"; then
            print_status $RED "❌ $evaluator_file: Missing handler() method returning ActionResult"
            ((EVALUATOR_ERRORS++))
        fi
        
        # Check for examples array
        if ! grep -q "examples.*=.*\[" "$evaluator_file"; then
            print_status $RED "❌ $evaluator_file: Missing examples array"
            ((EVALUATOR_ERRORS++))
        fi
    fi
done

# Check for proper ElizaOS imports
IMPORT_ERRORS=0
if ! grep -r "from.*@elizaos/core" src/ --include="*.ts" > /dev/null; then
    if ! grep -r "from.*@ai16z/eliza" src/ --include="*.ts" > /dev/null; then
        print_status $RED "❌ No ElizaOS core imports found"
        ((IMPORT_ERRORS++))
    fi
fi

# Check for proper logger usage
LOGGER_ERRORS=0
if grep -r "console\." src/ --include="*.ts" > /dev/null; then
    print_status $YELLOW "⚠️  Found console.log usage - prefer ElizaOS logger"
    # Don't fail for this, just warn
fi

# ElizaOS compliance summary
if [[ $SERVICE_ERRORS -eq 0 && $EVALUATOR_ERRORS -eq 0 && $IMPORT_ERRORS -eq 0 ]]; then
    print_status $GREEN "✅ ElizaOS Compliance passed"
else
    print_status $RED "❌ ElizaOS Compliance failed (Services: $SERVICE_ERRORS, Evaluators: $EVALUATOR_ERRORS, Imports: $IMPORT_ERRORS)"
    ((FAILED_CHECKS++))
fi

# 5. Test execution
if ! run_check "Unit Tests" "bun test --bail"; then
    ((FAILED_CHECKS++))
fi

# 6. Database migration check (if applicable)
if [[ -d "supabase/migrations" ]]; then
    if ! run_check "Database Migration Validation" "supabase db diff --use-migra --local"; then
        print_status $YELLOW "⚠️  Database migration check failed or no changes detected"
        # Don't fail commit for migration issues
    fi
fi

# 7. MCP Configuration Validation
if [[ -f ".mcp.json" ]]; then
    if ! run_check "MCP Configuration" "node -e 'JSON.parse(require(\"fs\").readFileSync(\".mcp.json\", \"utf8\"))' > /dev/null"; then
        ((FAILED_CHECKS++))
    fi
fi

# 8. Security Check - No secrets in code
print_status $BLUE "🔒 Checking for potential secrets..."
SECURITY_VIOLATIONS=0

# Check for common secret patterns
secret_patterns=(
    "password.*=.*['\"][^'\"]*['\"]"
    "api[_-]?key.*=.*['\"][^'\"]*['\"]"
    "secret.*=.*['\"][^'\"]*['\"]"
    "token.*=.*['\"][^'\"]*['\"]"
    "POSTGRES_URL.*=.*['\"]postgresql://.*['\"]"
)

for pattern in "${secret_patterns[@]}"; do
    if git diff --cached | grep -i "$pattern" > /dev/null; then
        print_status $RED "❌ Potential secret detected: $pattern"
        ((SECURITY_VIOLATIONS++))
    fi
done

if [[ $SECURITY_VIOLATIONS -eq 0 ]]; then
    print_status $GREEN "✅ Security check passed"
else
    print_status $RED "❌ Security violations found: $SECURITY_VIOLATIONS"
    ((FAILED_CHECKS++))
fi

# Final results
cd "$ORIGINAL_DIR"

echo ""
print_status $BLUE "📊 Pre-commit Summary:"
echo "===================="

if [[ $FAILED_CHECKS -eq 0 ]]; then
    print_status $GREEN "🎉 All checks passed! Commit ready to proceed."
    echo ""
    print_status $BLUE "🔮 NUBI ElizaOS Agent - Ready for deployment"
    exit 0
else
    print_status $RED "💥 $FAILED_CHECKS check(s) failed. Commit blocked."
    echo ""
    print_status $YELLOW "💡 Tips:"
    print_status $YELLOW "   • Run 'bun run check-all' to see detailed errors"
    print_status $YELLOW "   • Use 'bun run format' to fix formatting issues"
    print_status $YELLOW "   • Ensure all services extend ElizaOS Service class"
    print_status $YELLOW "   • Use ElizaOS logger instead of console.log"
    echo ""
    exit 1
fi
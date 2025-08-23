#!/bin/bash

# NUBI ElizaOS Post-commit Hook
# Performs actions after successful commits

set -e

echo "🔮 NUBI Post-commit Hook - Processing commit..."

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Get commit information
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MESSAGE=$(git log -1 --pretty=%B)
BRANCH_NAME=$(git branch --show-current)
COMMIT_AUTHOR=$(git log -1 --pretty=%an)

print_status $BLUE "📝 Commit Details:"
print_status $BLUE "   Hash: ${COMMIT_HASH:0:8}"
print_status $BLUE "   Branch: $BRANCH_NAME"
print_status $BLUE "   Author: $COMMIT_AUTHOR"
print_status $BLUE "   Message: $(echo "$COMMIT_MESSAGE" | head -1)"

# Store original directory
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_DIR"

# 1. Update ElizaOS memory with commit info
if [[ -f "src/services/database-memory-service.ts" ]]; then
    print_status $BLUE "💾 Storing commit information in ElizaOS memory..."
    
    # Create a simple commit record (this would integrate with actual ElizaOS memory service)
    cat > ".claude/temp/last-commit.json" << EOF
{
  "hash": "$COMMIT_HASH",
  "message": "$COMMIT_MESSAGE",
  "branch": "$BRANCH_NAME",
  "author": "$COMMIT_AUTHOR",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "files_changed": $(git diff --name-only HEAD^ HEAD | wc -l)
}
EOF
    
    print_status $GREEN "✅ Commit info stored"
fi

# 2. Check if this affects ElizaOS services and restart if needed
SERVICES_CHANGED=$(git diff --name-only HEAD^ HEAD | grep "src/services/" | wc -l)
EVALUATORS_CHANGED=$(git diff --name-only HEAD^ HEAD | grep "src/evaluators/" | wc -l)
PROVIDERS_CHANGED=$(git diff --name-only HEAD^ HEAD | grep "src/providers/" | wc -l)

if [[ $SERVICES_CHANGED -gt 0 || $EVALUATORS_CHANGED -gt 0 || $PROVIDERS_CHANGED -gt 0 ]]; then
    print_status $YELLOW "🔄 ElizaOS components changed - consider restarting services"
    print_status $YELLOW "   Services: $SERVICES_CHANGED files"
    print_status $YELLOW "   Evaluators: $EVALUATORS_CHANGED files"
    print_status $YELLOW "   Providers: $PROVIDERS_CHANGED files"
    
    # Check if development server is running
    if pgrep -f "bun run dev" > /dev/null; then
        print_status $YELLOW "⚠️  Development server is running - restart recommended"
        echo "   Run: pkill -f 'bun run dev' && bun run dev"
    fi
fi

# 3. Update documentation if needed
CONFIG_CHANGED=$(git diff --name-only HEAD^ HEAD | grep -E "\.(yaml|json|toml)$" | wc -l)
if [[ $CONFIG_CHANGED -gt 0 ]]; then
    print_status $BLUE "📋 Configuration files changed - updating documentation..."
    
    # Generate config documentation
    if [[ -f "configs/nubi-config.yaml" ]]; then
        echo "# NUBI Configuration (Auto-generated on $(date))" > .claude/temp/config-summary.md
        echo "## Recent Changes" >> .claude/temp/config-summary.md
        echo "- Commit: ${COMMIT_HASH:0:8}" >> .claude/temp/config-summary.md
        echo "- Files: $(git diff --name-only HEAD^ HEAD | grep -E "\.(yaml|json|toml)$" | tr '\n' ', ')" >> .claude/temp/config-summary.md
    fi
fi

# 4. Performance tracking
if [[ -f "package.json" ]]; then
    print_status $BLUE "📊 Analyzing commit impact..."
    
    # Count lines of code changes
    LINES_ADDED=$(git diff --numstat HEAD^ HEAD | awk '{sum += $1} END {print sum + 0}')
    LINES_REMOVED=$(git diff --numstat HEAD^ HEAD | awk '{sum += $2} END {print sum + 0}')
    FILES_MODIFIED=$(git diff --name-only HEAD^ HEAD | wc -l)
    
    print_status $BLUE "   Lines added: $LINES_ADDED"
    print_status $BLUE "   Lines removed: $LINES_REMOVED"
    print_status $BLUE "   Files modified: $FILES_MODIFIED"
    
    # Store metrics
    cat > ".claude/temp/commit-metrics.json" << EOF
{
  "commit": "$COMMIT_HASH",
  "lines_added": $LINES_ADDED,
  "lines_removed": $LINES_REMOVED,
  "files_modified": $FILES_MODIFIED,
  "services_changed": $SERVICES_CHANGED,
  "evaluators_changed": $EVALUATORS_CHANGED,
  "providers_changed": $PROVIDERS_CHANGED,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
fi

# 5. Trigger CI/CD pipeline notification (if applicable)
if [[ "$BRANCH_NAME" == "main" || "$BRANCH_NAME" == "production" ]]; then
    print_status $YELLOW "🚀 Main branch commit detected"
    
    # Check if this should trigger deployment
    if echo "$COMMIT_MESSAGE" | grep -i -E "(deploy|release|production)" > /dev/null; then
        print_status $YELLOW "🎯 Deployment keywords detected in commit message"
        print_status $YELLOW "   Consider running: bun run build && bun run start:production"
    fi
fi

# 6. Raid system impact check
RAID_FILES_CHANGED=$(git diff --name-only HEAD^ HEAD | grep -E "(raid|telegram)" | wc -l)
XMCPX_CHANGED=$(git diff --name-only HEAD^ HEAD | grep "xmcpx" | wc -l)

if [[ $RAID_FILES_CHANGED -gt 0 || $XMCPX_CHANGED -gt 0 ]]; then
    print_status $YELLOW "⚡ Raid system components changed"
    print_status $YELLOW "   Verify XMCPX MCP server compatibility"
    print_status $YELLOW "   Test raid coordination functionality"
fi

# 7. Database schema changes
MIGRATION_CHANGED=$(git diff --name-only HEAD^ HEAD | grep "migrations/" | wc -l)
if [[ $MIGRATION_CHANGED -gt 0 ]]; then
    print_status $YELLOW "🗄️  Database migrations changed"
    print_status $YELLOW "   Run migrations: supabase db push --local"
    print_status $YELLOW "   Verify schema compatibility"
fi

# 8. Clean up temporary files
mkdir -p .claude/temp

# 9. Security audit for sensitive changes
SENSITIVE_FILES_CHANGED=$(git diff --name-only HEAD^ HEAD | grep -E "(env|secret|key|auth|token)" | wc -l)
if [[ $SENSITIVE_FILES_CHANGED -gt 0 ]]; then
    print_status $YELLOW "🔒 Sensitive files may have changed"
    print_status $YELLOW "   Verify no secrets were committed"
    print_status $YELLOW "   Update environment configurations if needed"
fi

# Return to original directory
cd "$ORIGINAL_DIR"

# Final summary
echo ""
print_status $GREEN "✅ Post-commit processing completed"
print_status $BLUE "🔮 NUBI ElizaOS Agent - Commit ${COMMIT_HASH:0:8} processed"

# Check if any recommendations were made
if [[ $SERVICES_CHANGED -gt 0 || $MIGRATION_CHANGED -gt 0 || $RAID_FILES_CHANGED -gt 0 ]]; then
    echo ""
    print_status $YELLOW "💡 Recommendations:"
    print_status $YELLOW "   • Review changed components for compatibility"
    print_status $YELLOW "   • Test affected systems thoroughly"
    print_status $YELLOW "   • Update relevant documentation"
fi

exit 0
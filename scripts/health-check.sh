#!/bin/bash

# Health check script for deployments
set -e

ENVIRONMENT=${1:-staging}
BASE_URL=${2:-http://localhost:8080}

echo "Running health checks for $ENVIRONMENT environment..."

# Check health endpoint
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ $HEALTH_RESPONSE -ne 200 ]; then
  echo "Health check failed: HTTP $HEALTH_RESPONSE"
  exit 1
fi

echo "Health check passed"

# Check readiness
READY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health/ready)
if [ $READY_RESPONSE -ne 200 ]; then
  echo "Readiness check failed: HTTP $READY_RESPONSE"
  exit 1
fi

echo "Readiness check passed"
echo "All health checks passed successfully!"

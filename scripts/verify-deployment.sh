#!/bin/bash

# Verify deployment script
set -e

echo "Verifying deployment..."

# Check if all pods are running (for Kubernetes)
if command -v kubectl &> /dev/null; then
  kubectl get pods -n production | grep -v "Running" | grep -v "NAME" && {
    echo "Some pods are not running"
    exit 1
  }
fi

echo "Deployment verified successfully!"

# NUBI Agent Project Structure

## Core Directories

### `/anubis`
**PRODUCTION CODE** - Character implementation
- `characters/` - Character configurations and raid definitions
- `src/services/` - Raid orchestrator and other services

### `/src`
Main application source code
- `api/` - REST API endpoints
- `services/` - Core services
- `utils/` - Utility functions
- `types/` - TypeScript type definitions
- `index.ts` - Application entry point

### `/docker`
Docker configurations for containerization
- `Dockerfile.agent` - Main agent image
- `Dockerfile.api` - API service image
- `docker-compose.yml` - Full stack configuration

### `/k8s`
Kubernetes deployment manifests
- `production/` - Production deployment configs

### `/monitoring`
Observability and monitoring setup
- Prometheus configuration
- Grafana dashboards
- Alert rules

### `/tests`
Test suites
- `unit/` - Unit tests
- `integration/` - Integration tests
- `e2e/` - End-to-end tests

### `/docs`
Comprehensive documentation
- `architecture/` - System design documents
- `technical/` - API and technical specs
- `guides/` - User and deployment guides

### `/scripts`
Utility and deployment scripts
- `health-check.sh` - Health verification
- `verify-deployment.sh` - Deployment validation
- `project-setup.sh` - Developer setup

### `/.github`
CI/CD workflows
- `workflows/ci-cd.yml` - GitHub Actions pipeline

## Configuration Files

- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Test configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc.json` - Code formatting
- `.gitignore` - Git ignore patterns
- `.dockerignore` - Docker ignore patterns
- `.env.example` - Environment variable template

## Important Notes

⚠️ **DO NOT DELETE**:
- `/anubis` - Contains character implementation
- `/src` - Core application code
- Any configuration files in root

✅ **Safe to Remove** (already in .gitignore):
- `node_modules/`
- `dist/`
- `.env` (local only)
- Build artifacts
- Log files

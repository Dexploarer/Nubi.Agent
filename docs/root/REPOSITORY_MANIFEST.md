# Repository Manifest - IMPORTANT FILES

## ⚠️ CRITICAL PRODUCTION CODE - DO NOT DELETE

### `/anubis` Directory (138+ files)
This is the MAIN CHARACTER IMPLEMENTATION - Contains all the NUBI agent logic

#### Essential Subdirectories:
- **`/anubis/src/`** - Core source code
  - `services/` - All service implementations (personality, raids, etc.)
  - `telegram-raids/` - Telegram raid coordination system
  - `providers/` - Data providers
  - `evaluators/` - Response evaluators
  - `actions/` - Agent actions
  - `__tests__/` - Test suites
  
- **`/anubis/config/`** - Configuration files
  - `nubi-config.yaml` - Main NUBI character configuration
  - `anubis-config.yaml` - Agent settings
  - `anubis-raid-config.yaml` - Raid system config
  
- **`/anubis/supabase/`** - Backend functions
  - `functions/` - Edge functions for real-time features
  - `migrations/` - Database schemas

### `/twitter-mcp-server` Directory
Complete Twitter/X integration implementation
- Authentication system
- Tweet posting
- Profile management
- Raid monitoring

### `/analytics` Directory
ClickHouse analytics implementation
- Database schemas
- Query scripts
- Dashboard configurations

### `/src` Directory
Main application entry points and API
- REST API endpoints
- Core services
- WebSocket handlers

## ✅ Files Safe to Exclude (in .gitignore)

### Build Outputs
- `dist/` - Compiled JavaScript
- `node_modules/` - Dependencies
- `*.log` - Log files
- `coverage/` - Test coverage reports

### Local Configuration
- `.env` - Local environment variables (keep .env.example)
- `.mcp.json` - Local MCP config
- IDE files (.vscode, .idea)

### Temporary Files
- Database data directories
- Cache files
- OS-specific files (.DS_Store, Thumbs.db)

## 📁 Repository Statistics

- **Total TypeScript/JS files in anubis**: 138+
- **Supabase functions**: 10+
- **Test files**: 50+
- **Configuration files**: Multiple YAML configs
- **Twitter integration files**: 30+

## ⚠️ WARNING

The following directories contain PRODUCTION CODE and should NEVER be deleted:
1. `/anubis` - Character implementation (500+ KB of code)
2. `/twitter-mcp-server` - Twitter integration
3. `/analytics` - Analytics system
4. `/src` - Core application
5. `/docker` - Deployment configs
6. `/k8s` - Kubernetes manifests
7. `/monitoring` - Observability setup

Only delete files that are:
- Generated (dist/, node_modules/)
- Local config (.env, .mcp.json)
- Temporary (logs, cache)
- Test outputs (coverage/)

## Development Setup

For new developers:
1. Clone the repository with ALL directories
2. Run `npm install` to get dependencies
3. Copy `.env.example` to `.env`
4. Build with `npm run build`
5. Start with `npm run dev`

The anubis directory contains the heart of the NUBI agent - it's not legacy code, it's the production implementation!

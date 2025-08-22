# NUBI Database Configuration

NUBI supports dual database configuration for different environments using ElizaOS SQL plugin.

## Database Backends

### Development: PGLite (Default)
- **Type**: Embedded PostgreSQL in WebAssembly
- **Location**: `./.eliza/.elizadb`
- **Benefits**: 
  - No external dependencies
  - Fast startup
  - Perfect for development and testing
  - Automatic migrations

### Production: PostgreSQL
- **Type**: Full PostgreSQL server
- **Benefits**:
  - Production-grade performance
  - Scalability
  - Full PostgreSQL features
  - Robust for high-load scenarios

## Environment Configuration

### Development (.env)
```bash
# PGLite configuration (default)
PGLITE_DATA_DIR=./.eliza/.elizadb
NODE_ENV=development
```

### Production (.env.production)
```bash
# PostgreSQL configuration
POSTGRES_URL=postgresql://user:password@localhost:5432/nubi
NODE_ENV=production
```

## Usage

### Development Mode (PGLite)
```bash
# Standard development
bun run dev

# Explicit PGLite mode
bun run dev:pglite
```

### Production Mode (PostgreSQL)
```bash
# Production with PostgreSQL
bun run start:production
```

## Database Adapter Selection

The ElizaOS SQL plugin automatically selects the appropriate database adapter:

1. **If `POSTGRES_URL` is set**: Uses PostgreSQL adapter
2. **If `PGLITE_DATA_DIR` is set**: Uses PGLite adapter  
3. **Default**: Falls back to PGLite with `./.eliza/.elizadb`

## Directory Structure

```
.eliza/
├── .elizadb/          # PGLite database files (development)
├── config.json        # ElizaOS configuration
└── data/              # Additional data storage
```

## Migrations

Both database backends support automatic schema migrations:
- Handled by ElizaOS DatabaseMigrationService
- Runs automatically on startup
- Creates required tables for agents, memories, rooms, etc.

## Troubleshooting

### PGLite Issues
- Ensure `.eliza/.elizadb` directory exists and is writable
- Check WASM support in your environment
- Verify `PGLITE_DATA_DIR` environment variable

### PostgreSQL Issues  
- Verify PostgreSQL server is running
- Check connection string format
- Ensure database exists and user has proper permissions
- Install required PostgreSQL extensions (vector, etc.)

## Vector Embeddings

Both backends support vector embeddings with dimensions:
- SMALL: 384
- MEDIUM: 512  
- LARGE: 768
- XL: 1024
- XXL: 1536
- XXXL: 3072

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PGLITE_DATA_DIR` | PGLite data directory | `./.eliza/.elizadb` |
| `POSTGRES_URL` | PostgreSQL connection string | - |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Database logging level | `info` |

---

*Configured for optimal development experience with PGLite and production scalability with PostgreSQL.*
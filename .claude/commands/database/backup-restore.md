# Database Backup and Restore

Create and manage database backups for NUBI ElizaOS data.

**Usage**: `/project:backup-restore [operation] [backup_name]`

## Task

Perform database backup or restore operation:

Operation: $ARGUMENTS

## Backup Operations

### 1. Create Full Backup

```bash
# PostgreSQL backup with compression
pg_dump $POSTGRES_URL \
  --format=custom \
  --compress=9 \
  --verbose \
  --file=backups/nubi-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Include ElizaOS memory data
pg_dump $POSTGRES_URL \
  --table=memories \
  --table=relationships \
  --table=participants \
  --table=rooms \
  --format=custom \
  --compress=9 \
  --file=backups/nubi-memories-$(date +%Y%m%d-%H%M%S).sql.gz
```

### 2. PGLite Development Backup

```bash
# Backup PGLite database directory
tar -czf backups/pglite-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  ./.eliza/.elizadb/

# Verify backup integrity
tar -tzf backups/pglite-backup-*.tar.gz | head -20
```

### 3. Incremental Backup Strategy

```bash
# Create incremental backup script
#!/bin/bash
BACKUP_DIR="backups/incremental"
LAST_BACKUP=$(find $BACKUP_DIR -name "*.sql.gz" | sort | tail -1)
CURRENT_TIME=$(date +%Y%m%d-%H%M%S)

if [ -z "$LAST_BACKUP" ]; then
  # First backup - full backup
  pg_dump $POSTGRES_URL \
    --format=custom \
    --compress=9 \
    --file=$BACKUP_DIR/full-backup-$CURRENT_TIME.sql.gz
else
  # Incremental backup using WAL archiving
  pg_basebackup \
    -D $BACKUP_DIR/incremental-$CURRENT_TIME \
    -Ft -z -P
fi
```

## Restore Operations

### 1. Full Database Restore

```bash
# Drop existing database (CAUTION!)
dropdb nubi_database

# Create new database
createdb nubi_database

# Restore from backup
pg_restore \
  --dbname=$POSTGRES_URL \
  --verbose \
  --clean \
  --if-exists \
  backups/nubi-backup-YYYYMMDD-HHMMSS.sql.gz
```

### 2. Selective Memory Restore

```bash
# Restore only memory tables
pg_restore \
  --dbname=$POSTGRES_URL \
  --table=memories \
  --table=relationships \
  --verbose \
  --clean \
  backups/nubi-memories-YYYYMMDD-HHMMSS.sql.gz
```

### 3. PGLite Development Restore

```bash
# Stop development server
pkill -f "bun run dev"

# Remove existing database
rm -rf ./.eliza/.elizadb/

# Restore from backup
tar -xzf backups/pglite-backup-YYYYMMDD-HHMMSS.tar.gz

# Restart development server
bun run dev
```

## Automated Backup Scripts

### Daily Backup Cron Job

```bash
# Add to crontab: crontab -e
0 2 * * * /root/dex/anubis/scripts/daily-backup.sh

# daily-backup.sh
#!/bin/bash
cd /root/dex/anubis
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

# Create backup
pg_dump $POSTGRES_URL \
  --format=custom \
  --compress=9 \
  --file=backups/daily/nubi-$BACKUP_DATE.sql.gz

# Clean old backups (keep last 30 days)
find backups/daily/ -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup status
echo "$(date): Backup completed - nubi-$BACKUP_DATE.sql.gz" >> logs/backup.log
```

### Pre-Migration Backup

```bash
#!/bin/bash
# Run before database migrations
echo "Creating pre-migration backup..."

MIGRATION_BACKUP="backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump $POSTGRES_URL \
  --format=custom \
  --compress=9 \
  --file=$MIGRATION_BACKUP

if [ $? -eq 0 ]; then
  echo "Pre-migration backup created: $MIGRATION_BACKUP"
  export PRE_MIGRATION_BACKUP=$MIGRATION_BACKUP
else
  echo "Backup failed! Aborting migration."
  exit 1
fi
```

## Backup Validation

### Integrity Checks

```bash
# Validate backup file integrity
pg_restore --list backups/nubi-backup-YYYYMMDD-HHMMSS.sql.gz

# Test restore to temporary database
createdb nubi_test_restore
pg_restore \
  --dbname=postgresql://localhost/nubi_test_restore \
  --verbose \
  backups/nubi-backup-YYYYMMDD-HHMMSS.sql.gz

# Verify data integrity
psql postgresql://localhost/nubi_test_restore -c "
  SELECT 
    COUNT(*) as memory_count,
    MAX(created_at) as latest_memory,
    COUNT(DISTINCT user_id) as unique_users
  FROM memories;
"

# Cleanup test database
dropdb nubi_test_restore
```

### Backup Monitoring

```typescript
// Monitor backup status in ElizaOS
const validateBackupStatus = async (runtime: IAgentRuntime) => {
  const backupDir = "backups/";
  const latestBackup = await getLatestBackupFile(backupDir);
  
  if (!latestBackup) {
    logger.error("[BACKUP_MONITOR] No recent backups found");
    return false;
  }
  
  const backupAge = Date.now() - latestBackup.modifiedTime;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (backupAge > maxAge) {
    logger.warn("[BACKUP_MONITOR] Backup is older than 24 hours");
    return false;
  }
  
  logger.info("[BACKUP_MONITOR] Backup status OK");
  return true;
};
```

## Recovery Procedures

### Disaster Recovery Plan

1. **Immediate Response**
   - Stop all services
   - Assess data loss extent
   - Identify latest valid backup

2. **Recovery Execution**
   - Restore database from latest backup
   - Validate data integrity
   - Test critical functionality

3. **Service Restoration**
   - Restart ElizaOS services
   - Verify memory operations
   - Test raid coordination system

### Point-in-Time Recovery

```bash
# PostgreSQL point-in-time recovery
pg_basebackup -D /tmp/recovery -Ft -z -P
pg_ctl -D /tmp/recovery start
```

Ensure regular backup validation and maintain multiple backup retention policies for comprehensive data protection.
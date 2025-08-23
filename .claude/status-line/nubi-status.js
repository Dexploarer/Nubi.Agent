// NUBI ElizaOS Status Line Configuration
// Dynamic status line for monitoring NUBI agent systems

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class NUBIStatusLine {
  constructor() {
    this.refreshInterval = 5000; // 5 seconds
    this.cache = new Map();
  }

  async getElizaOSStatus() {
    try {
      const cacheKey = 'elizaos-status';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 3000) {
        return cached.value;
      }

      // Check if ElizaOS services are running
      const packageJson = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
        const hasElizaOS = pkg.dependencies && (
          pkg.dependencies['@elizaos/core'] || 
          pkg.dependencies['@ai16z/eliza']
        );
        
        if (hasElizaOS) {
          // Check if dev server is running
          try {
            const processes = execSync('ps aux | grep "bun run dev" | grep -v grep', { encoding: 'utf8' });
            const isRunning = processes.trim().length > 0;
            const status = isRunning ? 'RUNNING' : 'STOPPED';
            
            this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
            return status;
          } catch (error) {
            this.cache.set(cacheKey, { value: 'STOPPED', timestamp: Date.now() });
            return 'STOPPED';
          }
        }
      }
      
      this.cache.set(cacheKey, { value: 'N/A', timestamp: Date.now() });
      return 'N/A';
    } catch (error) {
      return 'ERROR';
    }
  }

  async getRaidStatus() {
    try {
      const cacheKey = 'raid-status';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 10000) {
        return cached.value;
      }

      // Check for active raids by looking at recent log files or database
      const logDir = path.join(process.cwd(), 'logs');
      if (fs.existsSync(logDir)) {
        const logFiles = fs.readdirSync(logDir).filter(f => f.includes('raid'));
        
        if (logFiles.length > 0) {
          // Check most recent raid log for activity
          const latestLog = logFiles.sort().pop();
          const logPath = path.join(logDir, latestLog);
          const stats = fs.statSync(logPath);
          const age = Date.now() - stats.mtime.getTime();
          
          if (age < 300000) { // 5 minutes
            const status = 'ACTIVE';
            this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
            return status;
          }
        }
      }

      // Check if XMCPX server is available
      try {
        execSync('npx -y @promptordie/xmcpx@1.2.0 --version', { encoding: 'utf8', stdio: 'pipe' });
        const status = 'READY';
        this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
        return status;
      } catch (error) {
        this.cache.set(cacheKey, { value: 'OFFLINE', timestamp: Date.now() });
        return 'OFFLINE';
      }
    } catch (error) {
      return 'ERROR';
    }
  }

  async getDatabaseStatus() {
    try {
      const cacheKey = 'db-status';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 5000) {
        return cached.value;
      }

      // Check PostgreSQL connection
      if (process.env.POSTGRES_URL) {
        try {
          // Simple connection test using psql
          execSync(`psql "${process.env.POSTGRES_URL}" -c "SELECT 1" > /dev/null 2>&1`, { timeout: 3000 });
          const status = 'POSTGRES';
          this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
          return status;
        } catch (error) {
          // Fall back to check if PGLite database exists
          const pglitePath = path.join(process.cwd(), '.eliza', '.elizadb');
          if (fs.existsSync(pglitePath)) {
            const status = 'PGLITE';
            this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
            return status;
          }
        }
      } else {
        // Check PGLite database
        const pglitePath = path.join(process.cwd(), '.eliza', '.elizadb');
        if (fs.existsSync(pglitePath)) {
          const status = 'PGLITE';
          this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
          return status;
        }
      }
      
      this.cache.set(cacheKey, { value: 'NO_DB', timestamp: Date.now() });
      return 'NO_DB';
    } catch (error) {
      return 'ERROR';
    }
  }

  async getMCPStatus() {
    try {
      const cacheKey = 'mcp-status';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 8000) {
        return cached.value;
      }

      // Check MCP configuration file
      const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
      if (!fs.existsSync(mcpConfigPath)) {
        this.cache.set(cacheKey, { value: 'NO_CONFIG', timestamp: Date.now() });
        return 'NO_CONFIG';
      }

      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
      const serverCount = Object.keys(mcpConfig.mcpServers || {}).length;
      
      if (serverCount === 0) {
        this.cache.set(cacheKey, { value: 'NO_SERVERS', timestamp: Date.now() });
        return 'NO_SERVERS';
      }

      // Check if key servers are available
      const keyServers = ['xmcpx', 'supabase', 'filesystem'];
      const availableServers = keyServers.filter(server => 
        mcpConfig.mcpServers && mcpConfig.mcpServers[server]
      );

      const status = `${availableServers.length}/${keyServers.length}`;
      this.cache.set(cacheKey, { value: status, timestamp: Date.now() });
      return status;
    } catch (error) {
      return 'ERROR';
    }
  }

  async getGitStatus() {
    try {
      const cacheKey = 'git-status';
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 10000) {
        return cached.value;
      }

      // Get git branch and status
      try {
        const branch = execSync('git branch --show-current', { encoding: 'utf8', timeout: 1000 }).trim();
        const status = execSync('git status --porcelain', { encoding: 'utf8', timeout: 1000 }).trim();
        
        const isDirty = status.length > 0;
        const gitStatus = `${branch}${isDirty ? '*' : ''}`;
        
        this.cache.set(cacheKey, { value: gitStatus, timestamp: Date.now() });
        return gitStatus;
      } catch (error) {
        this.cache.set(cacheKey, { value: 'NO_GIT', timestamp: Date.now() });
        return 'NO_GIT';
      }
    } catch (error) {
      return 'ERROR';
    }
  }

  async getCurrentWorkingDirectory() {
    try {
      const cwd = process.cwd();
      const projectName = path.basename(cwd);
      
      // Check if this is the NUBI project
      if (projectName === 'anubis' || projectName.includes('nubi')) {
        return '🔮 NUBI';
      }
      
      return projectName;
    } catch (error) {
      return 'unknown';
    }
  }

  async generateStatusLine() {
    try {
      const [cwd, elizaStatus, raidStatus, dbStatus, mcpStatus, gitStatus] = await Promise.all([
        this.getCurrentWorkingDirectory(),
        this.getElizaOSStatus(),
        this.getRaidStatus(),
        this.getDatabaseStatus(),
        this.getMCPStatus(),
        this.getGitStatus()
      ]);

      // Color coding for status
      const statusColors = {
        RUNNING: '🟢',
        STOPPED: '🔴',
        ACTIVE: '⚡',
        READY: '🟡',
        OFFLINE: '🔴',
        POSTGRES: '🟢',
        PGLITE: '🟡',
        NO_DB: '🔴',
        ERROR: '❌'
      };

      const elizaIcon = statusColors[elizaStatus] || '⚪';
      const raidIcon = statusColors[raidStatus] || '⚪';
      const dbIcon = statusColors[dbStatus] || '⚪';

      return `${cwd} | ElizaOS:${elizaIcon}${elizaStatus} | Raids:${raidIcon}${raidStatus} | DB:${dbIcon}${dbStatus} | MCP:${mcpStatus} | Git:${gitStatus}`;
    } catch (error) {
      return `🔮 NUBI | Status Error: ${error.message}`;
    }
  }

  // Main export function for Claude Code CLI
  async getStatus() {
    return await this.generateStatusLine();
  }
}

// Export for Claude Code CLI
module.exports = async () => {
  const statusLine = new NUBIStatusLine();
  return await statusLine.getStatus();
};

// Also export the class for testing
module.exports.NUBIStatusLine = NUBIStatusLine;
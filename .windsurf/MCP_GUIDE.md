# MCP Guide

Using `@elizaos/plugin-mcp` (see `package.json`).

## Setup
- Configure MCP servers via plugin config or env.
- Restrict accessible resources; principle of least privilege.

## Security
- Validate inputs; treat outputs as untrusted data.
- Timeouts and size limits for MCP responses.

## Testing
- Mock MCP calls in unit tests; integration tests only in sandbox.

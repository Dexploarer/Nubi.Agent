# Run Development Checks

Run comprehensive checks on the NUBI codebase including TypeScript, formatting, tests, and ElizaOS compliance.

**Usage**: `/project:run-checks [check_type]`

## Task

Run development checks for the NUBI ElizaOS-based AI agent:

Check type: $ARGUMENTS (default: all)

## Available Checks

- `typescript` - TypeScript type checking
- `format` - Code formatting with Prettier
- `tests` - Run all Bun tests
- `lint` - Lint and format code
- `integration` - Integration test validation
- `elizaos` - ElizaOS compliance checking
- `all` - Run all checks

## Commands to Execute

```bash
# TypeScript type checking
bun run type-check

# Code formatting
bun run format

# Run all tests
bun run test

# Lint and format
bun run lint  

# Comprehensive check
bun run check-all

# Integration validation
bun run validate:integrations

# ElizaOS compliance
bun run enforce-standards
```

## Success Criteria

1. ✅ TypeScript compilation without errors
2. ✅ All tests passing
3. ✅ Code properly formatted
4. ✅ No linting errors
5. ✅ Integration tests successful
6. ✅ ElizaOS patterns validated

## Post-Check Actions

If any checks fail:
1. Review the error output
2. Fix issues systematically
3. Re-run failed checks
4. Ensure all checks pass before committing

Focus on maintaining ElizaOS compliance and NUBI architectural integrity.
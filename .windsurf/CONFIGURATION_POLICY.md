# Configuration Policy

## Sources
- YAML: `config/nubi-config.yaml` preferred; fallback `config/anubis-config.yaml` (managed by `yaml-config-manager`).
- Env: validated in `src/config/environment.ts`.

## Rules
- No hardcoded secrets.
- Document all new config keys; update `.env.example` and YAML defaults if applicable.
- Provide sensible defaults; validate ranges (e.g., raid timings).

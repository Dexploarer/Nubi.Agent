# App Configs (YAML)

This folder centralizes YAML configs to simplify wiring and deployment.

- `raid-config.yaml`: Unified Telegram/X raid settings and personas.
  - Consolidates prior `config/anubis-raid-config.yaml` and `config/personalities/raid-personas.yaml`.
  - Intended to be consumed by raid services (`raid-coordinator`, `raid-flow`, `user-initiated-raid-flow`).

Planned migration (wiring):
- Update raid services to prefer `configs/raid-config.yaml`.
- Deprecate `config/anubis-raid-config.yaml` and remove after code switches.
- Keep `config/nubi-config.yaml` as the primary character config for now; later we can relocate to this folder and point `YAMLConfigManager` at `./configs`.

Notes:
- No runtime code changed yet to avoid breaking flows. Wiring can be part of a follow-up PR.
- `config/personalities/raid-personas.yaml` has been merged and removed.

# Templates Guide

## YAML Templates
- Managed by `src/config/yaml-config-manager.ts` under `templates`.
- Use `getTemplate(name)` to retrieve; keep templates concise and adaptable.

## Bootstrap Templates
- If overriding should-respond or message templates, keep diffs minimal and add tests documenting behavior changes.

Deployment Artifacts

This directory groups Docker and Kubernetes assets for deploying the NUBI (ElizaOS) agent.

Structure
- docker/: Dockerfiles and compose files for local and single-host setups
- k8s/: Kubernetes manifests for production, including blue/green deployments

Kubernetes (blue/green)
- Active service points at the color via label selector `version: green|blue`.
- Switch traffic by editing the Service selector to the desired color.

Commands
- Apply green: `kubectl apply -f deploy/k8s/production/green/`
- Apply blue: `kubectl apply -f deploy/k8s/production/blue/`
- Apply service: `kubectl apply -f deploy/k8s/production/service.yaml`
- Switch traffic: `kubectl -n production patch service nubi-agent -p '{"spec":{"selector":{"app":"nubi-agent","version":"blue"}}}'`

Secrets
Create a secret named `nubi-secrets` in the `production` namespace with required keys (examples):
- openai-api-key
- telegram-bot-token
- supabase-url
- supabase-anon-key
- database-url (if used)
- redis-url (if used)
- clickhouse-host, clickhouse-user, clickhouse-password (optional)

Health Probes
- Probes target `GET /health` on port 8080 by default, matching the app’s existing endpoint.


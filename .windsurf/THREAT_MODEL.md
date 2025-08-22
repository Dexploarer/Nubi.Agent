# Threat Model

## Threats
- Prompt injection, phishing links, spam/abuse, token leakage, rate exhaustion.

## Controls
- Security evaluator first; link detection; rate limits; secret management; retries/circuit breakers.

## Residual Risks
- Model hallucinations; platform API changes; 3rd-party outages.

## Response
- Disable features via env; rotate keys; hotfix evaluators/services.

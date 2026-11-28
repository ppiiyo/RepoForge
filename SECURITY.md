# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| < 0.3   | Best effort |

## Scope

RepoForge adds baseline repository infrastructure. It is **not** a full SAST/SCA scanner.

## Protected paths

Never modifies `.env` / `.env.*`, PEM/P12 keys, common credential JSON. Path traversal is rejected.

## Reporting

Use GitHub private security advisories. Do not post secrets in public issues.

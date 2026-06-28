# 🔒 Security

See `persona.md` for how to review and comment.

Review whether the change is safe against misuse.

Check:
- **AuthN/AuthZ** - access checks correct and in the right place.
- **Input validation** - untrusted input validated/sanitized; injection (SQL, command, path,
  XSS) prevented.
- **Secrets & credentials** - no hardcoded keys/tokens; secrets stored and transmitted
  securely, never logged or committed.
- **Sensitive data** - PII and similar minimized, protected at rest and in transit, and kept
  out of logs and error messages.
- **Dependencies** - new packages trusted and pinned; review the dependency chain for known
  vulnerabilities and transitive risk.

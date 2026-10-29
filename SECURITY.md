# Security

orpeek sends credentials only to https://openrouter.ai/api/v1 and rejects
redirects. It makes read-only credits/metadata requests and analytics queries.
No completions, administrative writes, telemetry, or local usage cache.

The management key lives in the macOS login Keychain as a generic password:
service com.orpeek.openrouter, account default. A small bundled native helper
receives new credentials through stdin, never argv or environment variables.
Retrieval uses a private pipe. Keychain errors never fall back to plaintext.
macOS may request permission to access the item.

Setup validates both management metadata and billing access before replacing
an existing key. auth remove deletes the item. auth status reports local
presence, not remote validity. Secrets exist transiently in process memory.
Keychain does not protect against a compromised logged-in session.

Report vulnerabilities privately using GitHub's private vulnerability reporting
if enabled, or contact the repository owner privately. Do not post keys in issues.

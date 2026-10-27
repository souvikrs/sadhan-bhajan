# Sadhan Bhajan (for Thakur & Souvik)

A private sadhana app. Everything private in `docs/data` is encrypted (AES-256-GCM, key from a passphrase via PBKDF2); the source content and the passphrase are never committed.

- Edit the app in `app/`, the content in `content/` (local only).
- `python3 build.py` encrypts and writes `docs/`, which GitHub Pages serves.
- See `PLAN.md` for what the app does and why.

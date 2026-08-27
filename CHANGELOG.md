# Changelog


## 1.0.1

### Fixed

- Restore `String.toLowerCase` after an accidental case-to-task rename typo that broke `tsc` / publish.


## 1.0.0

### Breaking

- Rename n8n resource/ops from case to task; Public API paths use /tasks/.

## 0.2.5

- Remove `usableAsTool: true` from the Trigger node (n8n community lint / review).
- Release via version tags only so `package.json` on `main` matches npm (no local-only CI bump).

## 0.2.4

- Published to npm from CI without pushing the version bump to `main` (superseded by 0.2.5 process).

## 0.2.3

- Node identifiers and categories updates.

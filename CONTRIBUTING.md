# Contributing

Thanks for helping improve **@praxicraft/n8n-nodes-assess**. Public install and usage docs live in the [README](./README.md) and on [docs.praxicraft.com/integrations/n8n](https://docs.praxicraft.com/integrations/n8n). This file is for people changing the package itself.

## Development setup

Requirements: **Node.js 18+**.

```bash
git clone https://github.com/praxicraft-platform/n8n-nodes-praxicraft-assess.git
cd n8n-nodes-praxicraft-assess
# --ignore-scripts: n8n-workflow pulls isolated-vm; we only need TypeScript types
npm ci --ignore-scripts
npm test
npm run build
```

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm test` | Typecheck tests + run Node test runner |
| `npm run build` | Compile to `dist/` and copy icons |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | n8n community node linter (`@n8n/node-cli`) |
| `npm run dev` | `tsc --watch` |

### Project layout

| Path | Role |
|------|------|
| `nodes/PraxicraftAssess/` | Action node (Public API resources / operations) |
| `nodes/PraxicraftAssessTrigger/` | Webhook trigger (register / verify / tear down) |
| `credentials/` | `PraxicraftAssessApi` credential + connection test |
| `tests/` | Unit / parity tests |
| `package.json` → `n8n` | Declares built credential + node entrypoints under `dist/` |

Match Public API wire names (`task` / `tasks`, not legacy `case`) when adding operations. Keep option lists **alphabetized by `name`** — n8n’s community linter requires it.

### Self-hosted npm install (maintainers)

For local or air-gapped n8n hosts (not Cloud):

```bash
cd ~/.n8n
npm install @praxicraft/n8n-nodes-assess
```

Enable community packages per [n8n’s installation docs](https://docs.n8n.io/integrations/community-nodes/installation/). Restart n8n after install.

### Community verifier checklist

Before submitting or updating the package on n8n’s community registry:

```bash
npx @n8n/node-cli@latest lint
npx @n8n/scan-community-package @praxicraft/n8n-nodes-assess
```

Fix any alphabetization / lint findings, then publish a new npm version (see [Releasing](#releasing)).

## Pull requests

1. Branch from `main`.
2. Keep changes focused; update [CHANGELOG.md](./CHANGELOG.md) for user-visible behaviour.
3. Run `npm test` and `npm run lint` locally.
4. Open a PR against `main`. CI must pass.

Use conventional commit subjects when practical (`fix:`, `feat:`, `docs:`, `chore(release):`).

## Releasing

Version on `main` (`package.json`) must always match the npm package. Do **not** bump only in CI.

1. In a PR: bump `package.json` (and `package-lock.json`) version, update `CHANGELOG.md`, land the code or docs change.
2. After merge to `main`, create an annotated tag matching that version and push it:

```bash
git checkout main && git pull
VERSION="$(node -p "require('./package.json').version")"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
```

3. The **Publish to npm** workflow runs on `v*` tags, verifies tag ≡ `package.json`, publishes with provenance, and creates a GitHub Release.

`workflow_dispatch` can re-run publish for an existing tag (skips npm if that version is already published).

Requires npm Trusted Publishing for `@praxicraft/n8n-nodes-assess` ↔ this repository (or `NPM_TOKEN` with publish rights on the `@praxicraft` org).

Shorter note also kept in [RELEASING.md](./RELEASING.md).

## Docs

- User-facing README and Mintlify guide should stay aligned (screenshots live under `praxicraft-assess-docs` → `images/n8n/`, served at `https://docs.praxicraft.com/images/n8n/…`).
- Prefer absolute docs URLs in the README so images render on GitHub and npm.

## Support channels

- Product bugs / API behaviour: [support@praxicraft.com](mailto:support@praxicraft.com) or Assess dashboard support
- Package issues / PRs: [GitHub Issues](https://github.com/praxicraft-platform/n8n-nodes-praxicraft-assess/issues)

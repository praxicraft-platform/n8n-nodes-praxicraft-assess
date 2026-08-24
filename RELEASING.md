# Releasing

Version on `main` (`package.json`) must always match the npm package. Do **not** bump only in CI.

1. In a PR: bump `package.json` version, update `CHANGELOG.md`, land the code fix.
2. After merge to `main`, create an annotated tag matching that version and push it:

```bash
git checkout main && git pull
VERSION="$(node -p "require('./package.json').version")"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
```

3. The `Publish to npm` workflow runs on `v*` tags, verifies tag ≡ `package.json`, publishes with provenance, and creates a GitHub Release.

`workflow_dispatch` can re-run publish for an existing tag (skips npm if that version is already published).

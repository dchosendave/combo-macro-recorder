# Development and release workflow

This project uses Conventional Commits, pull-request CI, and Release Please. Normal development does not require manually editing app versions, creating release tags, or running the version-bump scripts.

## 1. Start a change

Update local `main`, then create a focused branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/combo-templates
```

Use a descriptive branch prefix:

| Change | Example branch |
| --- | --- |
| Feature | `feat/combo-templates` |
| Bug fix | `fix/hotkey-registration` |
| Documentation | `docs/release-guide` |
| Maintenance | `chore/update-dependencies` |
| Tests | `test/combo-import` |
| Refactor | `refactor/runner-state` |

Branch names help people navigate the repository, but they do not determine the next version. Commit messages do.

## 2. Make and verify the change

Run the checks relevant to the change. Before opening a substantial PR, run the full suite from the repository root:

```bash
npm run version:check
npm run build
npm test
cargo test --locked
```

Windows-only manual behavior should also follow [manual-qa.md](manual-qa.md).

## 3. Commit with a release-aware message

Stage and commit the change:

```bash
git add -A
git commit -m "feat: add combo templates"
```

Release Please derives the next Semantic Version from Conventional Commits:

| Commit | Effect | Example from `1.0.12` |
| --- | --- | --- |
| `fix: ...` | Patch | `1.0.13` |
| `feat: ...` | Minor | `1.1.0` |
| `feat!: ...` | Major | `2.0.0` |
| Commit body containing `BREAKING CHANGE:` | Major | `2.0.0` |
| `docs:`, `test:`, `chore:`, `refactor:` | Normally no release | unchanged |

Use `fix:` for bugs; a separate `bug:` type is unnecessary. Describe what changed after the prefix. Do not label a maintenance change as a feature merely to force a release.

If the repository uses squash merging, ensure the PR title is also a valid Conventional Commit, because GitHub commonly uses it as the squash commit message.

## 4. Push and open a pull request

Push the branch:

```bash
git push -u origin feat/combo-templates
```

Open a pull request targeting `main`. Wait for CI to pass, obtain review, and merge it. CI verifies version consistency, performs the TypeScript production build, and runs the frontend and Windows Rust tests.

Canceled informational CI runs are usually harmless: the concurrency policy cancels an older run when a newer commit on the same branch is waiting. The newest commit must have a successful run.

## 5. Let the release PR accumulate changes

After releasable commits reach `main`, Release Please creates or updates a PR named approximately:

```text
chore(main): release 1.1.0
```

That rolling PR contains the calculated version changes and generated changelog. More feature and fix PRs can be merged into `main`; Release Please will update the same release PR.

Do not normally:

- Edit version fields by hand.
- Run `bump-version.ps1` or `bump-version.sh`.
- Create or push a `v*` tag.
- Create the GitHub release yourself.
- Manually move `Unreleased` changelog entries into a numbered release.

The bump scripts remain available only as an emergency fallback.

## 6. Prepare a release

When the accumulated changes are ready:

1. Review the Release Please PR's version and changelog.
2. Wait for its latest CI run to pass.
3. Approve and merge the Release Please PR.
4. Do not manually create the version tag.

The merge triggers the release workflow, which:

1. Creates a forced `vMAJOR.MINOR.PATCH` tag.
2. Creates a **draft** GitHub release.
3. Checks out the exact release tag.
4. Verifies that the tag and all version files agree.
5. Repeats the frontend build and all automated tests.
6. Builds the Windows MSI and NSIS installers.
7. Uploads both installers to the draft release.

## 7. Inspect and publish the draft

Open the repository's **Releases** page and select the draft. Confirm:

- The version and tag are correct.
- The release notes look correct.
- Both MSI and NSIS assets are attached.
- Any required manual QA has passed.

Publish the draft manually when it is ready for users. Keeping publication manual prevents a successful build from becoming public before the artifacts have been inspected.

If packaging fails after the draft and tag have already been created, fix the workflow on `main`, open **Actions → Release → Run workflow**, and enter the existing tag (for example, `v1.0.12`). This rebuilds and uploads assets to that draft without creating a new version.

## Release automation setup

The repository must have **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** enabled.

The `RELEASE_PLEASE_TOKEN` Actions secret should contain a fine-grained personal access token limited to this repository with:

- Contents: read and write.
- Pull requests: read and write.
- Issues: read and write.

If that token expires, create a replacement and update the repository secret. The workflow falls back to `GITHUB_TOKEN`, but events created by that built-in token may not start normal pull-request checks.

## Emergency manual version bump

Only when the automated release path cannot be used:

```powershell
scripts/bump-version.ps1 1.0.13
```

or:

```bash
./scripts/bump-version.sh 1.0.13
```

Both commands update the three version manifests and both lockfiles. Run `npm run version:check` afterward. Return to the automated release path as soon as the blocking issue is resolved.

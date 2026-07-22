# Sigma File Manager v2 Review + Upgrade Runbook (Windows)

## Purpose
Use this checklist to safely:
1. Back up our current source state.
2. Sync a clean branch to official upstream v2.
3. Uninstall/reinstall the Windows app for hands-on review.
4. Decide which fork features to reinstate and how.

---

## Phase 1 - Protect current code before any upgrade work

Run from repo root:

```powershell
git status
git branch backup/before-upstream-v2
git stash push -u -m "backup before upstream v2 sync"
```

Verify:

```powershell
git branch --list "backup/*"
git stash list
```

---

## Phase 2 - Sync local repo with official upstream

Add and fetch official remote:

```powershell
git remote add upstream https://github.com/aleksey-hoffman/sigma-file-manager.git 2>$null
git fetch upstream --tags
```

Create clean review branch from official v2:

```powershell
git switch -c upgrade/upstream-v2 upstream/main
```

Useful checks:

```powershell
git remote -v
git branch -vv
git rev-list --left-right --count upstream/main...main
git log --oneline upstream/main..main
git log --oneline main..upstream/main
git diff --name-status upstream/main..main
git diff --name-status main..upstream/main
git merge-tree --write-tree --name-only main upstream/main
```

---

## Phase 3 - Build and review official v2 from source (optional but recommended)

Before running any build/dev command, make sure you are on the official review branch:

```powershell
git switch upgrade/upstream-v2
git branch --show-current
git status
```

Expected branch: `upgrade/upstream-v2`.

Install dependencies (if needed):

```powershell
yarn install
```

Run app in dev:

```powershell
yarn tauri:dev
```

Build Windows installer (.exe, preferred):

```powershell
yarn tauri:build
```

Installer output:

```text
src-tauri\target\release\bundle\nsis\Sigma File Manager_<version>_x64-setup.exe
```

---

## Phase 4 - Uninstall current Windows app and install official v2

1. Close Sigma File Manager fully.
2. Open **Settings -> Apps -> Installed apps**.
3. Uninstall the current Sigma File Manager build.
4. Download official v2 installer from the official release/site.
5. Run installer (`..._x64-setup.exe`).
6. If SmartScreen appears, use **More info -> Run anyway**.
7. Launch app and do feature review.

Recommended review checklist:
- File navigation and large-folder behavior
- Box selection / marquee selection
- Linked split view
- Grid sort/grouping
- Clipboard integration with other apps
- Icon theme behavior
- Extension install/runtime behavior
- Settings migrations and preserved preferences

---

## Phase 5 - Decide what to reinstate from our fork

Use this decision label per feature: `keep`, `replace`, `rework`, `drop`.

Current fork features to evaluate:
- Papirus built-in icon set
- Modular file browser refactor
- Extensions runtime disk discovery
- Theme variants/custom settings

Decision rules:
- **Keep** when it is unique and better than upstream.
- **Replace** when upstream already does it better.
- **Rework** when value is high but implementation conflicts heavily.
- **Drop** when duplicate/high-maintenance.

---

## Phase 6 - Reintroduce selected custom features safely

Always apply changes on `upgrade/upstream-v2` branch, not `main`.

For single feature commits:

```powershell
git switch upgrade/upstream-v2
git cherry-pick <commit-sha>
```

If cherry-pick is too conflict-heavy, port feature manually in small focused commits.

Use one branch/commit series per feature:
- `feature/papirus-icon-theme`
- `feature/custom-theme-variants`
- `feature/extensions-runtime-adjustments`
- `feature/file-browser-overlays`

---

## Phase 7 - Recovery commands (if anything goes wrong)

Return to backup branch:

```powershell
git switch backup/before-upstream-v2
```

See recent HEAD history:

```powershell
git reflog
```

Restore stashed local changes:

```powershell
git stash list
git stash pop
```

---

## Phase 8 - Finalize after review

When v2 review is complete and reintegration decisions are made:

1. Update `local-documents\sigma-file-manager-upgrade-plan.md` with final keep/replace/rework/drop outcomes.
2. Implement only approved features on `upgrade/upstream-v2`.
3. Validate behavior.
4. Merge updated upgrade branch into main only after sign-off.

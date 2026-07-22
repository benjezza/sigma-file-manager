# Sigma File Manager v2 Upgrade Plan

## Core upgrade rule
Keep official upstream behavior by default. Reintroduce local/fork features only where they add clear value after review.

## Review findings (official v2 vs local)
Date: 2026-07-22

### Official v2: keep as-is
- Box selection (use official implementation)
- Linked split view (keep official, then integrate with our layout feature)
- List view resizing/reordering (keep official, then integrate with our layout feature)
- Root drive / root Locations behavior (keep official)

### Local features: decision
- Local box selection: **drop** in favor of official implementation to reduce future merge conflicts
- Local layout/group-by features: **keep**, but rework to sit on top of official v2 behavior

## Implementation decisions

### 1) Baseline branch
- Base all work on `upgrade/upstream-v2` from `upstream/main`
- Do not implement new behavior directly on `main`

### 2) Reintegration priority
1. Keep official file browser selection behavior unchanged (no local box-selection restore)
2. Integrate official linked split view into our layout feature flow
3. Integrate official list view resizing/reordering into our layout feature flow
4. Reapply local layout/group-by behavior in a minimal overlay

### 3) Conflict-avoidance rules
- Avoid touching upstream core selection internals unless strictly required
- Add layout/group-by behavior through isolated composables/helpers where possible
- Keep migrations/settings changes scoped to layout/group-by only

## Tracking matrix
| Feature | Source of truth | Decision | Notes |
|---|---|---|---|
| Box selection | Official v2 | Keep official / drop local | Lower maintenance and fewer merge conflicts |
| Linked split view | Official v2 | Keep official + integrate with local layout | Integration task required |
| List view resizing/reordering | Official v2 | Keep official + integrate with local layout | Integration task required |
| Root Locations/drive behavior | Official v2 | Keep official | No local override planned |
| Layout/group-by | Local overlay on official | Keep and rework | Must be layered, not invasive |

## Git workflow (safe path)
```powershell
git status
git branch backup/before-upstream-v2
git stash push -u -m "backup before upstream v2 sync"
git remote add upstream https://github.com/aleksey-hoffman/sigma-file-manager.git 2>$null
git fetch upstream --tags
git switch -c upgrade/upstream-v2 upstream/main
```

## Next coding phase
1. Implement layout/group-by overlay on top of official v2 branch.
2. Validate linked split view + list resizing interactions with layout/group-by.
3. Keep box selection untouched (official behavior preserved).
4. Prepare reintegration summary before merging to `main`.

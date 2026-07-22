# Sigma File Manager v2 Upgrade Plan

## Goal
Move our fork onto the official v2 line with minimal regression risk, then selectively reintroduce only the features that still add value.

## Current state snapshot
- Fork branch: `main`
- Local head: `ee1280aa` (`feat: implement modular file browser architecture with dedicated composables and updated UI components`)
- Upstream baseline for the official repo: `upstream/main` at `1a9108db`
- Divergence: 93 commits behind, 3 commits ahead
- Current app version in fork: `2.1.1`
- Upstream app version: `2.2.0`
- Current working tree has unrelated edits in `README.md` and `CONTRIBUTING.md` that should be left alone

## Our current feature set
Keep these in mind as custom layers, not core upstream assumptions:
- Papirus-based built-in icon theme support
- Icon theme plumbing for built-in and extension themes
- Modular file browser composables/components
- Extensions runtime discovery from disk
- Custom theme variants and user settings extensions
- AGENTS.md documentation and repo-specific workflow notes

## Upstream v2 features to inspect first
Review upstream behavior before restoring any local feature:
- Box selection / marquee selection
- Grid sort controls and group-by behavior
- Linked split view
- Root `Locations` address behavior
- Clipboard integration and toolbar settings
- Native properties / shell extensions / WSL and SMB fixes
- Settings schema changes and migration chain
- Extension runtime and manifest changes
- Theme and icon theme system changes

## Recommended strategy
### Phase 1: Baseline and compare
1. Create a clean upgrade branch from `upstream/main`.
2. Preserve a frozen snapshot of the current fork state for reference.
3. Build a feature matrix with three columns: `upstream only`, `our only`, `both but different`.
4. Identify which of our features are already solved upstream in a better way.

### Phase 2: Reintroduce only required customizations
1. Port only the custom features we still want to keep.
2. Prefer isolated modules, composables, or extension-style contributions over core edits.
3. Avoid reintroducing changes that upstream now covers natively unless our version is clearly better.

### Phase 3: Reduce future merge friction
1. Split custom code into clearly labeled layers:
   - upstream sync base
   - custom feature overlays
   - theme/icon packages
   - fork-specific settings/migrations
2. Keep feature additions small and topical so they can be cherry-picked or dropped independently.
3. Move assets or theme sets into extension-like packages where possible.
4. Keep schema migrations and settings additions grouped by feature, not by large mixed releases.

## Separation model for future updates
Use this structure going forward:
- **Upstream mirror:** exact official code, used for diffing and upgrades only
- **Integration branch:** our shipped app, built from upstream plus selected overlays
- **Feature overlays:** one branch or commit series per custom feature
- **Decision log:** track why each feature is kept, replaced, or retired

## Decision rules
Keep our version when:
- it adds a unique capability not yet in upstream
- it improves user experience without increasing merge cost too much
- upstream does not cover the use case well enough

Prefer upstream when:
- upstream feature is equivalent or better
- upstream implementation is more stable or lower maintenance
- our version overlaps heavily with upstream internals

Retire our version when:
- it duplicates official behavior
- it creates repeated merge conflicts
- it depends on a settings or architecture path that upstream has already superseded

## Immediate next review steps
1. Inspect upstream v2 UX and behavior in a local comparison branch.
2. Compare our custom features against upstream equivalents one by one.
3. Mark each custom feature as `keep`, `replace`, `rework`, or `drop`.
4. Only after that, plan the actual porting order.

## Current feature tracking table
| Feature | Current fork status | Upstream v2 status | Action |
|---|---|---|---|
| Papirus icons | Added in fork | Not in official core | Keep, but isolate |
| Theme variants | Added in fork | Official built-in dark variants exist | Re-evaluate |
| Extensions runtime discovery | Added in fork | Upstream already improved extensions runtime | Compare and likely align with upstream |
| Modular file browser refactor | Added in fork | Upstream also changed file browser internals | Reconcile carefully |
| User settings extras | Added in fork | Upstream settings schema moved forward | Rebase/migrate carefully |
| AGENTS.md notes | Added in fork | Not part of upstream product | Keep as repo docs |

## Success criteria
- Official v2 behavior is understood before any fork reintegration decisions are made.
- Every custom feature has an explicit keep/replace/drop outcome.
- Future upstream syncs become a predictable diff review, not a large manual merge.

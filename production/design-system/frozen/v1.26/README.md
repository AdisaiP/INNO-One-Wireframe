# INNO.One Production Design System Frozen Reference

This directory is a read-only snapshot of the frozen INNO.One design-system baseline used by Production UI work.

- Documentation version: V1.26
- UI contract: 1.20.0
- Status: frozen
- Purpose: visual/contract reference for Production React implementation
- Runtime rule: Production React must not import prototype HTML/CSS/JS from this folder.

## How to use

1. Treat `design-system.html` plus the copied contract files as the reference baseline.
2. Use `/internal/design-system` in the Web Portal to inspect the React implementation baseline.
3. When a shared Production component changes, compare the React page with this frozen snapshot before changing page-local CSS.
4. Do not edit this snapshot during normal UX implementation. A future design-system version must be added as a new versioned folder.

The snapshot intentionally preserves the original prototype dependencies and file names so it can be opened independently for visual comparison.

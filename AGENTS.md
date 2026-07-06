# Agent Build Notes

## Rebuild Windows installer

From the repository root, run:

```powershell
yarn tauri:windows:build
```

This runs the full Windows packaging flow (version sync + Windows bundle patch + installer build).

Installer output is generated under:

`src-tauri\target\release\bundle\`

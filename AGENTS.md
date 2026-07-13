# Agent Build Notes

## Rebuild Windows installer (preferred — NSIS .exe)

From the repository root, run:

```powershell
yarn tauri:build
```

This produces a standard `.exe` installer that does **not** require a signing certificate.
Windows may show a SmartScreen prompt — click **More info → Run anyway** to proceed.

Installer output:

```
src-tauri\target\release\bundle\nsis\Sigma File Manager_<version>_x64-setup.exe
```

---

## Rebuild Windows MSIX bundle (Store / sideload)

```powershell
yarn tauri:windows:build
```

This runs the full MSIX packaging flow (version sync + Windows bundle patch + installer build).

> **Note:** MSIX packages require a trusted signing certificate. To install an unsigned MSIX
> locally, enable **Developer Mode** in Windows Settings → Privacy & Security → For Developers.

MSIX output:

```
src-tauri\target\msix\Sigma File Manager_<version>.msixbundle
```

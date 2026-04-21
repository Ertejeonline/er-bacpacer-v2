# ER Bacpacer

A production-style starter app for Even Realities glasses using the Even Hub SDK.

## What this app does

- Presents a native list menu on glasses
- Runs a 5-minute focus timer session
- Uses tap, double-tap, and scroll gestures
- Updates timer text with `textContainerUpgrade` for smooth refreshes
- Handles lifecycle cleanup on app exit

## Project layout

- `g2/`: glasses runtime logic
- `_shared/`: shared app module types and log helper
- `src/`: web loader and small status panel
- `app.json`: Even Hub app manifest

## Quickstart

```bash
npm install
npm run dev
npm run simulate
```

In another terminal, you can also generate a QR for sideloading:

```bash
npm run qr
```

## Build and package

```bash
npm run build
npm run check:manifest
npm run pack
```

This creates `er-bacpacer.ehpk` in the project root.

## Best-practice notes used

- Waits for `waitForEvenAppBridge()` before any SDK calls
- Calls `createStartUpPageContainer` once, then uses `rebuildPageContainer`
- Serializes bridge operations to avoid concurrent BLE calls
- Uses protobuf-safe defaults for event values
- Cleans up listeners and stops hardware features on exit

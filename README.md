# Tuika UI/UX

Mobile-first design studio (neutral black-and-white UI, Inter/Poppins/Playfair/JetBrains Mono fonts bundled offline via @fontsource): React + TypeScript + Konva canvas, Zustand store with undo/redo, Dexie (IndexedDB) storage, Capacitor Android shell, GitHub Actions APK build.

## Get the APK (no computer needed)

1. Create a new GitHub repo and upload **everything in this folder** (keep the folder structure).
2. Make sure `.github/workflows/android.yml` is in the repo. Hidden folders are sometimes skipped by phone uploaders. If it is missing, create that file in GitHub and paste the contents of `ci/android.yml`.
3. Open the **Actions** tab -> **Android APK** -> **Run workflow** (it also runs on every push).
4. When the run is green, open it and download **tuika-debug-apk** under *Artifacts*. Unzip, install the `.apk` (allow "install unknown apps").

The first run creates the `android/` project with `npx cap add android`. After it works once, you can commit the generated `android/` folder (and `package-lock.json`) to make later builds faster and reproducible.

Type check and tests run in the workflow but do **not** block the APK (`continue-on-error`). Check those steps in the log. Once they are green, remove `continue-on-error` from `android.yml`.

## Installing a new build over the old one

Every debug build is signed with the same key, `ci/tuika-debug.keystore` (committed on purpose, it is only a debug key), and `scripts/patch_android.py` raises `versionCode` on each run. Upload `ci/tuika-debug.keystore`, `scripts/patch_android.py` and the updated `.github/workflows/android.yml`. The first build after this change still needs the old app uninstalled once (it was signed with a random key); after that every build installs as an update and keeps your projects.

## Signed release APK

Create a keystore once (`keytool -genkeypair -v -keystore release.keystore -alias tuika -keyalg RSA -keysize 2048 -validity 10000`), then add these repository secrets (Settings -> Secrets and variables -> Actions):

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w0 release.keystore` output |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `tuika` |
| `KEY_PASSWORD` | key password |

When `KEYSTORE_BASE64` exists the workflow also uploads **tuika-release-apk**. Never commit the keystore (it is in `.gitignore`).

## Develop locally

```
npm install
npm run dev        # browser
npm test           # unit tests (vitest + fake-indexeddb)
npm run typecheck
npm run build:web
npx cap add android && npx cap sync android   # then open android/ in Android Studio
```

## Brand

The Tuika logo is the exact PNG in `brand/logo.png` (copied to `public/logo.png`). In the app it is the `LogoMark` component (`variant="ring"` in the home header, `variant="tile"` elsewhere), the web favicon is `public/favicon.png`, and `scripts/make_android_icons.py` builds the Android launcher icons, adaptive icon and splash screens from it during the CI build (step "Apply Tuika icon and splash").

## Layout

```
src/engine      document model, validation/migration (no renderer imports)
src/state       zustand editor store (commands, undo/redo), UI state
src/database    Dexie schema, repository functions, autosave
src/services    files (download/share/pick), SVG sanitize + export
src/features    projects, canvas, inspector, layers, assets, prototype, editor shell
src/tests       unit + database tests
```

## What is implemented

- Projects: create (device presets, custom size, orientation, background, screens, status/nav bar shapes, blank/login template), search, sort, grid/list, rename, duplicate, delete with confirm, backup export/import, storage usage.
- Canvas: multiple artboards, pinch zoom, two-finger pan, wheel zoom, fit, select/drag/resize/rotate, multi-select, snapping to artboard and sibling edges, 8px grid, lock/hide.
- Elements: text, rectangle, ellipse, line, arrow, image, icon. Align, order, duplicate, copy/cut/paste, keyboard shortcuts.
- Inspector: position/size/rotation, fill (picker, hex, RGB, saved color styles, copy/paste), stroke, radius, typography, opacity, shadow, prototype link.
- Layers: artboard tabs, search, inline rename, visibility, lock, reorder, multi-select, two-way selection sync.
- Icons: all Lucide icons searchable offline, favorites, recents, color/size, project library; online search through the Iconify API with debounce, cancellation, error/retry and SVG sanitising.
- Prototype: start screen, tap links, back, fade transition, broken-link report.
- Persistence: IndexedDB, debounced serialised autosave (stale writes cannot overwrite newer ones), save status, quota error message, project thumbnails.
- Undo/redo: bounded (100), coalesced for sliders/typing.
- Export: PNG/JPEG (1-4x, transparent PNG), SVG (with warnings), project backup JSON, Android share sheet.
- Android: Capacitor shell, back button handling, file picker, share/save.

## Known limitations (be aware)

- **Screenshot import is manual tracing only.** The screenshot becomes a locked reference layer on a new artboard; there is no OCR or automatic UI detection in this build.
- No groups/ungroup, auto-layout, reusable components with overrides, shared-style linking, rulers/guides, drag-and-drop layer reordering (use arrows), per-corner radius, multiple fills, or image cropping.
- Text uses system fonts only (no bundled font files).
- Undo history is not kept across app restarts (the document itself is).
- 
- This code was written without being able to install dependencies or run it in the authoring environment. Expect to fix small compile or runtime errors on the first CI run.

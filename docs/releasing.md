# Releasing

How-to for ROAD-06. The rules live there; this file is the copy-paste steps.

## One-time setup

### 1. Create the Android release keystore

Use one key for the app's whole life. If it's lost, users can only update by uninstalling, which deletes their diary.

```bash
keytool -genkeypair -v -keystore ~/open-kcal-release.jks -alias open-kcal -keyalg RSA -keysize 4096 -validity 36500
```

It asks for a password and your name. Pick a strong password and store it in a password manager.

### 2. Back it up

Copy `~/open-kcal-release.jks` and its password somewhere outside GitHub (password manager attachment, encrypted drive). Never commit it.

### 3. Add the GitHub secrets

Each `gh secret set` without a value prompts for it.

```bash
base64 -i ~/open-kcal-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo ricardo-reis-swe/open-kcal
```

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD --repo ricardo-reis-swe/open-kcal
```

```bash
gh secret set ANDROID_KEY_ALIAS --repo ricardo-reis-swe/open-kcal
```

Enter `open-kcal` (the `-alias` from step 1).

```bash
gh secret set ANDROID_KEY_PASSWORD --repo ricardo-reis-swe/open-kcal
```

With `keytool`'s default PKCS12 keystore, the key password is the keystore password.

Check all four exist:

```bash
gh secret list --repo ricardo-reis-swe/open-kcal
```

## Each release

### 1. Bump the version

Set the same `MAJOR.MINOR.PATCH` in `app.json` (`expo.version`) and `package.json` (`version`). MINOR and PATCH stay below 100. Build numbers follow automatically.

```bash
git commit -am "chore: release 0.2.0"
```

```bash
git push origin main
```

Wait for CI to go green.

### 2. Run the Release workflow

```bash
gh workflow run release.yml --repo ricardo-reis-swe/open-kcal --ref main
```

```bash
gh run watch --repo ricardo-reis-swe/open-kcal
```

Or on GitHub: Actions → Release → Run workflow (branch `main`). It takes about 30–45 minutes, most of it the iOS build.

### 3. Test the draft

Download the APK and/or IPA from the draft release and run the ROAD-04 smoke test on a phone: first launch, add Quick Calories, log an Open Food Facts food, go offline and log a saved food, relaunch and check the data persisted.

```bash
gh release download v0.2.0 --repo ricardo-reis-swe/open-kcal --dir ~/Downloads/open-kcal-0.2.0
```

### 4. Publish

On GitHub: Releases → the draft → Edit → Publish release. Or:

```bash
gh release edit v0.2.0 --repo ricardo-reis-swe/open-kcal --draft=false
```

Publishing creates the `v0.2.0` tag and makes it the `latest` release (Obtainium and the AltStore source follow `latest`).

## After the first published release

Request an IzzyOnDroid listing once: open an issue at `https://gitlab.com/IzzyOnDroid/repo/-/issues` with the repo URL. After that, IzzyOnDroid picks up new releases by itself.

## Installing (for users)

**Android**

- Download `open-kcal-<version>.apk` from the latest release and open it. Allow "Install unknown apps" for the browser when asked.
- Or, for automatic updates: install Obtainium and add `https://github.com/ricardo-reis-swe/open-kcal`.

**iOS** (free Apple ID; the app is re-signed every 7 days by the tool)

- Install AltStore or SideStore, then add the source `https://github.com/ricardo-reis-swe/open-kcal/releases/latest/download/altstore-source.json` and install Calorie Tracker from it.
- Or sideload `open-kcal-<version>.ipa` with Sideloadly.

**Note:** a release can't install over a local development build on the same phone (different signing keys). Uninstall the local build first; that deletes its data.

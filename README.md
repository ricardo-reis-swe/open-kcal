# Open Kcal

[![CI](https://github.com/ricardo-reis-swe/open-kcal/actions/workflows/ci.yml/badge.svg)](https://github.com/ricardo-reis-swe/open-kcal/actions/workflows/ci.yml)

A local-first calorie and food diary for iOS and Android. Set your goals, log foods
and recipes, and keep track of your daily calories and nutrients. Built with React
Native (Expo), with everything stored on the device in SQLite. No account, backend
or tracking.

<p align="center">
  <img src="docs/screenshots/diary.png" width="200" alt="Diary with today's calories left, macros and meals">
  <img src="docs/screenshots/food-search.png" width="200" alt="Food search with Open Food Facts results">
  <img src="docs/screenshots/add-food.png" width="200" alt="Adding a food with the ruler serving selector">
  <img src="docs/screenshots/profile-dark.png" width="200" alt="Profile in dark mode">
</p>

[Why it exists](#why-it-exists) · [Install](#install) · [Setting up USDA](#setting-up-usda) · [On the home screen](#on-the-home-screen) · [Development](#development) · [Support the data underneath](#support-the-data-underneath)

## Support the data underneath

Food search uses [Open Food Facts](https://world.openfoodfacts.org) and
[USDA FoodData Central](https://fdc.nal.usda.gov). These databases provide the food
names, serving sizes and nutrition values behind the search results.

- **Support Open Food Facts** → [Contribute product data](https://world.openfoodfacts.org/contribute).
- Open Food Facts data is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- USDA FoodData Central data comes from the U.S. Department of Agriculture,
  Agricultural Research Service, and is public domain.

## Why it exists

I made this because existing calorie trackers feel like cesspits of extra stuff
piled around the core feature most of us want: calorie and macro tracking.

Open Kcal keeps that at the centre. Log your food, track your calories and macros,
and get on with your day. No account, no subscriptions, and your diary stays on
your phone.

### Install

The [release workflow](.github/workflows/release.yml) prepares these files for the
[Releases](https://github.com/ricardo-reis-swe/open-kcal/releases) page:

| Platform | File | Installation |
| --- | --- | --- |
| Android | `open-kcal-<version>.apk` | Install the signed APK, allowing installation from your browser or file manager when Android asks. Obtainium can track this repository for updates. |
| iOS | `open-kcal-<version>.ipa` | Sign and sideload the unsigned IPA with AltStore, SideStore or Sideloadly. Free Apple ID signing needs refreshing every seven days. |

Releases also include `altstore-source.json` for AltStore / SideStore and
`SHA256SUMS.txt` for file checksums. Release preparation is documented in
[Releasing](docs/releasing.md).

### Setting up USDA

USDA FoodData Central is optional. Open Food Facts works without a key, and your
local diary, custom foods and saved foods remain available without USDA.

1. Request your own free API key from [api.data.gov](https://api.data.gov/signup/).
   Complete the sign-up form and copy the key provided to you.
2. In the app, open **Profile → Food Databases** and tap **USDA**
   to expand it.
3. Paste the key into **USDA API key** and tap **Save key**. When online, the app
   tests it before saving. **Key works.** confirms that USDA accepted it.
4. Under **Search results** on the same screen, make sure **USDA** is enabled.
   Return to Food Search and try an English term such as `apple` or `eggs`.

The key is stored securely on that device. Enter it in the app, never in `.env`
or the source code. Use your own key; the app does not accept `DEMO_KEY`.

If you save while offline, the key is stored without verification. Once connected,
expand USDA and tap **Test key**. **Replace key** and **Remove key** are available
there too; removing the key stops USDA search but keeps your saved foods.

If USDA rejects the key, check that you copied it correctly. If it is over the
hourly limit, try again later; the [USDA API guide](https://fdc.nal.usda.gov/api-guide/)
documents the request limits. USDA food names are in English, so Portuguese search
terms may return no results.

### On the home screen

Android has a **Calories left** widget showing today's remaining calories. Add it
from your launcher's widget picker. It refreshes after diary changes and
periodically in the background, and follows the app's theme. Tap it to open the
Diary. There is no iOS widget.

### Development

Use Node.js 24 (the CI version), plus Xcode on macOS for iOS and/or Android Studio
for Android. Native modules require an Expo development build.

```bash
git clone https://github.com/ricardo-reis-swe/open-kcal.git
cd open-kcal
npm ci
cp .env.example .env
npm run ios        # or: npm run android
```

`npm start` serves the JS bundle to the installed development build. The public
provider URLs and Open Food Facts contact are configured in `.env`; see
[.env.example](.env.example). For the USDA key, follow
[Setting up USDA](#setting-up-usda).

| Command | Does |
| --- | --- |
| `npm start` | Start Metro for the development build. |
| `npm run ios` / `npm run android` | Build and run the native app locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Check TypeScript without emitting files. |
| `npm test` | Run Jest tests. |
| `npm run check` | Run lint, type checking and tests. |
| `npm run format:check` | Check formatting for files covered by Prettier. |

Tests cover domain math, repositories, provider mapping, components and navigation.
CI runs formatting and `npm run check`. Automated Maestro device testing remains
deferred; see [Progress](docs/progress.md). Release builds and publishing steps are
in [Releasing](docs/releasing.md).

### License

[GNU GPL v3.0 or later](LICENSE) © 2026 Ricardo Reis. Anything built on this stays
open source.

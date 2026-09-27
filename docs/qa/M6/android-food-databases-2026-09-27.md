# M6 Android Food Databases QA attempt

- Time: 2026-09-27 (Europe/Lisbon)
- Scope: UX-18 Food Databases only, with no USDA key and no live USDA request.
- Result: **BLOCKED before app launch.** The available desktop automation inventory contained no Android emulator, device, or running mobile app; only the Codex in-app browser was available. Therefore the Food Databases screen, local validation, and masked-key behavior could not be exercised on Android in this environment.
- Evidence: the automation inventory returned `apps: []`; no Android target was available to launch or inspect.
- Not claimed: live USDA key validation, USDA search, or a passing Android device flow.
- Retry point: start an Android emulator or connect an Android device with the existing dev build, open Profile → Food Databases, verify Add key local whitespace/`DEMO_KEY` errors and the saved key’s last-four masking without entering a real key.

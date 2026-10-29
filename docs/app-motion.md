# App motion

Implemented 29 October 2026 on `codex/subtle-app-motion` using existing Reanimated/native navigation; no new dependency or backend service.

## Behavior

- Buttons, chips, tab buttons, back buttons and picker cells use a bounded 2–4% press scale, with 90ms press/140ms release.
- Web/iOS tabs use a 180ms fade. Android tabs switch directly with press feedback, retaining the existing avoidance of whole-screen fades on tablets.
- Native routes retain platform stack transitions. The web native-stack ignores its native animation option, so a web-only ScreenEntry uses focus events for a 200ms fade on non-tab routes, including returning to a route. Tab pages skip that extra fade.
- Sheets open in 220ms and user-dismiss in 160ms. Forced hiding and privacy covers remain immediate. Late close callbacks cannot dismiss a reopened sheet. Full-screen native modals retain platform slide transitions.
- Dropdown/expanded commitment options have a 180ms entry reveal. Removing them and selecting values remains immediate; forms do not remount for motion settings.
- Progress bars update over 280ms using a scale transform rather than per-frame layout width changes. Reorder settling uses 160ms; direct finger tracking remains functional.

## Accessibility

Native controls share one Reduce Motion listener with guarded initial-query completion and last-subscriber cleanup. Browsers observe prefers-reduced-motion, including changes while open and a legacy MediaQueryList fallback. Unknown preferences disable nonessential motion. Reanimated receives explicit Always/Never configuration based on the live preference, avoiding dependence on its startup-only System snapshot. Navigation/modal animations are disabled under reduced motion.

Native switches retain their built-in platform behavior. Privacy covers never fade. Motion does not delay typing, save operations or caller-driven modal closure.

## Validation

- Full app: 106 suites / 1,034 tests passed. Final focused motion tests: 10/10, including a forced-hide/reopen regression.
- TypeScript passed. Lint: zero errors, 27 pre-existing warnings (one unused Sheet import removed).
- Expo web export and existing Chromium browser smoke test passed.
- Browser interaction checks at 360px/light and 1440px/dark under both normal and reduced motion passed: normal press scale ~0.98; reduced scale exactly 1; preference changes retained a typed draft; sheets dismissed; actual non-tab route opacity transitioned and settled to 1 only in normal mode. No page errors observed.
- Independent whole-branch source review identified the web stack limitation; a regression was observed failing then passing, and the exported browser route was measured after correction. No additional actionable findings were reported.

## Remaining platform checks and release

Verify Android/iOS release builds on real devices: frame smoothness on older phones/tablets, native stack/modal behavior, gestures, reduced-motion changes, keyboard interaction and lock/privacy behavior. Jest mocks cannot establish native worklet execution or GPU performance. Browser checks used desktop Chrome emulation, not actual Safari or mobile hardware; the legacy listener branch is compatibility code, not a Safari runtime certification.

Push/merge and GitHub Pages publishing activate the web changes. Android APK and iOS users need an updated app build/release through the existing process. Cloudflare requires no update for this UI-only work. No publishing, native build submission or backend deployment was performed during implementation.

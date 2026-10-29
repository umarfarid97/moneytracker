# Subtle app motion design

Status: user approved the fast, subtle style in chat, 29 October 2026.

Use the existing Reanimated and native navigation stack. Centralize timings (90ms press, 140ms release, 180ms changes, 220ms sheets, 160ms dismiss/reorder, 280ms progress). No bounce, staggered financial rows, counter rolling, or extra services/dependencies. Buttons remain immediately actionable.

Shared motion preferences observe live native Reduce Motion changes and browser prefers-reduced-motion, defaulting to reduced until a preference is known. No subscriber-per-control native OS listeners: use a shared external store with cleanup and stale-query protection. All shared transitions, navigator choices, modal transitions and drag settlement respect reduced motion.

Let navigators own screen transitions; remove duplicate mount fades from Screen. Web/iOS tabs use a short fade. Android tabs switch directly with animated press feedback, retaining the existing avoidance of expensive full-screen fades. Native stack transitions remain platform defaults; web routes use a short fade. Never remount forms or lists solely to animate them. Privacy covers and forced modal hiding remain immediate.

Sheet user dismissal may animate for 160ms, but caller-driven visible=false must remove the modal immediately and cancel any pending animation. Use actual window height for travel. Dropdown/expander content has a brief entry reveal; removing it remains immediate so focus/validation is not delayed. Shared progress bars and drag settlement use common timing. Apply press feedback to tab buttons and picker options as well as existing buttons/chips/cards.

Verification: regression tests for live preference updates, late native queries, cleanup, reduced-motion navigation and sheet close callbacks/forced hiding; existing security privacy/form tests; full Jest/types/lint; web export and browser checks under normal/reduced motion, light/dark and mobile/desktop viewports. Real Android/iOS smoothness and OS setting behavior still require release-device checks. No native build submission or cloud deployment is authorized here.

Review refinement: the installed Expo web native-stack ignores native animation options. A web-only ScreenEntry focus transition handles non-tab routes and return focus; tab routes skip it to prevent duplicate fades. Native ScreenEntry is a passthrough. Preference changes do not replay the entry.

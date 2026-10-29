# Subtle app motion implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, with one final fresh review.

**Goal:** Consistent brief motion across web/iOS/Android, respecting live reduced-motion preferences.
**Architecture:** A shared preference store and timing policy feed shared controls, navigation and sheets. Native navigation owns screen transitions; Screen privacy remains synchronous.
**Tech Stack:** Expo58, React Native0.88, existing Reanimated4, Jest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-29-app-motion-design.md

## Global constraints
No dependencies, production deploys, native submissions or finance logic changes. Timings 90/140ms press/release, 180ms change, 220ms sheet, 160ms dismiss/reorder, 280ms progress. Android avoids full-screen tab opacity animations. Unknown preference is reduced; live preference changes apply. Forced hiding/privacy covers are immediate; no form remounts.

## Review focus
Native query resolving after a newer accessibility event; listener cleanup across unmount/remount; a closing sheet interrupted by forced hiding or reopening; motion toggled while an interaction is underway; navigator transition hiding content or losing form state.

### Task 1: Shared preference and policy
Files: src/ui/useMotion.ts and .web.ts, motion.ts; __tests__/motion/*.
- [x] Add failing native/browser preference tests and policy tests; verify RED.
- [x] Implement shared listener lifetime, conservative snapshots and late-query guard; timing/navigation policy.
- [x] Run focused tests and typecheck; commit.

### Task 2: Shared UI and navigation
Files: PressableScale, Sheet, ProgressBar, ReorderList, Screen, new Reveal; root/tabs layouts; shared picker and commitment expanders.
- [x] Add failing dismissal/reduced-motion tests; verify RED.
- [x] Wire policy, safe sheet dismissal, entry reveals and navigation; retain form state and privacy invariants.
- [x] Run full Jest, types, lint and web export/browser normal/reduced-motion checks. Obtain fresh review and fix important findings with regressions.
- [x] Record platform validation gaps, commit and deliver concrete local changes.

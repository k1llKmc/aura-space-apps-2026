# Experience v2 — approved public release

Developed in `feat/mission-experience-v2`, approved by the user and promoted to
`main`. The previous public release is protected by tag `demo-v1.0-stable` at
`8709ca3`. Pages deployment is limited to main, including manually triggered
workflows. Preview CI builds/tests and uploads artifacts without deploying anything.

## Component boundaries

- `components/experience/format.ts`: labels, asset paths, local progress rules
  and typed experience data; progress is derived, never incremented in UI.
- `use-experience.ts`: demo resource and mutation notifications.
- `progress.tsx`: crew dossier, XP bars, consistency milestones, today's tasks.
- `analytics.tsx` and `chart.tsx`: accessible SVG trends with keyboard inspection
  and 24-hour / 7-day / 30-day filters. Cabin history is explicitly illustrative;
  wellbeing uses recorded daily values and never fills missing data.
- `memory-check.tsx`: ready → show (3 seconds) → recall → result, three rounds
  of 3/4/5 digits. A practice exercise, not a medical or concentration diagnosis.
- `journal.tsx`: human-readable data and filtered checks/measurements/reviews/
  memory/reference activity. Raw JSON and internal entity IDs are not presented.
- `wellbeing-slider.tsx`: controlled scores with changing emotional descriptions.
- `theme.tsx` and `app/experience.css`: dark-first monochrome surfaces, persistent
  light theme, status accents and responsive component layouts.

BodyMap displays the user-supplied body reference image with five independent, named
markers. Keyboard arrows/Home/End move focus; Enter/Space selects the detail
panel. Native titles and focus/hover text identify zones without relying on color.

## Data and rewards

Public profile selection is presentation state, not authentication. A white
welcome screen chooses one of six fictional profiles. The choice is stored in
sessionStorage for the current tab and appears in the header. Header changes
show a 650 ms logo transition, remount the workspace, and reset unsaved forms and
notifications. Daily checks and Today's mission follow the active profile.
Profile-specific daily-check links select their requested crew; a subsequent
header change clears that query to avoid overriding the new selection.

Daily report and memory exercise must have distinct sibling React keys. Reusing
the same crew ID for both previously retained duplicate forms on crew changes.
Range controls explicitly associate their labels with their input IDs and update
on input events. The browser regression test changes crew twelve times, checks
one report only, verifies draft reset, and drags all three range controls.

The v2 demo uses `aura-public-demo-v2` storage, preserving v1's browser data.
Daily check dates are unique per crew member and UTC date. Each unique check
earns 50 XP, regardless of its reported scores. A completed memory exercise earns
20 XP once per crew member per UTC day; repeat practice is logged without extra
XP. Every 500 XP advances a level. Streaks count consecutive UTC dates ending
today, or yesterday if today's check is still outstanding. Memory does not alter
the daily-health streak. Seeded synthetic history spans the previous 30 days.

Six color portraits are bundled locally from the NASA Image and Video Library.
`src/demo/portrait-sources.ts` maps each fictional profile to the actual person's
name and NASA source URL. Both roster cards and profiles show attribution links.
These are illustrative portraits, not photographs or medical data of the fictional
crew. No grayscale filter is applied. BodyMap uses the first silhouette from the
user's supplied raster reference, displayed through a clipped SVG viewport with
independent marker overlays; no anatomical path is hand-drawn. The logo is the user-supplied
asset, displayed with a theme-aware treatment; its original file is preserved.

## Review and rollback

Screenshots and browser checks were reviewed before the user approved publication.
The public URL remains https://k1llkmc.github.io/aura-space-apps-2026/.
To restore v1, create a new branch from main and revert the v2 commits in reverse
order: `6b099ad`, `c976210`, `ebbb542`, `6d12e06`. Review and push the resulting
commit to main so Pages republishes the restored version. The stable tag identifies
the original source. Do not force-push or reset main. The separate v1 browser
storage key preserves its earlier demonstration data.

Browser coverage includes all existing demo flows plus marker keyboard control,
sliders, three-round memory recall, persistence after reload, theme persistence,
period/metric switching, mobile layout and progress/journal updates.

# Experience v2 — review branch

Branch: `feat/mission-experience-v2`. Stable published release is protected by
tag `demo-v1.0-stable` at `8709ca3`. This branch is not approved for publication.
Pages deployment is limited to main, including manually triggered workflows.
Preview CI builds/tests and uploads artifacts without deploying anything.

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

BodyMap renders one continuous SVG silhouette with five independent, named
markers. Keyboard arrows/Home/End move focus; Enter/Space selects the detail
panel. Native titles and focus/hover text identify zones without relying on color.

## Data and rewards

The v2 demo uses `aura-public-demo-v2` storage, preserving v1's browser data.
Daily check dates are unique per crew member and UTC date. Each unique check
earns 50 XP, regardless of its reported scores. A completed memory exercise earns
20 XP once per crew member per UTC day; repeat practice is logged without extra
XP. Every 500 XP advances a level. Streaks count consecutive UTC dates ending
today, or yesterday if today's check is still outstanding. Memory does not alter
the daily-health streak. Seeded synthetic history spans the previous 30 days.

Six illustrative stock portraits are bundled locally from Unsplash image assets:
photo-1580489944761-15a19d654956, photo-1500648767791-00dcc994a43e,
photo-1534528741775-53994a69daeb, photo-1506794778202-cad84cf45f1d,
photo-1494790108377-be9c29b29330, photo-1535713875002-d1d0cf377fde.
They are not photographs of the fictional crew. The logo is the user-supplied
asset, displayed with a theme-aware treatment; its original file is preserved.

## Review and rollback

Review screenshots and browser checks before merging. No merge or publication
has been requested. To recover the current public version later, create a revert
commit for the merged update; the stable tag identifies the original source.
Do not force-push or reset main. Before approval, the public site remains on main.

Browser coverage includes all existing demo flows plus marker keyboard control,
sliders, three-round memory recall, persistence after reload, theme persistence,
period/metric switching, mobile layout and progress/journal updates.

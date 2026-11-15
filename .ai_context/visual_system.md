# AURA visual system

Dark surfaces use #070e1a / #101c2e, telemetry and focus use cyan #6ee7ff,
attention uses amber #fcd077, critical uses red #ff9aab, and unavailable/stale
data uses muted gray #a9b6c8. Risk and freshness always have separate text labels.
Existing nominal green remains a positive risk signal. Colors never replace text.

Global CSS defines a 4px spacing scale, 44px control target, 14px card radius,
system sans-serif typography and tabular communication-delay values. No remote
font or asset dependency is needed on an onboard terminal.

Shared components in components/ui/aura.tsx: StatusBadge, DataFreshnessBadge,
CommDelayBadge, CrewCard, AlertCard and ZoneStatusCard. MetricCard, LoadingState
and ErrorState are shared in ui.tsx. Crew shortcuts supplement the detailed table.

BodyMap uses native SVG and the API's five zone assessments, never generated
health values. The immune zone is the outer frame, as explained in the UI.
All zones expose named buttons and pressed states. Tab enters the selected zone;
arrows cycle zones, Home/End jump and Enter/Space select. A focused zone has a
white outline; selected zones use a dashed border and matching evidence card.
The evidence link supports direct navigation without forced scrolling on selection.

The profile is two-column on desktop, rearranges at 1100px for tablet/terminal,
and stacks below 560px. Large displays use two evidence columns above 1700px.
The existing shell adapts at 850px with a keyboard-accessible navigation dialog.
Reduced-motion rules, visible focus, labeled controls and native dialog behavior
are inherited from the workspace system. Browser CI covers keyboard selection
and 390px profile overflow in addition to the full workspace journey.

This is an operational interface foundation; medical rules and any certification
are independent of visual presentation.

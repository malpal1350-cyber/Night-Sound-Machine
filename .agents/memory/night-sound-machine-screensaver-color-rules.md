---
name: Night Sound Machine — ScreenSaver color rules
description: Persistence and priority rules for custom ScreenSaver clock colors, weekday schedules, and cycling.
---

# ScreenSaver color rules

Custom ScreenSaver colors are local preferences. The built-in palette stays available separately; users can keep up to 20 custom colors, add up to 7 weekday rules, and select up to 10 colors for a cycle. Default and scheduled palettes both expose the same built-in/custom choices plus Random.

**Why:** The ScreenSaver needs richer personalization without unbounded local preference data or rules that vanish after reload.

**How to apply:** Resolve the normal ScreenSaver color from the first weekday rule matching the local day; if no rule matches, use the user's default Clock color or its stable daily Random choice. Each matching schedule owns its cycle toggle and selected colors; when that schedule is cycling, its selection overrides the scheduled/default result while the ScreenSaver is active. The cycle multi-select is available only while that schedule is enabled; turning it off clears that schedule's cycle selections and selects Random for that schedule. Color transitions use the overlay's registered color custom property so changes fade instead of snapping. Removing a custom color must replace all of its saved references with the default color and remove it from every schedule cycle, never leaving a broken reference.
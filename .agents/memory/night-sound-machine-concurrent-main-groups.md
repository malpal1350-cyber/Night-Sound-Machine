---
name: Night Sound Machine concurrent main groups
description: The intended relationship between main-group playback and file roles.
---

Every enabled main group contributes one continuous loop to a night session; enabling or adding one must not silence existing main groups.

**Why:** A sound machine needs combinations such as ocean, rain, and fan at once, not a randomly chosen single main sound.

**How to apply:** Keep main audio channels independent but gapless. When a group changes between Main and Effect, update every file in that group to the corresponding role so playback behavior and library labels stay aligned.

Main groups use an independent, default-off sound limit. The limit is time-based only: Fixed stops after one configured duration, while Random chooses a value inside the configured range.

**Why:** Multiple main loops need to be able to end separately (for example, rain can fade out while crickets remain), without inheriting Effect groups' count-based play limit.

**How to apply:** Schedule, pause, resume, and clear one timer per active main track; never let one main group’s limit stop the others.

A user who enables a main group during a running session explicitly overrides its session-chance result for that session.

**Why:** The chance setting is only an automatic start choice; a manual toggle should always honor the user’s immediate intent.

**How to apply:** Re-enable the loop immediately on manual toggle and start its configured sound-limit timer, if any.

Effect groups use the same fresh-session chance selection as Main groups; an effect manually re-enabled during a running session joins that session without rerolling.

**Why:** Chance is an automatic session-start choice, while a mid-session toggle is an explicit user override.

**How to apply:** Keep the selected effect-group set stable through pause/resume, clear it when the session ends, and add a manually re-enabled effect before scheduling it.

New Main channels must pass an explicit zero start value into their fade rather than reading `AudioParam.value` immediately after `setValueAtTime(0)`.

**Why:** Chromium may still expose the gain node's default value during that same synchronous turn, making a scheduled fade-in begin at full volume.

**How to apply:** Use the explicit zero override only for newly created channels. When reversing an in-progress fade during snooze or re-enable, derive the current interpolated gain so the transition remains smooth.
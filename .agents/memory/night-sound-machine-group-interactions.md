---
name: Night Sound Machine group interactions
description: Session-start playback and non-interrupting suppression between Effect and Start/Stop groups.
---

Effect and Start/Stop groups have a separate opt-in `Play on session start` setting with its own percentage roll. It is independent of the session-chance setting that determines whether a group participates at all.

**Why:** A user may want a group to participate later in the session without forcing it to start immediately.

**How to apply:** Roll the session-start chance only for groups admitted to a fresh session. A successful roll schedules an immediate first playback; all other admitted groups retain their normal random interval.

Groups can also opt in as a source that stops other groups on play, or as a target that can be stopped by another group. Suppression applies only to Effect and Start/Stop targets, prevents new starts while the stopping source playback is active, and does not cut off an active clip or sequence.

**Why:** The user prefers relaxed handoffs that preserve the current sound/sequence rather than abrupt interruptions.

**How to apply:** Clear a suppressed target's pending timer and let an active Effect clip or complete Start/Run/Stop sequence finish. When the stopping clip or full source sequence ends, restore the target to its normal randomized schedule. If multiple sources overlap, wait until all of them finish. A manual re-enable still overrides suppression immediately.
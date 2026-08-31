---
name: Night Sound Machine Start/Run/Stop sequences
description: Rules for staged Start, Run, Stop groups and their session lifecycle.
---

Start/Stop groups need three distinct file roles: `start`, `run`, and `stop`. The Start and Stop clips play once, while Run loops. Treat each group as an independent staged lifecycle rather than reusing the shared Effect timer or Web Audio Main channels.

**Why:** Each phase needs different completion and overlap behavior, and shared effect playback would make groups interrupt one another. Progress events preserve the configured overlaps during pauses, unlike wall-clock transition timers.

**How to apply:** Schedule one random start delay per eligible group; begin Run at the configured percentage through Start, then begin Stop after a randomized Run duration and stop Run at the configured percentage through Stop. Select eligible groups once per fresh session, retain that decision on pause/resume, and allow a user toggle-on during a session to override its chance result. Always clear timers and dispose phase audio on disable, delete, alarm, or session end. Release completed Start audio before a later resume so it cannot replay.
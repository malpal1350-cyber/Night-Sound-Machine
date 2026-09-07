---
name: Night Sound Machine music playback lifecycle
description: Durable rules for preventing stale audio events and duplicate music playback.
---

Music playback treats element replacement and asynchronous `play()` completion as separate invalidation domains. Keep a playback-intent value independent of browser promise timing, and ensure an old element is fully paused, detached, and unloaded before it is discarded.

**Why:** A single shared generation counter invalidated the current element's later `ended` event after pause/resume. Merely dropping an old audio reference also allowed its native playback to continue in the background.

**How to apply:** Any new transport action, timer expiry path, or track-end behavior must use the shared audio lifecycle helpers rather than assigning or clearing the audio ref directly. Preserve separate guards for element callbacks and pending `play()` promises.
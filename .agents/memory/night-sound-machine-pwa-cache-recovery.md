---
name: Night Sound Machine — PWA cache recovery
description: Service-worker caching constraints and the safe recovery path for installed Raspberry Pi PWAs.
---

# PWA cache recovery

The service worker uses a network-first strategy with offline cache fallback. Cache writes must be awaited before returning the network response; otherwise an installed Chromium/Pi app can retain HTML without reliably retaining the hashed JavaScript bundle and appear blank after reopening.

**Why:** A Pi install encountered a blank loading screen after an update even though the live deployment and dev preview were healthy. The failure was consistent with a partially populated or stale service-worker cache, not the local preference data.

**How to apply:** Rotate the service-worker cache name when repairing stale installs. Keep the one-time `repair-cache` URL limited to unregistering service workers and deleting `nsm-` Cache Storage entries; do not clear localStorage or IndexedDB because those contain user preferences and local audio.
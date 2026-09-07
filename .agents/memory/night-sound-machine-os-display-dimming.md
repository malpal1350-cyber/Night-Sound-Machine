---
name: Night Sound Machine — OS display dimming
description: Browser-safe OS dimming and installed-host display-sleep behavior.
---

# OS display dimming

The browser app can only permit the operating system to dim by releasing its screen wake lock. It cannot directly sleep a Windows or Linux display. An optional installed desktop host can expose one generic display-sleep bridge, which the app calls only after its Night display has dimmed and the user-enabled delay expires. On Linux, an optional localhost-only helper is also available for an installed PWA and auto-detects supported X11/Wayland sessions.

**Why:** Browser security prevents direct OS display control, while an installed wrapper can implement the platform-specific command. The app must stay usable when no wrapper or command is available.

**How to apply:** Do not expose an OS picker in the web UI; the installed host or local helper owns operating-system detection and implementation. Treat the display-sleep bridge and localhost helper as optional, catch failures, and never interrupt audio or the running session if either is absent or fails.

OS dimming and display-sleep requests are permitted only after the Night UI has entered its own dim state and the session flashlight is off. The browser should keep its screen wake lock while the normal Night UI or flashlight is visible.

**Why:** A bright, active Night UI must remain available to the user. Releasing the wake lock earlier lets the operating system dim or sleep the display before the app has reached its intended low-light state.
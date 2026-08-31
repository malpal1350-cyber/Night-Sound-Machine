# Linux display helper

This optional helper lets an installed Night Sound Machine PWA ask Ubuntu to
turn off the display after the app has dimmed. It listens only on localhost.

From the workspace root, run:

```sh
pnpm --filter @workspace/night-sound-machine display-helper
```

Keep it running while using the app, then enable **Request display sleep after
dimming** in **Preferences → Night display**. The helper detects X11 and
Wayland automatically:

- X11 uses `xset dpms force off`
- Ubuntu GNOME on Wayland activates the GNOME screen saver without locking
- Sway/wlroots uses `swaymsg` when available

The helper does not accept remote connections and returns a harmless error when
the required desktop command is unavailable. The app continues playing audio
normally in that case.
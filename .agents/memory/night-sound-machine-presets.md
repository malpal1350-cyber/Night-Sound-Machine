---
name: Night Sound Machine — saved presets & SpinnerField
description: How saved timer/alarm presets and the touch-friendly SpinnerField work, including storage keys and prop-threading pattern.
---

# Saved presets & SpinnerField

## Storage
- `SAVED_TIMERS_KEY = 'nsm-saved-timers-v1'` — `TimerParts[]` in localStorage, max 20 presets
- `SAVED_ALARMS_KEY = 'nsm-saved-alarms-v1'` — `string[]` (HH:MM) in localStorage, max 20 presets
- State lives in App: `savedTimers`, `savedAlarms` with dedicated `useEffect` persist triggers.
- Shared pool: both SessionEndPanel and SessionSchedulePanel read the same saved lists.

## Prop threading
`savedTimers`, `savedAlarms`, `onSaveTimer`, `onDeleteTimer`, `onSaveAlarm`, `onDeleteAlarm` are passed through `HomePageProps → HomePage → SessionEndPanel / SessionSchedulePanel`. Handlers are inline arrow functions at the `<HomePage>` call site (using `timerPartsEqual` helper for de-dup).

## SpinnerField component
Located just before `SessionEndPanel` comment block. Uses two refs (`holdRef`, `repeatRef`) for long-press repeat: first step is immediate, then after 450ms a 80ms interval fires. Uses `onPointerDown/Up/Leave` (not mouse events) so it works on touch screens. `valueRef` avoids stale closure in the interval callback. Its central value is an editable numeric field: values can be typed and committed with Enter or blur, while ArrowUp/ArrowDown (and left/right) plus keyboard-activated controls remain supported without double-stepping pointer clicks.

## UI pattern (SessionEndPanel / SessionSchedulePanel)
1. If saved presets exist: show `.preset-chips` row (each chip = label button + × delete button), plus a "Custom" dashed chip.
2. Custom chip (or no presets): show `.spinner-row` of SpinnerFields + a `.preset-save-btn` (Bookmark icon) when the value isn't already saved.
3. Saving auto-hides the custom row and selects the new chip.
4. `showCustomTimer`/`showCustomAlarm` local state; auto-shows when savedTimers/Alarms length drops to 0.

## Helpers
- `formatTimerChip(t)` → "8h", "30m", "1h 30m", "30s"
- `formatAlarmChip(time)` → "7:00 AM", "10:30 PM" (always 12h for chip display)
- `timerPartsEqual(a, b)` → boolean (used for de-dup and active-chip highlight)

**Why:** Native `input[type=number]` steppers are too small for touch screens (Raspberry Pi with Chromium kiosk). SpinnerField gives 44×56px tap targets. Saved presets let nightly users set their timer in one tap instead of re-entering it each time.

**Accessibility rule:** Every future use of SpinnerField must preserve both the large touch targets and keyboard adjustment behavior; pointer-only handlers are not sufficient.

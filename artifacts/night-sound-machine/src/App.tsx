import React, { useEffect, useMemo, useRef, useState, type ComponentType, type ChangeEvent, type CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import {
  AlarmClock,
  Anchor,
  Archive,
  Bell,
  BellOff,
  Bike,
  Bird,
  Bug,
  Bus,
  Car,
  Cat,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  CircleHelp,
  Clover,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Dog,
  Droplets,
  Feather,
  Fish,
  Flame,
  Flower2,
  FolderPlus,
  Gamepad2,
  Ghost,
  Headphones,
  Heart,
  Home as HomeIcon,
  Leaf,
  Library,
  ListMusic,
  LockKeyhole,
  Maximize2,
  Menu,
  Mic2,
  Minimize2,
  Moon,
  MoonStar,
  MoreHorizontal,
  Mountain,
  Music,
  Music2,
  Pause,
  PanelLeftClose,
  PanelLeftOpen,
  PawPrint,
  Pencil,
  Plane,
  Play,
  Plus,
  Rabbit,
  Radio,
  Repeat,
  Repeat1,
  Settings,
  Shell,
  Ship,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Snail,
  Snowflake,
  Sparkles,
  Squirrel,
  Square,
  Star,
  Stars,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  TentTree,
  Timer,
  Train,
  Trash2,
  TreeDeciduous,
  TreePalm,
  TreePine,
  Trees,
  Truck,
  Turtle,
  Upload,
  Volume2,
  Waves,
  Wind,
  Worm,
  X,
  Zap,
  ExternalLink,
  Bookmark,
} from 'lucide-react';

type GroupKind = 'main' | 'effect' | 'startStop';
type SoundRole = GroupKind | 'start' | 'run' | 'stop' | 'unassigned';
type LimitKind = 'count' | 'time';
type TimeLimitMode = 'fixed' | 'random';
type MusicTrack = { id: string; name: string; size: number; url?: string; };
type Playlist = { id: string; name: string; tracks: MusicTrack[]; };
type MusicStatus = 'idle' | 'playing' | 'paused';
type MusicRepeat = 'none' | 'one' | 'all';
type MusicTimerUnit = 'hours' | 'minutes';
type Page = 'home' | 'games' | 'music' | 'library' | 'settings';
type SettingsSection = 'night-display' | 'screensaver' | 'app-settings';
type SessionStatus = 'idle' | 'running' | 'paused' | 'alarming';
type EndMode = 'none' | 'timer' | 'alarm';
type ScheduleMode = 'off' | 'countdown' | 'time';
type GroupSessionSettingKey = 'sessionChanceEnabled' | 'sessionChance' | 'autoStopEnabled' | 'minDuration' | 'maxDuration' | 'playOnSessionStart' | 'playOnSessionStartChance' | 'stopGroupsOnPlay' | 'stopWhenOtherGroupsPlay';
type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
type TimerParts = { hours: number; minutes: number; seconds: number; milliseconds: number };
type ClockColorSchedule = { id: string; color: string; days: number[]; cycleEnabled: boolean; cycleColors: string[] };
type MainAudioChannel = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  groupId: string;
  fadeTimer?: number;
  fadeGeneration: number;
  fadeFrom?: number;
  fadeTo?: number;
  fadeStartedAt?: number;
  fadeDuration?: number;
  fadingOut?: boolean;
};
type StartStopPlayback = {
  generation: number;
  groupId: string;
  startAudio?: HTMLAudioElement;
  runAudio?: HTMLAudioElement;
  stopAudio?: HTMLAudioElement;
  runStopTimer?: number;
  runStopEnd?: number;
  pausedRunStopRemaining?: number;
  runStarted: boolean;
  stopping: boolean;
  beginStop?: () => void;
  releaseSuppressedGroups?: () => void;
};

type SoundFile = {
  id: string;
  name: string;
  size: number;
  role: SoundRole;
  url?: string;
  demo?: boolean;
};

type SoundGroup = {
  id: string;
  name: string;
  kind: GroupKind;
  color: string;
  icon?: string;
  enabled: boolean;
  volume: number;
  minInterval: number;
  maxInterval: number;
  limitEnabled: boolean;
  limitKind: LimitKind;
  limit: number;
  timeLimit: number;       // min (or the only value in fixed mode)
  timeLimitMode?: TimeLimitMode;
  timeLimitMax?: number;   // max value, only used in random mode
  plays: number;
  sessionChanceEnabled?: boolean;
  sessionChance?: number;
  playOnSessionStart?: boolean;
  playOnSessionStartChance?: number;
  stopGroupsOnPlay?: boolean;
  stopWhenOtherGroupsPlay?: boolean;
  autoStopEnabled?: boolean;
  autoStopMode?: TimeLimitMode;
  minDuration?: number;
  maxDuration?: number;
  runMinDuration?: number;
  runMaxDuration?: number;
  startRunPercent?: number;
  stopRunPercent?: number;
  files: SoundFile[];
};

const STORAGE_KEY = 'night-sound-machine-library-v2';
const LEGACY_STORAGE_KEY = 'night-sound-machine-library-v1';
const FILE_DB_NAME = 'night-sound-machine-files';
const FILE_DB_VERSION = 1;
const FILE_STORE = 'audio-files';

// ── IndexedDB helpers for persisting actual audio file data across page reloads ──
// Blob URLs are session-only; storing the ArrayBuffer in IDB lets us recreate them.
function openFileDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(FILE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeAudioFile(id: string, file: File): Promise<void> {
  try {
    const [db, buffer] = await Promise.all([openFileDB(), file.arrayBuffer()]);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).put({ buffer, type: file.type || 'audio/mpeg' }, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* private browsing or quota exceeded — fail silently */ }
}

async function loadAudioFile(id: string): Promise<{ buffer: ArrayBuffer; type: string } | null> {
  try {
    const db = await openFileDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const req = tx.objectStore(FILE_STORE).get(id);
      req.onsuccess = () => { db.close(); resolve((req.result as { buffer: ArrayBuffer; type: string } | undefined) ?? null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

async function deleteAudioFile(id: string): Promise<void> {
  try {
    const db = await openFileDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch { /* ignore */ }
}
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;
const COLORS = ['#f5b873', '#d9839a', '#8db3b8', '#a597d5', '#d3a486', '#92aa73'];
const NIGHT_TEXT_COLORS = ['#ef5b5b', '#f5b873', '#d9839a', '#a597d5', '#8db3b8', '#f2edf5'];
const CLOCK_DISPLAY_COLORS = ['#ffffff', '#ef5b5b', '#f5b873', '#d9839a', '#a597d5', '#8db3b8'];
const RANDOM_CLOCK_COLOR = 'random';
const MAX_CUSTOM_CLOCK_COLORS = 20;
const MAX_CLOCK_COLOR_SCHEDULES = 7;
const MAX_CLOCK_CYCLE_COLORS = 10;
const CLOCK_COLOR_WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];
const DEFAULT_MAIN_MIN_DURATION = 30 * MINUTE_MS;
const DEFAULT_MAIN_MAX_DURATION = 90 * MINUTE_MS;
const DEFAULT_TIME_LIMIT = 30 * MINUTE_MS;
const DEFAULT_TIME_LIMIT_MAX = 60 * MINUTE_MS;
const DEFAULT_START_STOP_RUN_MIN_DURATION = 10 * MINUTE_MS;
const DEFAULT_START_STOP_RUN_MAX_DURATION = 30 * MINUTE_MS;
const DEFAULT_START_RUN_PERCENT = 90;
const DEFAULT_STOP_RUN_PERCENT = 5;
const MUSIC_STORAGE_KEY = 'night-sound-machine-music-v1';
const PREFS_STORAGE_KEY = 'night-sound-machine-prefs-v1';
const DISMISSED_UPDATE_KEY = 'nsm-dismissed-update-v1';
const SAVED_TIMERS_KEY = 'nsm-saved-timers-v1';
const SAVED_ALARMS_KEY = 'nsm-saved-alarms-v1';
const MAX_SAVED_PRESETS = 20;
const DEFAULT_MUSIC_VOLUME = 80;


const DEFAULT_PREFS = {
  nightTextColor: NIGHT_TEXT_COLORS[1],
  nightShowDate: true,
  nightShowSeconds: false,
  nightHour12: true,
  nightShowAmPm: true,
  nightClockFont: 'Nunito Sans',
  nightShowStopwatch: true,
  nightDimEnabled: true,
  nightOsDimEnabled: false,
  nightOsSleepEnabled: false,
  nightOsSleepDelaySecs: 300,
  nightDimDelaySecs: 20,
  nightDimColor: NIGHT_TEXT_COLORS[0],
  nightDimShowClock: true,
  nightDimShowDate: false,
  nightDimShowSeconds: false,
  nightDimShowAmPm: false,
  nightDimBrightness: 15,
  flashlightBrightness: 75,
  clockDisplayEnabled: true,
  clockDisplayDelaySecs: 1800,
  clockDisplayColor: '#ffffff',
  clockDisplayRandomColor: false,
  clockDisplayCustomColors: [] as string[],
  clockDisplayColorSchedules: [] as ClockColorSchedule[],
  clockDisplayCycleEnabled: false,
  clockDisplayCycleColors: [] as string[],
  clockDisplayFont: 'Nunito Sans',
  clockDisplayShowDate: true,
  clockDisplayShowSeconds: false,
  clockDisplayHour12: true,
  clockDisplayShowAmPm: true,
  volume: 62,
  alarmSoundId: null as string | null,
  alarmSoundName: '',
  alarmOnTimer: true,
  alarmOnAlarm: true,
  alarmSnoozeMins: 9,
  alarmSnoozeSecs: 0,
  alarmVolume: 100,
  alarmSnoozeResumeAudio: true,
  alarmPulseOnTimer: true,
  alarmPulseOnAlarm: true,
};

function normalizeClockColor(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function readClockColorList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  const colors: string[] = [];
  value.forEach((item) => {
    const color = normalizeClockColor(item);
    if (color && !colors.includes(color) && colors.length < max) colors.push(color);
  });
  return colors;
}

function readClockColorSchedules(value: unknown, availableColors: string[], legacyCycleEnabled = false, legacyCycleColors: string[] = []) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CLOCK_COLOR_SCHEDULES).flatMap((item, index): ClockColorSchedule[] => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Partial<ClockColorSchedule>;
    const normalizedColor = normalizeClockColor(entry.color);
    const color = entry.color === RANDOM_CLOCK_COLOR ? RANDOM_CLOCK_COLOR : normalizedColor;
    if (!color || (color !== RANDOM_CLOCK_COLOR && !availableColors.includes(color))) return [];
    const days = Array.isArray(entry.days)
      ? Array.from(new Set(entry.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)))
      : [];
    const cycleColors = readClockColorList(entry.cycleColors, MAX_CLOCK_CYCLE_COLORS)
      .filter((cycleColor) => availableColors.includes(cycleColor));
    const usesLegacyCycle = index === 0 && typeof entry.cycleEnabled !== 'boolean' && legacyCycleEnabled;
    return [{
      id: typeof entry.id === 'string' && entry.id ? entry.id : `clock-color-schedule-${index}`,
      color,
      days,
      cycleEnabled: typeof entry.cycleEnabled === 'boolean' ? entry.cycleEnabled : usesLegacyCycle,
      cycleColors: cycleColors.length ? cycleColors : (usesLegacyCycle ? legacyCycleColors : []),
    }];
  });
}

function newClockColorSchedule(color: string): ClockColorSchedule {
  return { id: `clock-color-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, color, days: [], cycleEnabled: false, cycleColors: [] };
}

async function requestOsDisplaySleep(): Promise<void> {
  try {
    const host = window as Window & {
      nightSoundMachine?: { requestDisplaySleep?: () => void | Promise<void> };
    };
    const result = host.nightSoundMachine?.requestDisplaySleep?.();
    if (result) await result;
    if (host.nightSoundMachine?.requestDisplaySleep) return;
  } catch {
    // An installed wrapper may not expose an OS bridge; the web app keeps running.
  }

  // Optional localhost helper for an installed PWA on Linux. Fetch failures are
  // expected when the helper is not installed, so they must remain silent.
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    try {
      await fetch('http://127.0.0.1:17841/v1/display/sleep', {
        method: 'POST',
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    // Unsupported or unavailable helper: leave the app and session running.
  }
}

function readStoredPrefs() {
  try {
    const saved = localStorage.getItem(PREFS_STORAGE_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      const customClockColors = readClockColorList(p.clockDisplayCustomColors, MAX_CUSTOM_CLOCK_COLORS)
        .filter((color) => !CLOCK_DISPLAY_COLORS.includes(color));
      const availableClockColors = [...CLOCK_DISPLAY_COLORS, ...customClockColors];
      const storedClockColor = normalizeClockColor(p.clockDisplayColor);
      const clockDisplayColor = storedClockColor && availableClockColors.includes(storedClockColor)
        ? storedClockColor
        : DEFAULT_PREFS.clockDisplayColor;
      const legacyCycleColors = readClockColorList(p.clockDisplayCycleColors, MAX_CLOCK_CYCLE_COLORS)
        .filter((color) => availableClockColors.includes(color));
      const legacyCycleEnabled = typeof p.clockDisplayCycleEnabled === 'boolean' ? p.clockDisplayCycleEnabled : false;
      return {
        nightTextColor: typeof p.nightTextColor === 'string' ? p.nightTextColor : DEFAULT_PREFS.nightTextColor,
        nightShowDate: typeof p.nightShowDate === 'boolean' ? p.nightShowDate : DEFAULT_PREFS.nightShowDate,
        nightShowSeconds: typeof p.nightShowSeconds === 'boolean' ? p.nightShowSeconds : DEFAULT_PREFS.nightShowSeconds,
        nightHour12: typeof p.nightHour12 === 'boolean' ? p.nightHour12 : DEFAULT_PREFS.nightHour12,
        nightShowAmPm: typeof p.nightShowAmPm === 'boolean' ? p.nightShowAmPm : DEFAULT_PREFS.nightShowAmPm,
        nightClockFont: typeof p.nightClockFont === 'string' ? p.nightClockFont : DEFAULT_PREFS.nightClockFont,
        nightShowStopwatch: typeof p.nightShowStopwatch === 'boolean' ? p.nightShowStopwatch : DEFAULT_PREFS.nightShowStopwatch,
        nightDimEnabled: typeof p.nightDimEnabled === 'boolean' ? p.nightDimEnabled : DEFAULT_PREFS.nightDimEnabled,
        nightOsDimEnabled: typeof p.nightOsDimEnabled === 'boolean' ? p.nightOsDimEnabled : DEFAULT_PREFS.nightOsDimEnabled,
        nightOsSleepEnabled: typeof p.nightOsSleepEnabled === 'boolean' ? p.nightOsSleepEnabled : DEFAULT_PREFS.nightOsSleepEnabled,
        nightOsSleepDelaySecs: typeof p.nightOsSleepDelaySecs === 'number' ? Math.max(1, Math.min(86400, p.nightOsSleepDelaySecs)) : DEFAULT_PREFS.nightOsSleepDelaySecs,
        nightDimDelaySecs: typeof p.nightDimDelaySecs === 'number' ? Math.max(5, Math.min(3600, p.nightDimDelaySecs)) : DEFAULT_PREFS.nightDimDelaySecs,
        nightDimColor: (typeof p.nightDimColor === 'string' && NIGHT_TEXT_COLORS.includes(p.nightDimColor)) ? p.nightDimColor : DEFAULT_PREFS.nightDimColor,
        nightDimShowClock: typeof p.nightDimShowClock === 'boolean' ? p.nightDimShowClock : DEFAULT_PREFS.nightDimShowClock,
        nightDimShowDate: typeof p.nightDimShowDate === 'boolean' ? p.nightDimShowDate : DEFAULT_PREFS.nightDimShowDate,
        nightDimShowSeconds: typeof p.nightDimShowSeconds === 'boolean' ? p.nightDimShowSeconds : DEFAULT_PREFS.nightDimShowSeconds,
        nightDimShowAmPm: typeof p.nightDimShowAmPm === 'boolean' ? p.nightDimShowAmPm : DEFAULT_PREFS.nightDimShowAmPm,
        nightDimBrightness: typeof p.nightDimBrightness === 'number' ? Math.max(0, Math.min(100, p.nightDimBrightness)) : DEFAULT_PREFS.nightDimBrightness,
        flashlightBrightness: typeof p.flashlightBrightness === 'number' ? Math.max(0, Math.min(100, p.flashlightBrightness)) : DEFAULT_PREFS.flashlightBrightness,
        clockDisplayEnabled: typeof p.clockDisplayEnabled === 'boolean' ? p.clockDisplayEnabled : DEFAULT_PREFS.clockDisplayEnabled,
        clockDisplayDelaySecs: typeof p.clockDisplayDelaySecs === 'number' ? Math.max(20, Math.min(86400, p.clockDisplayDelaySecs)) : DEFAULT_PREFS.clockDisplayDelaySecs,
        clockDisplayColor,
        clockDisplayRandomColor: typeof p.clockDisplayRandomColor === 'boolean' ? p.clockDisplayRandomColor : DEFAULT_PREFS.clockDisplayRandomColor,
        clockDisplayCustomColors: customClockColors,
        clockDisplayColorSchedules: readClockColorSchedules(p.clockDisplayColorSchedules, availableClockColors, legacyCycleEnabled, legacyCycleColors),
        clockDisplayCycleEnabled: typeof p.clockDisplayCycleEnabled === 'boolean' ? p.clockDisplayCycleEnabled : DEFAULT_PREFS.clockDisplayCycleEnabled,
        clockDisplayCycleColors: readClockColorList(p.clockDisplayCycleColors, MAX_CLOCK_CYCLE_COLORS).filter((color) => availableClockColors.includes(color)),
        clockDisplayFont: (typeof p.clockDisplayFont === 'string' && CLOCK_FONTS.some((f) => f.value === p.clockDisplayFont)) ? p.clockDisplayFont : DEFAULT_PREFS.clockDisplayFont,
        clockDisplayShowDate: typeof p.clockDisplayShowDate === 'boolean' ? p.clockDisplayShowDate : DEFAULT_PREFS.clockDisplayShowDate,
        clockDisplayShowSeconds: typeof p.clockDisplayShowSeconds === 'boolean' ? p.clockDisplayShowSeconds : DEFAULT_PREFS.clockDisplayShowSeconds,
        clockDisplayHour12: typeof p.clockDisplayHour12 === 'boolean' ? p.clockDisplayHour12 : DEFAULT_PREFS.clockDisplayHour12,
        clockDisplayShowAmPm: typeof p.clockDisplayShowAmPm === 'boolean' ? p.clockDisplayShowAmPm : DEFAULT_PREFS.clockDisplayShowAmPm,
        volume: typeof p.volume === 'number' ? Math.min(100, Math.max(0, p.volume)) : DEFAULT_PREFS.volume,
        alarmSoundId: typeof p.alarmSoundId === 'string' ? p.alarmSoundId : DEFAULT_PREFS.alarmSoundId,
        alarmSoundName: typeof p.alarmSoundName === 'string' ? p.alarmSoundName : DEFAULT_PREFS.alarmSoundName,
        alarmOnTimer: typeof p.alarmOnTimer === 'boolean' ? p.alarmOnTimer : DEFAULT_PREFS.alarmOnTimer,
        alarmOnAlarm: typeof p.alarmOnAlarm === 'boolean' ? p.alarmOnAlarm : DEFAULT_PREFS.alarmOnAlarm,
        alarmSnoozeMins: typeof p.alarmSnoozeMins === 'number' ? Math.max(1, Math.min(999, p.alarmSnoozeMins)) : DEFAULT_PREFS.alarmSnoozeMins,
        alarmSnoozeSecs: typeof p.alarmSnoozeSecs === 'number' ? Math.max(0, Math.min(59, p.alarmSnoozeSecs)) : DEFAULT_PREFS.alarmSnoozeSecs,
        alarmVolume: typeof p.alarmVolume === 'number' ? Math.min(100, Math.max(0, p.alarmVolume)) : DEFAULT_PREFS.alarmVolume,
        alarmSnoozeResumeAudio: typeof p.alarmSnoozeResumeAudio === 'boolean' ? p.alarmSnoozeResumeAudio : DEFAULT_PREFS.alarmSnoozeResumeAudio,
        alarmPulseOnTimer: typeof p.alarmPulseOnTimer === 'boolean' ? p.alarmPulseOnTimer : DEFAULT_PREFS.alarmPulseOnTimer,
        alarmPulseOnAlarm: typeof p.alarmPulseOnAlarm === 'boolean' ? p.alarmPulseOnAlarm : DEFAULT_PREFS.alarmPulseOnAlarm,
      };
    }
  } catch { /* private browsing or corrupted */ }
  return { ...DEFAULT_PREFS };
}

type ClockFont = { value: string; label: string; google: string; weight: string };
const CLOCK_FONTS: ClockFont[] = [
  { value: 'Nunito Sans', label: 'Nunito Sans', google: 'Nunito+Sans:wght@800', weight: '800' },
  { value: 'Bebas Neue', label: 'Bebas Neue', google: 'Bebas+Neue', weight: '400' },
  { value: 'Oswald', label: 'Oswald', google: 'Oswald:wght@600', weight: '600' },
  { value: 'Raleway', label: 'Raleway', google: 'Raleway:wght@800', weight: '800' },
  { value: 'Montserrat', label: 'Montserrat', google: 'Montserrat:wght@800', weight: '800' },
];

// Ordered list of all user-selectable icons with their display key.
const GROUP_ICONS: { key: string; Component: IconType }[] = [
  // Night sky
  { key: 'Moon', Component: Moon },
  { key: 'MoonStar', Component: MoonStar },
  { key: 'Stars', Component: Stars },
  { key: 'CloudMoon', Component: CloudMoon },
  { key: 'Sunset', Component: Sunset },
  { key: 'Sunrise', Component: Sunrise },
  // Weather
  { key: 'CloudRain', Component: CloudRain },
  { key: 'CloudLightning', Component: CloudLightning },
  { key: 'CloudDrizzle', Component: CloudDrizzle },
  { key: 'CloudSnow', Component: CloudSnow },
  { key: 'CloudFog', Component: CloudFog },
  { key: 'CloudSun', Component: CloudSun },
  { key: 'Waves', Component: Waves },
  { key: 'Wind', Component: Wind },
  { key: 'Snowflake', Component: Snowflake },
  { key: 'Sun', Component: Sun },
  { key: 'Droplets', Component: Droplets },
  { key: 'Flame', Component: Flame },
  // Night creatures & critters
  { key: 'Bug', Component: Bug },
  { key: 'Turtle', Component: Turtle },
  { key: 'Snail', Component: Snail },
  { key: 'Worm', Component: Worm },
  { key: 'Shell', Component: Shell },
  { key: 'PawPrint', Component: PawPrint },
  { key: 'Ghost', Component: Ghost },
  // Animals
  { key: 'Bird', Component: Bird },
  { key: 'Cat', Component: Cat },
  { key: 'Dog', Component: Dog },
  { key: 'Fish', Component: Fish },
  { key: 'Rabbit', Component: Rabbit },
  { key: 'Squirrel', Component: Squirrel },
  // Nature & outdoors
  { key: 'Leaf', Component: Leaf },
  { key: 'TreePine', Component: TreePine },
  { key: 'TreeDeciduous', Component: TreeDeciduous },
  { key: 'TreePalm', Component: TreePalm },
  { key: 'Trees', Component: Trees },
  { key: 'Mountain', Component: Mountain },
  { key: 'Flower2', Component: Flower2 },
  { key: 'Clover', Component: Clover },
  { key: 'Tent', Component: Tent },
  { key: 'TentTree', Component: TentTree },
  // Vehicles
  { key: 'Bike', Component: Bike },
  { key: 'Car', Component: Car },
  { key: 'Truck', Component: Truck },
  { key: 'Bus', Component: Bus },
  { key: 'Train', Component: Train },
  { key: 'Plane', Component: Plane },
  { key: 'Ship', Component: Ship },
  { key: 'Anchor', Component: Anchor },
  // Music & sound
  { key: 'Music2', Component: Music2 },
  { key: 'Music', Component: Music },
  { key: 'Headphones', Component: Headphones },
  { key: 'Radio', Component: Radio },
  { key: 'Mic2', Component: Mic2 },
  { key: 'Volume2', Component: Volume2 },
  // Symbols
  { key: 'Heart', Component: Heart },
  { key: 'Star', Component: Star },
  { key: 'Zap', Component: Zap },
  { key: 'Feather', Component: Feather },
  { key: 'Sparkles', Component: Sparkles },
  { key: 'Bell', Component: Bell },
];
const GROUP_ICON_MAP: Record<string, IconType> = Object.fromEntries(
  GROUP_ICONS.map(({ key, Component }) => [key, Component]),
);

// Used wherever a group's icon needs to be resolved.
const iconForGroup = (name: string, icon?: string): IconType => {
  if (icon && GROUP_ICON_MAP[icon]) return GROUP_ICON_MAP[icon];
  const lower = name.toLowerCase();
  if (lower.includes('rain')) return CloudRain;
  if (lower.includes('thunder') || lower.includes('storm')) return CloudLightning;
  if (lower.includes('ocean') || lower.includes('wave')) return Waves;
  if (lower.includes('cricket') || lower.includes('bird')) return Bird;
  return Music2;
};

// Returns the icon key that iconForGroup would resolve to — used to pre-populate
// the icon picker when editing a group that has no explicitly stored icon.
const iconKeyForGroup = (name: string, icon?: string): string => {
  if (icon && GROUP_ICON_MAP[icon]) return icon;
  const lower = name.toLowerCase();
  if (lower.includes('rain')) return 'CloudRain';
  if (lower.includes('thunder') || lower.includes('storm')) return 'CloudLightning';
  if (lower.includes('ocean') || lower.includes('wave')) return 'Waves';
  if (lower.includes('cricket') || lower.includes('bird')) return 'Bird';
  return 'Music2';
};

const seededGroups: SoundGroup[] = [
  {
    id: 'crickets', name: 'Crickets', kind: 'main', color: '#f5b873', enabled: true, volume: 100,
    minInterval: 8 * MINUTE_MS, maxInterval: 14 * MINUTE_MS, limitEnabled: true, limitKind: 'count', limit: 6, timeLimit: DEFAULT_TIME_LIMIT, plays: 0,
    files: [
      { id: 'crickets-meadow', name: 'Meadow at 11pm.wav', size: 18400000, role: 'main', demo: true },
      { id: 'crickets-close', name: 'Close to the porch.wav', size: 12600000, role: 'main', demo: true },
    ],
  },
  {
    id: 'rain', name: 'Rain', kind: 'effect', color: '#8db3b8', enabled: true, volume: 100,
    minInterval: 5 * MINUTE_MS, maxInterval: 11 * MINUTE_MS, limitEnabled: true, limitKind: 'count', limit: 5, timeLimit: DEFAULT_TIME_LIMIT, plays: 0,
    files: [
      { id: 'rain-window', name: 'Against the window.wav', size: 9600000, role: 'effect', demo: true },
      { id: 'rain-gutter', name: 'Soft gutter rain.wav', size: 14800000, role: 'effect', demo: true },
      { id: 'rain-roof', name: 'Rain on a tin roof.wav', size: 22300000, role: 'effect', demo: true },
    ],
  },
  {
    id: 'thunder', name: 'Thunder', kind: 'effect', color: '#a597d5', enabled: false, volume: 100,
    minInterval: 12 * MINUTE_MS, maxInterval: 22 * MINUTE_MS, limitEnabled: true, limitKind: 'count', limit: 3, timeLimit: DEFAULT_TIME_LIMIT, plays: 0,
    files: [
      { id: 'thunder-far', name: 'Far off, barely there.wav', size: 11900000, role: 'effect', demo: true },
      { id: 'thunder-low', name: 'Low rolling room.wav', size: 17100000, role: 'effect', demo: true },
    ],
  },
  {
    id: 'ocean', name: 'Ocean', kind: 'main', color: '#d9839a', enabled: false, volume: 100,
    minInterval: 8 * MINUTE_MS, maxInterval: 16 * MINUTE_MS, limitEnabled: true, limitKind: 'count', limit: 4, timeLimit: DEFAULT_TIME_LIMIT, plays: 0,
    files: [{ id: 'ocean-tide', name: 'Tide coming in.wav', size: 20100000, role: 'main', demo: true }],
  },
];

function readStoredPlaylists(): Playlist[] {
  try {
    const saved = localStorage.getItem(MUSIC_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Playlist[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* private browsing */ }
  return [];
}

function formatAudioTime(totalSeconds: number) {
  const s = Math.floor(Math.max(0, totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function rolesForGroupKind(files: SoundFile[], kind: GroupKind): SoundFile[] {
  if (kind !== 'startStop') return files.map((file) => ({ ...file, role: kind }));
  const roles: SoundRole[] = ['start', 'run', 'stop'];
  return files.map((file, index) => ({ ...file, role: roles[index] ?? 'unassigned' }));
}

function readStoredGroups(): SoundGroup[] {
  const normalizeGroup = (group: SoundGroup): SoundGroup => ({
    ...group,
    volume: Math.min(100, Math.max(0, group.volume ?? 100)),
    limitEnabled: group.limitEnabled !== false,
    limitKind: group.limitKind ?? 'count',
    timeLimit: Math.max(1, group.timeLimit ?? DEFAULT_TIME_LIMIT),
    timeLimitMode: group.timeLimitMode ?? 'fixed',
    timeLimitMax: Math.max(1, group.timeLimitMax ?? DEFAULT_TIME_LIMIT_MAX),
    sessionChanceEnabled: group.sessionChanceEnabled === true,
    sessionChance: Math.min(100, Math.max(0, group.sessionChance ?? 100)),
    playOnSessionStart: group.playOnSessionStart === true,
    playOnSessionStartChance: Math.min(100, Math.max(0, group.playOnSessionStartChance ?? 100)),
    stopGroupsOnPlay: group.stopGroupsOnPlay === true,
    stopWhenOtherGroupsPlay: group.stopWhenOtherGroupsPlay === true,
    autoStopEnabled: group.autoStopEnabled === true,
    autoStopMode: group.autoStopMode ?? 'random',
    minDuration: Math.max(1, group.minDuration ?? DEFAULT_MAIN_MIN_DURATION),
    maxDuration: Math.max(1, group.maxDuration ?? DEFAULT_MAIN_MAX_DURATION),
    runMinDuration: Math.max(1, group.runMinDuration ?? DEFAULT_START_STOP_RUN_MIN_DURATION),
    runMaxDuration: Math.max(1, group.runMaxDuration ?? DEFAULT_START_STOP_RUN_MAX_DURATION),
    startRunPercent: Math.min(100, Math.max(0, group.startRunPercent ?? DEFAULT_START_RUN_PERCENT)),
    stopRunPercent: Math.min(100, Math.max(0, group.stopRunPercent ?? DEFAULT_STOP_RUN_PERCENT)),
    files: group.kind === 'startStop'
      ? group.files.map((file) => ({ ...file, role: ['start', 'run', 'stop'].includes(file.role) ? file.role : 'unassigned' as SoundRole }))
      : group.files,
  });
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SoundGroup[];
      if (Array.isArray(parsed)) return parsed.map(normalizeGroup);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as SoundGroup[];
      if (Array.isArray(parsed)) {
        return parsed.map((group) => normalizeGroup({
          ...group,
          minInterval: group.minInterval * MINUTE_MS,
          maxInterval: group.maxInterval * MINUTE_MS,
          limitEnabled: group.limitEnabled !== false,
        }));
      }
    }
  } catch { /* private browsing or corrupted data */ }
  return seededGroups;
}

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSize(bytes: number) {
  if (!bytes) return 'Audio file';
  return `${(bytes / 1000000).toFixed(1)} MB`;
}

type DurationUnit = 'hours' | 'minutes' | 'seconds' | 'milliseconds';
type IntervalKey = 'minInterval' | 'maxInterval';

function getDurationParts(totalMilliseconds: number) {
  return {
    hours: Math.floor(totalMilliseconds / HOUR_MS),
    minutes: Math.floor((totalMilliseconds % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((totalMilliseconds % MINUTE_MS) / SECOND_MS),
    milliseconds: Math.floor(totalMilliseconds % SECOND_MS),
  };
}

function formatDuration(totalMilliseconds: number) {
  const parts = getDurationParts(totalMilliseconds);
  return `${parts.hours}h ${String(parts.minutes).padStart(2, '0')}m ${String(parts.seconds).padStart(2, '0')}s ${String(parts.milliseconds).padStart(3, '0')}ms`;
}

function formatTimerChip(t: TimerParts): string {
  const parts: string[] = [];
  if (t.hours > 0) parts.push(`${t.hours}h`);
  if (t.minutes > 0) parts.push(`${t.minutes}m`);
  if (t.seconds > 0) parts.push(`${t.seconds}s`);
  if (t.milliseconds > 0 && parts.length === 0) parts.push(`${t.milliseconds}ms`);
  return parts.length > 0 ? parts.join(' ') : '0s';
}
function formatAlarmChip(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function timerPartsEqual(a: TimerParts, b: TimerParts) {
  return a.hours === b.hours && a.minutes === b.minutes && a.seconds === b.seconds && a.milliseconds === b.milliseconds;
}
function formatDurationNoMs(totalMilliseconds: number) {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const segments: string[] = [];
  if (hours > 0) segments.push(`${hours}h`);
  segments.push(`${String(minutes).padStart(2, '0')}m`);
  segments.push(`${String(seconds).padStart(2, '0')}s`);
  return segments.join(' ');
}

function timerPartsToMilliseconds(parts: TimerParts) {
  return parts.hours * HOUR_MS + parts.minutes * MINUTE_MS + parts.seconds * SECOND_MS + parts.milliseconds;
}

function getAlarmDeadline(alarmTime: string) {
  if (!alarmTime) return null;
  const [hoursValue, minutesValue, secondsValue] = alarmTime.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  const seconds = secondsValue ? Number(secondsValue) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  const now = new Date();
  const alarm = new Date(now);
  alarm.setHours(hours, minutes, seconds || 0, 0);
  if (alarm.getTime() <= now.getTime()) alarm.setDate(alarm.getDate() + 1);
  return alarm.getTime();
}

function formatClockTime(date: Date, showSeconds = true, hour12 = true, showAmPm = true) {
  const str = date.toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
    hour12,
  });
  if (hour12 && !showAmPm) return str.replace(/\s*(AM|PM)$/i, '').trim();
  return str;
}

function formatClockDate(date: Date) {
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// resolvedLimit is pre-computed at session start (handles random range); falls back to group.timeLimit.
function hasReachedPlayLimit(group: SoundGroup, sessionElapsedMs: number, resolvedLimit?: number) {
  if (!group.limitEnabled) return false;
  if (group.limitKind === 'time') return sessionElapsedMs >= (resolvedLimit ?? group.timeLimit ?? DEFAULT_TIME_LIMIT);
  return group.plays >= group.limit;
}

function isSupportedAudioFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.mp3') || name.endsWith('.wav') || ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave'].includes(file.type);
}

function combinedVolume(masterVol: number, groupVol: number) {
  // Group slider uses a quadratic taper so low percentages feel genuinely quiet.
  // 10 % group → 1 % of master's amplitude rather than 10 %, matching perceived loudness.
  return (masterVol / 100) * Math.pow(groupVol / 100, 2);
}

const MAIN_AUDIO_FADE_SECONDS = 3;

function App() {
  const updateCheck = useUpdateCheck();
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISSED_UPDATE_KEY); } catch { return null; }
  });
  const [groups, setGroups] = useState<SoundGroup[]>(readStoredGroups);

  // Restore audio blob URLs from IndexedDB on startup.
  // Group metadata survives reload (localStorage) but blob: URLs don't — we rebuild them here.
  useEffect(() => {
    const stored = readStoredGroups();
    const fileIds = stored.flatMap((g) => g.files.filter((f) => !f.demo).map((f) => f.id));
    if (!fileIds.length) return;
    Promise.all(fileIds.map(async (id) => ({ id, data: await loadAudioFile(id) }))).then((results) => {
      const urlMap: Record<string, string> = {};
      for (const { id, data } of results) {
        if (data) urlMap[id] = URL.createObjectURL(new Blob([data.buffer], { type: data.type }));
      }
      if (!Object.keys(urlMap).length) return;
      setGroups((current) =>
        current.map((g) => ({
          ...g,
          files: g.files.map((f) => (urlMap[f.id] ? { ...f, url: urlMap[f.id] } : f)),
        })),
      );
    }).catch(() => { /* IDB unavailable — user will need to re-add files */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore music track blob URLs from IndexedDB on startup.
  useEffect(() => {
    const stored = readStoredPlaylists();
    const trackIds = stored.flatMap((p) => p.tracks.map((t) => t.id));
    if (!trackIds.length) return;
    Promise.all(trackIds.map(async (id) => ({ id, data: await loadAudioFile(`music:${id}`) }))).then((results) => {
      const urlMap: Record<string, string> = {};
      for (const { id, data } of results) {
        if (data) urlMap[id] = URL.createObjectURL(new Blob([data.buffer], { type: data.type }));
      }
      if (!Object.keys(urlMap).length) return;
      setPlaylists((current) =>
        current.map((p) => ({
          ...p,
          tracks: p.tracks.map((t) => (urlMap[t.id] ? { ...t, url: urlMap[t.id] } : t)),
        })),
      );
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore alarm sound blob URL from IndexedDB on startup.
  useEffect(() => {
    const prefs = readStoredPrefs();
    if (!prefs.alarmSoundId) return;
    loadAudioFile(`alarm:${prefs.alarmSoundId}`).then((data) => {
      if (!data) return;
      setAlarmSoundUrl(URL.createObjectURL(new Blob([data.buffer], { type: data.type })));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [page, setPage] = useState<Page>('home');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('night-display');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [mainTrackIds, setMainTrackIds] = useState<string[]>([]);
  const [volume, setVolume] = useState(() => readStoredPrefs().volume);
  const [lastEffect, setLastEffect] = useState('Waiting for a little weather');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [endMode, setEndMode] = useState<EndMode>('none');
  const [timerParts, setTimerParts] = useState<TimerParts>({ hours: 8, minutes: 0, seconds: 0, milliseconds: 0 });
  const [alarmTime, setAlarmTime] = useState('07:00');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [endRemaining, setEndRemaining] = useState(0);
  const [nightTextColor, setNightTextColor] = useState(() => readStoredPrefs().nightTextColor);
  const [nightShowDate, setNightShowDate] = useState(() => readStoredPrefs().nightShowDate);
  const [nightShowSeconds, setNightShowSeconds] = useState(() => readStoredPrefs().nightShowSeconds);
  const [nightHour12, setNightHour12] = useState(() => readStoredPrefs().nightHour12);
  const [nightShowAmPm, setNightShowAmPm] = useState(() => readStoredPrefs().nightShowAmPm);
  const [nightClockFont, setNightClockFont] = useState(() => readStoredPrefs().nightClockFont);
  const [nightShowStopwatch, setNightShowStopwatch] = useState(() => readStoredPrefs().nightShowStopwatch);
  const [nightDimEnabled, setNightDimEnabled] = useState(() => readStoredPrefs().nightDimEnabled);
  const [nightOsDimEnabled, setNightOsDimEnabled] = useState(() => readStoredPrefs().nightOsDimEnabled);
  const [nightOsSleepEnabled, setNightOsSleepEnabled] = useState(() => readStoredPrefs().nightOsSleepEnabled);
  const [nightOsSleepDelaySecs, setNightOsSleepDelaySecs] = useState(() => readStoredPrefs().nightOsSleepDelaySecs);
  const [nightDimDelaySecs, setNightDimDelaySecs] = useState(() => readStoredPrefs().nightDimDelaySecs);
  const [nightDimColor, setNightDimColor] = useState(() => readStoredPrefs().nightDimColor);
  const [nightDimShowClock, setNightDimShowClock] = useState(() => readStoredPrefs().nightDimShowClock);
  const [nightDimShowDate, setNightDimShowDate] = useState(() => readStoredPrefs().nightDimShowDate);
  const [nightDimShowSeconds, setNightDimShowSeconds] = useState(() => readStoredPrefs().nightDimShowSeconds);
  const [nightDimShowAmPm, setNightDimShowAmPm] = useState(() => readStoredPrefs().nightDimShowAmPm);
  const [nightDimBrightness, setNightDimBrightness] = useState(() => readStoredPrefs().nightDimBrightness);
  const [flashlightBrightness, setFlashlightBrightness] = useState(() => readStoredPrefs().flashlightBrightness);
  const [clockDisplayEnabled, setClockDisplayEnabled] = useState(() => readStoredPrefs().clockDisplayEnabled);
  const [clockDisplayDelaySecs, setClockDisplayDelaySecs] = useState(() => readStoredPrefs().clockDisplayDelaySecs);
  const [clockDisplayColor, setClockDisplayColor] = useState(() => readStoredPrefs().clockDisplayColor);
  const [clockDisplayRandomColor, setClockDisplayRandomColor] = useState(() => readStoredPrefs().clockDisplayRandomColor);
  const [clockDisplayCustomColors, setClockDisplayCustomColors] = useState(() => readStoredPrefs().clockDisplayCustomColors);
  const [clockDisplayColorSchedules, setClockDisplayColorSchedules] = useState(() => readStoredPrefs().clockDisplayColorSchedules);
  const [clockDisplayCycleEnabled, setClockDisplayCycleEnabled] = useState(() => readStoredPrefs().clockDisplayCycleEnabled);
  const [clockDisplayCycleColors, setClockDisplayCycleColors] = useState(() => readStoredPrefs().clockDisplayCycleColors);
  const [clockDisplayCycleIndex, setClockDisplayCycleIndex] = useState(0);
  const [clockDisplayFont, setClockDisplayFont] = useState(() => readStoredPrefs().clockDisplayFont);
  const [clockDisplayShowDate, setClockDisplayShowDate] = useState(() => readStoredPrefs().clockDisplayShowDate);
  const [clockDisplayShowSeconds, setClockDisplayShowSeconds] = useState(() => readStoredPrefs().clockDisplayShowSeconds);
  const [clockDisplayHour12, setClockDisplayHour12] = useState(() => readStoredPrefs().clockDisplayHour12);
  const [clockDisplayShowAmPm, setClockDisplayShowAmPm] = useState(() => readStoredPrefs().clockDisplayShowAmPm);
  const [clockDisplayActive, setClockDisplayActive] = useState(false);
  const [savedTimers, setSavedTimers] = useState<TimerParts[]>(() => {
    try { const s = localStorage.getItem(SAVED_TIMERS_KEY); if (s) { const a = JSON.parse(s); if (Array.isArray(a)) return (a as TimerParts[]).slice(0, MAX_SAVED_PRESETS); } } catch { /* */ }
    return [];
  });
  const [savedAlarms, setSavedAlarms] = useState<string[]>(() => {
    try { const s = localStorage.getItem(SAVED_ALARMS_KEY); if (s) { const a = JSON.parse(s); if (Array.isArray(a)) return (a as string[]).filter((x) => typeof x === 'string').slice(0, MAX_SAVED_PRESETS); } } catch { /* */ }
    return [];
  });
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const [alarmSoundId, setAlarmSoundId] = useState<string | null>(() => readStoredPrefs().alarmSoundId);
  const [alarmSoundName, setAlarmSoundName] = useState<string>(() => readStoredPrefs().alarmSoundName);
  const [alarmSoundUrl, setAlarmSoundUrl] = useState<string | null>(null);
  const [alarmOnTimer, setAlarmOnTimer] = useState<boolean>(() => readStoredPrefs().alarmOnTimer);
  const [alarmOnAlarm, setAlarmOnAlarm] = useState<boolean>(() => readStoredPrefs().alarmOnAlarm);
  const [alarmSnoozeMins, setAlarmSnoozeMins] = useState<number>(() => readStoredPrefs().alarmSnoozeMins);
  const [alarmSnoozeSecs, setAlarmSnoozeSecs] = useState<number>(() => readStoredPrefs().alarmSnoozeSecs);
  const [alarmVolume, setAlarmVolume] = useState<number>(() => readStoredPrefs().alarmVolume);
  const [alarmSnoozeResumeAudio, setAlarmSnoozeResumeAudio] = useState<boolean>(() => readStoredPrefs().alarmSnoozeResumeAudio);
  const [alarmPulseOnTimer, setAlarmPulseOnTimer] = useState<boolean>(() => readStoredPrefs().alarmPulseOnTimer);
  const [alarmPulseOnAlarm, setAlarmPulseOnAlarm] = useState<boolean>(() => readStoredPrefs().alarmPulseOnAlarm);
  const [alarmPulseActive, setAlarmPulseActive] = useState(false);
  const [alarmTesting, setAlarmTesting] = useState(false);
  // ── Schedule start ────────────────────────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('off');
  const [scheduleParts, setScheduleParts] = useState<TimerParts>({ hours: 0, minutes: 30, seconds: 0, milliseconds: 0 });
  const [scheduleTime, setScheduleTime] = useState('22:00');
  const [scheduleRepeat, setScheduleRepeat] = useState(false);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [scheduleEndAt, setScheduleEndAt] = useState<number | null>(null);
  const [scheduleRemaining, setScheduleRemaining] = useState(0);
  const [clockNow, setClockNow] = useState(() => new Date());
  const clockDisplayAvailableColors = useMemo(
    () => [...CLOCK_DISPLAY_COLORS, ...clockDisplayCustomColors],
    [clockDisplayCustomColors],
  );
  const randomClockDisplayColor = useMemo(() => {
    if (!clockDisplayAvailableColors.length) return DEFAULT_PREFS.clockDisplayColor;
    const daySeed = clockNow.getFullYear() * 372 + clockNow.getMonth() * 31 + clockNow.getDate();
    return clockDisplayAvailableColors[Math.abs(daySeed) % clockDisplayAvailableColors.length];
  }, [clockDisplayAvailableColors, clockNow]);
  const defaultClockDisplayColor = clockDisplayRandomColor ? randomClockDisplayColor : clockDisplayColor;
  const activeClockColorSchedule = useMemo(
    () => clockDisplayColorSchedules.find((schedule) => schedule.days.includes(clockNow.getDay())) ?? null,
    [clockDisplayColorSchedules, clockNow],
  );
  const scheduledClockDisplayColor = useMemo(
    () => {
      const scheduled = activeClockColorSchedule?.color;
      return scheduled === RANDOM_CLOCK_COLOR ? randomClockDisplayColor : scheduled ?? defaultClockDisplayColor;
    },
    [activeClockColorSchedule, defaultClockDisplayColor, randomClockDisplayColor],
  );
  const activeCycleColors = activeClockColorSchedule?.cycleColors ?? [];
  const effectiveClockDisplayColor = activeClockColorSchedule?.cycleEnabled && activeCycleColors.length
    ? activeCycleColors[clockDisplayCycleIndex % activeCycleColors.length]
    : scheduledClockDisplayColor;
  const [modal, setModal] = useState<'new' | string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupKind, setGroupKind] = useState<GroupKind>('effect');
  const [groupColor, setGroupColor] = useState(COLORS[0]);
  const [groupIcon, setGroupIcon] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // ── Music player ──────────────────────────────────────────────────────────
  const [playlists, setPlaylists] = useState<Playlist[]>(readStoredPlaylists);
  const [musicViewPlaylistId, setMusicViewPlaylistId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [musicStatus, setMusicStatus] = useState<MusicStatus>('idle');
  const [musicVolume, setMusicVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [musicElapsed, setMusicElapsed] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [musicShuffle, setMusicShuffle] = useState(false);
  const [musicRepeat, setMusicRepeat] = useState<MusicRepeat>('none');
  const [musicTimerParts, setMusicTimerParts] = useState<TimerParts>({ hours: 0, minutes: 30, seconds: 0, milliseconds: 0 });
  const [musicTimerEndAt, setMusicTimerEndAt] = useState<number | null>(null);
  const [musicTimerRemaining, setMusicTimerRemaining] = useState(0);
  const [sidebarMusicVisible, setSidebarMusicVisible] = useState(false);

  // Web Audio API refs for gapless main loops (avoids MP3 encoder-gap on HTMLAudioElement.loop).
  const mainAudioCtxRef = useRef<AudioContext | null>(null);
  const mainChannelsRef = useRef<Map<string, MainAudioChannel>>(new Map());
  const pendingMainTrackIdsRef = useRef<Set<string>>(new Set());
  const activeMainTrackIdsRef = useRef<Set<string>>(new Set());
  const mainStopTimersRef = useRef<Record<string, number>>({});
  const mainStopEndsRef = useRef<Record<string, number>>({});
  const pausedMainStopRemainingRef = useRef<Record<string, number>>({});
  const effectAudioRef = useRef<HTMLAudioElement | null>(null);
  const startStopTimersRef = useRef<Record<string, number>>({});
  const startStopPlaybacksRef = useRef<Map<string, StartStopPlayback>>(new Map());
  const startStopGenerationRef = useRef(0);
  const sessionStartStopGroupIdsRef = useRef<Set<string>>(new Set());
  const sessionStartStopImmediateGroupIdsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const groupsRef = useRef(groups);
  const volumeRef = useRef(volume);
  const elapsedMsRef = useRef(0);
  const currentEffectGroupVolumeRef = useRef(100);
  const currentEffectGroupIdRef = useRef<string | null>(null);
  // Per-group independent effect timers (one setTimeout per effect group).
  const groupTimerRefs = useRef<Record<string, number>>({});
  // Time limits resolved once per session so random ranges stay stable while running.
  const resolvedTimeLimitsRef = useRef<Record<string, number>>({});
  // Effect groups selected once at fresh session start; manual re-enables add
  // the group for the rest of that session without rerolling other groups.
  const sessionEffectGroupIdsRef = useRef<Set<string>>(new Set());
  const sessionEffectImmediateGroupIdsRef = useRef<Set<string>>(new Set());
  // A group is held quiet while one or more configured source playbacks run,
  // without cutting off its currently playing clip or Start/Run/Stop sequence.
  const suppressedGroupIdsRef = useRef<Set<string>>(new Set());
  const suppressionSourcesRef = useRef<Map<string, Set<number>>>(new Map());
  const suppressionTokenRef = useRef(0);
  const effectSuppressionReleaseRef = useRef<(() => void) | null>(null);
  // Always-fresh session status ref for stable access inside event handlers / closures.
  const sessionStatusRef = useRef<SessionStatus>('idle');
  // Stable ref to scheduleGroup — filled by the effect scheduler so visibilitychange can re-kick groups.
  const scheduleGroupRef = useRef<(groupId: string) => void>(() => {});
  const scheduleStartStopRef = useRef<(groupId: string, immediate?: boolean) => void>(() => {});
  const alarmSoundUrlRef = useRef<string | null>(null);
  const alarmOnTimerRef = useRef(true);
  const alarmOnAlarmRef = useRef(true);
  const alarmSnoozeMinsRef = useRef(9);
  const alarmSnoozeSecsRef = useRef(0);
  const alarmVolumeRef = useRef(100);
  const alarmSnoozeResumeAudioRef = useRef(true);
  const alarmPulseOnTimerRef = useRef(true);
  const alarmPulseOnAlarmRef = useRef(true);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const preAlarmMainTrackIdsRef = useRef<string[]>([]);
  const alarmingAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmAutoStopTimerRef = useRef<number | null>(null);
  const alarmTestAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmTestTimerRef = useRef<number | null>(null);
  const isSnoozeRef = useRef(false);

  // ── Music player refs (always-fresh values for async audio callbacks) ──────
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);
  const alarmFileInputRef = useRef<HTMLInputElement | null>(null);
  const addingToPlaylistRef = useRef<string | null>(null);
  const musicNextTrackRef = useRef<(fromEnded?: boolean) => void>(() => {});
  const musicPlayTrackRef = useRef<(playlist: Playlist, index: number) => void>(() => {});
  const musicVolumeRef = useRef(DEFAULT_MUSIC_VOLUME);
  const playlistsRef = useRef<Playlist[]>([]);
  const activePlaylistIdRef = useRef<string | null>(null);
  const activeTrackIndexRef = useRef(0);
  const musicRepeatRef = useRef<MusicRepeat>('none');
  const musicShuffleRef = useRef(false);
  const musicStatusRef = useRef<MusicStatus>('idle');
  // Replacing the element invalidates its events; each play/pause intent also
  // invalidates older play() promises without disabling the current element.
  const musicAudioGenerationRef = useRef(0);
  const musicPlayRequestGenerationRef = useRef(0);
  const musicDesiredPlayingRef = useRef(false);
  const musicPreviousRestartedRef = useRef(false);
  // When the auto-stop timer expires we let the current song finish rather than killing it mid-track.
  const musicTimerExpiredRef = useRef(false);
  // Always-fresh ref to startSession so schedule effects can call it without stale closure.
  const startSessionRef = useRef<() => void>(() => {});

  groupsRef.current = groups;
  volumeRef.current = volume;
  activeMainTrackIdsRef.current = new Set(mainTrackIds);
  alarmSoundUrlRef.current = alarmSoundUrl;
  alarmOnTimerRef.current = alarmOnTimer;
  alarmOnAlarmRef.current = alarmOnAlarm;
  alarmSnoozeMinsRef.current = alarmSnoozeMins;
  alarmSnoozeSecsRef.current = alarmSnoozeSecs;
  alarmVolumeRef.current = alarmVolume;
  alarmSnoozeResumeAudioRef.current = alarmSnoozeResumeAudio;
  alarmPulseOnTimerRef.current = alarmPulseOnTimer;
  alarmPulseOnAlarmRef.current = alarmPulseOnAlarm;
  elapsedMsRef.current = elapsed * 1000;
  sessionStatusRef.current = sessionStatus;
  playlistsRef.current = playlists;
  activePlaylistIdRef.current = activePlaylistId;
  activeTrackIndexRef.current = activeTrackIndex;
  musicRepeatRef.current = musicRepeat;
  musicShuffleRef.current = musicShuffle;
  musicVolumeRef.current = musicVolume;
  musicStatusRef.current = musicStatus;

  const stopMusicAudio = (audio = musicAudioRef.current) => {
    if (!audio) return;
    audio.onended = null;
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (musicAudioRef.current === audio) musicAudioRef.current = null;
  };

  const finishMusicPlayback = (clearTimer = false) => {
    musicAudioGenerationRef.current += 1;
    musicPlayRequestGenerationRef.current += 1;
    musicDesiredPlayingRef.current = false;
    musicPreviousRestartedRef.current = false;
    musicStatusRef.current = 'idle';
    musicTimerExpiredRef.current = false;
    stopMusicAudio();
    setMusicStatus('idle');
    setMusicElapsed(0);
    setMusicDuration(0);
    if (clearTimer) {
      setMusicTimerEndAt(null);
      setMusicTimerRemaining(0);
    }
  };

  const closeMainAudioIfIdle = () => {
    if (mainChannelsRef.current.size || pendingMainTrackIdsRef.current.size || activeMainTrackIdsRef.current.size) return;
    const ctx = mainAudioCtxRef.current;
    if (!ctx) return;
    void ctx.close();
    mainAudioCtxRef.current = null;
  };

  const clearMainFadeTimer = (channel: MainAudioChannel) => {
    if (channel.fadeTimer !== undefined) window.clearTimeout(channel.fadeTimer);
    channel.fadeTimer = undefined;
  };

  const currentMainGain = (channel: MainAudioChannel, now: number) => {
    if (channel.fadeStartedAt === undefined || channel.fadeFrom === undefined || channel.fadeTo === undefined || channel.fadeDuration === undefined) {
      return channel.gain.gain.value;
    }
    const progress = Math.min(1, Math.max(0, (now - channel.fadeStartedAt) / channel.fadeDuration));
    return channel.fadeFrom + (channel.fadeTo - channel.fadeFrom) * progress;
  };

  const fadeMainChannel = (trackId: string, target: number, onComplete?: () => void, fromOverride?: number) => {
    const channel = mainChannelsRef.current.get(trackId);
    const ctx = mainAudioCtxRef.current;
    if (!channel || !ctx || ctx.state === 'closed') {
      onComplete?.();
      return;
    }

    clearMainFadeTimer(channel);
    const generation = channel.fadeGeneration + 1;
    channel.fadeGeneration = generation;
    channel.fadingOut = target === 0;
    const now = ctx.currentTime;
    // AudioParam.value may still expose its default value immediately after a
    // scheduled setValueAtTime(0), so new channels must explicitly start at 0.
    const from = fromOverride ?? currentMainGain(channel, now);
    const duration = MAIN_AUDIO_FADE_SECONDS;
    channel.fadeFrom = from;
    channel.fadeTo = target;
    channel.fadeStartedAt = now;
    channel.fadeDuration = duration;
    channel.gain.gain.cancelScheduledValues(now);
    channel.gain.gain.setValueAtTime(from, now);
    channel.gain.gain.linearRampToValueAtTime(target, now + duration);
    channel.fadeTimer = window.setTimeout(() => {
      if (channel.fadeGeneration !== generation || mainChannelsRef.current.get(trackId) !== channel) return;
      channel.fadeTimer = undefined;
      const settledAt = ctx.currentTime;
      channel.gain.gain.cancelScheduledValues(settledAt);
      channel.gain.gain.setValueAtTime(target, settledAt);
      channel.fadeFrom = undefined;
      channel.fadeTo = undefined;
      channel.fadeStartedAt = undefined;
      channel.fadeDuration = undefined;
      channel.fadingOut = false;
      onComplete?.();
    }, duration * 1000);
  };

  const releaseMainTrackAudio = (trackId: string) => {
    const channel = mainChannelsRef.current.get(trackId);
    if (!channel) return;
    clearMainFadeTimer(channel);
    try { channel.source.stop(); } catch { /* already stopped */ }
    mainChannelsRef.current.delete(trackId);
    closeMainAudioIfIdle();
  };

  const stopMainTrackAudio = (trackId: string, immediate = false) => {
    const channel = mainChannelsRef.current.get(trackId);
    if (!channel) return;
    if (immediate) {
      channel.fadeGeneration += 1;
      releaseMainTrackAudio(trackId);
      return;
    }
    if (channel.fadingOut) return;
    fadeMainChannel(trackId, 0, () => {
      if (!activeMainTrackIdsRef.current.has(trackId)) releaseMainTrackAudio(trackId);
    });
  };

  const stopAllMainAudio = (immediate = false) => {
    activeMainTrackIdsRef.current.clear();
    pendingMainTrackIdsRef.current.clear();
    if (immediate) {
      [...mainChannelsRef.current.keys()].forEach((trackId) => stopMainTrackAudio(trackId, true));
      const ctx = mainAudioCtxRef.current;
      if (ctx) {
        void ctx.close();
        mainAudioCtxRef.current = null;
      }
      return;
    }
    [...mainChannelsRef.current.keys()].forEach((trackId) => stopMainTrackAudio(trackId));
    closeMainAudioIfIdle();
  };

  const stopSequenceAudio = (audio?: HTMLAudioElement) => {
    if (!audio) return;
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };

  const clearStartStopSchedule = (groupId: string) => {
    const timer = startStopTimersRef.current[groupId];
    if (timer !== undefined) window.clearTimeout(timer);
    delete startStopTimersRef.current[groupId];
  };

  const stopStartStopPlayback = (groupId: string) => {
    clearStartStopSchedule(groupId);
    const playback = startStopPlaybacksRef.current.get(groupId);
    if (!playback) return;
    if (playback.runStopTimer !== undefined) window.clearTimeout(playback.runStopTimer);
    stopSequenceAudio(playback.startAudio);
    stopSequenceAudio(playback.runAudio);
    stopSequenceAudio(playback.stopAudio);
    playback.releaseSuppressedGroups?.();
    startStopPlaybacksRef.current.delete(groupId);
  };

  const stopAllStartStopPlayback = () => {
    Object.keys(startStopTimersRef.current).forEach(clearStartStopSchedule);
    [...startStopPlaybacksRef.current.keys()].forEach(stopStartStopPlayback);
  };

  const isGroupSuppressed = (groupId: string) => suppressedGroupIdsRef.current.has(groupId);

  const suppressGroupForSession = (groupId: string) => {
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!group || group.kind === 'main') return;
    suppressedGroupIdsRef.current.add(groupId);
    if (group.kind === 'effect') {
      const timer = groupTimerRefs.current[groupId];
      if (timer !== undefined) window.clearTimeout(timer);
      delete groupTimerRefs.current[groupId];
    } else {
      // An active sequence continues through its Stop phase; only future starts
      // are removed here.
      clearStartStopSchedule(groupId);
    }
  };

  const stopOtherGroupsOnPlay = (source: SoundGroup) => {
    if (!source.stopGroupsOnPlay) return () => {};
    const token = ++suppressionTokenRef.current;
    const targetIds = groupsRef.current
      .filter((target) =>
        target.id !== source.id &&
        (target.kind === 'effect' || target.kind === 'startStop') &&
        target.stopWhenOtherGroupsPlay === true,
      )
      .map((target) => target.id);

    targetIds.forEach((targetId) => {
      const sources = suppressionSourcesRef.current.get(targetId) ?? new Set<number>();
      sources.add(token);
      suppressionSourcesRef.current.set(targetId, sources);
      suppressGroupForSession(targetId);
    });

    let released = false;
    return () => {
      if (released) return;
      released = true;
      targetIds.forEach((targetId) => {
        const sources = suppressionSourcesRef.current.get(targetId);
        if (!sources) return;
        sources.delete(token);
        if (sources.size) return;
        suppressionSourcesRef.current.delete(targetId);
        suppressedGroupIdsRef.current.delete(targetId);

        const target = groupsRef.current.find((item) => item.id === targetId);
        if (!target?.enabled || sessionStatusRef.current !== 'running') return;
        if (target.kind === 'effect') {
          if (!sessionEffectGroupIdsRef.current.has(targetId) || !target.files.some((file) => file.role === 'effect') || hasReachedPlayLimit(target, elapsedMsRef.current, resolvedTimeLimitsRef.current[targetId])) return;
          scheduleGroupRef.current(targetId);
        } else if (target.kind === 'startStop' && sessionStartStopGroupIdsRef.current.has(targetId)) {
          scheduleStartStopRef.current(targetId);
        }
      });
    };
  };

  const startStopFilesForGroup = (group: SoundGroup) => ({
    start: group.files.find((file) => file.role === 'start'),
    run: group.files.find((file) => file.role === 'run'),
    stop: group.files.find((file) => file.role === 'stop'),
  });

  const canStartStopGroupPlay = (group: SoundGroup | undefined) => Boolean(
    group && group.enabled && group.kind === 'startStop' && !isGroupSuppressed(group.id) &&
    sessionStartStopGroupIdsRef.current.has(group.id) &&
    startStopFilesForGroup(group).start &&
    startStopFilesForGroup(group).run &&
    startStopFilesForGroup(group).stop,
  );

  const playStartStopSequence = (groupId: string) => {
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!canStartStopGroupPlay(group) || !group) return;
    stopStartStopPlayback(groupId);
    const files = startStopFilesForGroup(group);
    if (!files.start || !files.run || !files.stop) return;
    const startFile = files.start;
    const runFile = files.run;
    const stopFile = files.stop;

    const playback: StartStopPlayback = {
      generation: startStopGenerationRef.current + 1,
      groupId,
      runStarted: false,
      stopping: false,
    };
    startStopGenerationRef.current = playback.generation;
    startStopPlaybacksRef.current.set(groupId, playback);
    const isCurrent = () => startStopPlaybacksRef.current.get(groupId)?.generation === playback.generation && sessionStatusRef.current === 'running';
    const volumeForGroup = () => combinedVolume(volumeRef.current, groupsRef.current.find((item) => item.id === groupId)?.volume ?? 100);
    const scheduleNext = () => {
      if (!isCurrent()) return;
      startStopPlaybacksRef.current.delete(groupId);
      playback.releaseSuppressedGroups?.();
      if (isGroupSuppressed(groupId)) return;
      scheduleStartStopRef.current(groupId);
    };
    const stopRun = () => {
      if (!playback.runAudio) return;
      stopSequenceAudio(playback.runAudio);
      playback.runAudio = undefined;
    };
    const releaseStart = () => {
      if (!playback.startAudio) return;
      stopSequenceAudio(playback.startAudio);
      playback.startAudio = undefined;
    };
    const beginStop = () => {
      if (!isCurrent() || playback.stopping) return;
      playback.stopping = true;
      releaseStart();
      if (playback.runStopTimer !== undefined) window.clearTimeout(playback.runStopTimer);
      playback.runStopTimer = undefined;
      playback.runStopEnd = undefined;
      const stopRunAtProgress = () => {
        const audio = playback.stopAudio;
        const duration = audio?.duration;
        if (!audio || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || audio.currentTime < duration * ((group.stopRunPercent ?? DEFAULT_STOP_RUN_PERCENT) / 100)) return;
        audio.ontimeupdate = null;
        stopRun();
      };
      if (!stopFile.url) {
        stopRun();
        scheduleNext();
        return;
      }
      const audio = new Audio(stopFile.url);
      playback.stopAudio = audio;
      audio.volume = volumeForGroup();
      audio.onloadedmetadata = stopRunAtProgress;
      audio.ontimeupdate = stopRunAtProgress;
      audio.onended = () => {
        stopRun();
        scheduleNext();
      };
      audio.onerror = () => {
        stopRun();
        scheduleNext();
      };
      void audio.play().catch(() => {
        stopRun();
        scheduleNext();
      });
    };
    playback.beginStop = beginStop;
    const scheduleRunStop = (duration: number) => {
      playback.runStopEnd = Date.now() + duration;
      playback.runStopTimer = window.setTimeout(beginStop, duration);
    };
    const beginRun = () => {
      if (!isCurrent() || playback.runStarted) return;
      playback.runStarted = true;
      const minimum = Math.max(1, group.runMinDuration ?? DEFAULT_START_STOP_RUN_MIN_DURATION);
      const maximum = Math.max(minimum, group.runMaxDuration ?? DEFAULT_START_STOP_RUN_MAX_DURATION);
      const runDuration = minimum + Math.random() * (maximum - minimum);
      if (!runFile.url) {
        beginStop();
        return;
      }
      const audio = new Audio(runFile.url);
      playback.runAudio = audio;
      audio.loop = true;
      audio.volume = volumeForGroup();
      audio.onerror = beginStop;
      void audio.play().catch(beginStop);
      scheduleRunStop(runDuration);
      setLastEffect(`${group.name} · running`);
    };

    setLastEffect(`${group.name} · starting`);
    playback.releaseSuppressedGroups = stopOtherGroupsOnPlay(group);
    if (!startFile.url) {
      beginRun();
      return;
    }
    const startAudio = new Audio(startFile.url);
    playback.startAudio = startAudio;
    startAudio.volume = volumeForGroup();
    const beginRunAtProgress = () => {
      const duration = startAudio.duration;
      if (!Number.isFinite(duration) || duration <= 0 || startAudio.currentTime < duration * ((group.startRunPercent ?? DEFAULT_START_RUN_PERCENT) / 100)) return;
      startAudio.ontimeupdate = null;
      beginRun();
    };
    startAudio.onloadedmetadata = beginRunAtProgress;
    startAudio.ontimeupdate = beginRunAtProgress;
    startAudio.onended = () => {
      beginRun();
      releaseStart();
    };
    startAudio.onerror = beginRun;
    void startAudio.play().catch(beginRun);
  };

  const scheduleStartStop = (groupId: string, immediate = false) => {
    if (groupId in startStopTimersRef.current || startStopPlaybacksRef.current.has(groupId)) return;
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!canStartStopGroupPlay(group) || !group) return;
    const delay = immediate ? 0 : group.minInterval + Math.random() * Math.max(0, group.maxInterval - group.minInterval);
    startStopTimersRef.current[groupId] = window.setTimeout(() => {
      delete startStopTimersRef.current[groupId];
      playStartStopSequence(groupId);
    }, delay);
  };

  useEffect(() => {
    scheduleStartStopRef.current = scheduleStartStop;
    if (sessionStatus === 'running') {
      startStopPlaybacksRef.current.forEach((playback) => {
        [playback.startAudio, playback.runAudio, playback.stopAudio].forEach((audio) => void audio?.play().catch(() => {}));
        if (playback.pausedRunStopRemaining && playback.runAudio && !playback.stopping) {
          const remaining = playback.pausedRunStopRemaining;
          playback.pausedRunStopRemaining = undefined;
          playback.runStopEnd = Date.now() + remaining;
          playback.runStopTimer = window.setTimeout(() => {
            const latest = startStopPlaybacksRef.current.get(playback.groupId);
            if (latest?.generation === playback.generation) {
              latest.runStopTimer = undefined;
              if (latest.stopAudio || latest.stopping) return;
              latest.beginStop?.();
            }
          }, remaining);
        }
      });
      groupsRef.current
        .filter((group) => canStartStopGroupPlay(group))
        .forEach((group) => scheduleStartStop(group.id, sessionStartStopImmediateGroupIdsRef.current.delete(group.id)));
      return;
    }

    Object.keys(startStopTimersRef.current).forEach(clearStartStopSchedule);
    startStopPlaybacksRef.current.forEach((playback) => {
      if (playback.runStopTimer !== undefined) {
        window.clearTimeout(playback.runStopTimer);
        playback.runStopTimer = undefined;
        playback.pausedRunStopRemaining = playback.runStopEnd ? Math.max(0, playback.runStopEnd - Date.now()) : undefined;
      }
      [playback.startAudio, playback.runAudio, playback.stopAudio].forEach((audio) => audio?.pause());
    });
    if (sessionStatus === 'idle' || sessionStatus === 'alarming') stopAllStartStopPlayback();
  }, [sessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMainStopTimer = (trackId: string, preserveRemaining = false) => {
    const timer = mainStopTimersRef.current[trackId];
    if (timer !== undefined) window.clearTimeout(timer);
    if (preserveRemaining && mainStopEndsRef.current[trackId]) {
      pausedMainStopRemainingRef.current[trackId] = Math.max(0, mainStopEndsRef.current[trackId] - Date.now());
    }
    delete mainStopTimersRef.current[trackId];
    delete mainStopEndsRef.current[trackId];
  };

  const clearAllMainStopTimers = (preserveRemaining = false) => {
    Object.keys(mainStopTimersRef.current).forEach((trackId) => clearMainStopTimer(trackId, preserveRemaining));
  };

  const scheduleMainStop = (trackId: string, duration: number) => {
    clearMainStopTimer(trackId);
    const deadline = Date.now() + duration;
    mainStopEndsRef.current[trackId] = deadline;
    mainStopTimersRef.current[trackId] = window.setTimeout(() => {
      clearMainStopTimer(trackId);
      stopMainTrackAudio(trackId);
      setMainTrackIds((current) => current.filter((id) => id !== trackId));
      setToast('A main sound faded out for this session.');
    }, duration);
  };

  const resumeMainStopTimers = () => {
    const pausedTimers = { ...pausedMainStopRemainingRef.current };
    pausedMainStopRemainingRef.current = {};
    Object.entries(pausedTimers).forEach(([trackId, remaining]) => {
      if (remaining > 0) scheduleMainStop(trackId, remaining);
    });
  };

  // Each main group owns its own gain node, so its volume stays independent.
  useEffect(() => {
    mainChannelsRef.current.forEach((channel, trackId) => {
      const group = groups.find((item) => item.id === channel.groupId);
      const targetVolume = combinedVolume(volumeRef.current, group?.volume ?? 100);
      if (!channel.fadingOut && channel.fadeStartedAt !== undefined) {
        if (channel.fadeTo !== targetVolume) fadeMainChannel(trackId, targetVolume);
      } else if (!channel.fadingOut) {
        channel.gain.gain.value = targetVolume;
      }
    });
    startStopPlaybacksRef.current.forEach((playback) => {
      const group = groups.find((item) => item.id === playback.groupId);
      const nextVolume = combinedVolume(volumeRef.current, group?.volume ?? 100);
      [playback.startAudio, playback.runAudio, playback.stopAudio].forEach((audio) => {
        if (audio) audio.volume = nextVolume;
      });
    });
  }, [groups, volume]);

  useEffect(() => {
    const tick = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const finishSession = (message?: string) => {
    isSnoozeRef.current = false;
    setAlarmPulseActive(false);
    sessionEffectGroupIdsRef.current.clear();
    sessionStartStopGroupIdsRef.current.clear();
    sessionEffectImmediateGroupIdsRef.current.clear();
    sessionStartStopImmediateGroupIdsRef.current.clear();
    suppressedGroupIdsRef.current.clear();
    suppressionSourcesRef.current.clear();
    stopAllStartStopPlayback();
    clearAllMainStopTimers();
    pausedMainStopRemainingRef.current = {};
    activeMainTrackIdsRef.current.clear();
    setSessionStatus('idle');
    setElapsed(0);
    setMainTrackIds([]);
    setEndAt(null);
    setEndRemaining(0);
    setGroups((current) => current.map((group) => ({ ...group, plays: 0 })));
    if (message) setToast(message);
  };

  // ── Alarming state ────────────────────────────────────────────────────────
  // When a timer or alarm session ends and an alarm file is configured, we
  // enter 'alarming' instead of finishing immediately.  The alarm loops until
  // the user presses Stop or Snooze, or 10 minutes elapse.

  const stopAlarmAudio = () => {
    if (alarmingAudioRef.current) {
      alarmingAudioRef.current.onended = null;
      alarmingAudioRef.current.pause();
      alarmingAudioRef.current = null;
    }
    if (alarmAutoStopTimerRef.current !== null) {
      window.clearTimeout(alarmAutoStopTimerRef.current);
      alarmAutoStopTimerRef.current = null;
    }
  };

  const startAlarming = (shouldPulse: boolean) => {
    if (shouldPulse) setAlarmPulseActive(true);
    // Stop the main audio and all pending effect timers immediately.
    stopAllMainAudio();
    stopAllStartStopPlayback();
    clearAllMainStopTimers();
    pausedMainStopRemainingRef.current = {};
    Object.keys(groupTimerRefs.current).forEach((id) => {
      window.clearTimeout(groupTimerRefs.current[id]);
      delete groupTimerRefs.current[id];
    });
    // Save the active main tracks so snooze can restore them if "resume audio" is on.
    preAlarmMainTrackIdsRef.current = mainTrackIds;
    setMainTrackIds([]);
    // Update the ref immediately so the playLoop guard sees 'alarming' before React flushes.
    sessionStatusRef.current = 'alarming';
    setSessionStatus('alarming');
    setEndAt(null);

    const url = alarmSoundUrlRef.current;
    if (url) {
      const playLoop = () => {
        if (sessionStatusRef.current !== 'alarming') return;
        const a = new Audio(url);
        a.volume = alarmVolumeRef.current / 100;
        a.onended = playLoop;
        alarmingAudioRef.current = a;
        void a.play().catch(() => {});
      };
      playLoop();
    }

    // Auto-stop after 10 minutes of no action.
    alarmAutoStopTimerRef.current = window.setTimeout(() => {
      stopAlarmAudio();
      finishSession();
    }, 10 * 60 * 1000);
  };

  const snoozeAlarm = () => {
    stopAlarmAudio();
    setAlarmPulseActive(false);
    const snoozeDuration = (alarmSnoozeMinsRef.current * 60 + alarmSnoozeSecsRef.current) * 1000;
    // Mark as snoozing so the next expiry always re-alarms — but do NOT
    // touch endMode or timerParts so the user's home-screen settings are preserved.
    isSnoozeRef.current = true;
    // If "resume audio during snooze" is on, restore every main track that was
    // playing before the alarm — the existing useEffect re-starts playback automatically.
    if (alarmSnoozeResumeAudioRef.current && preAlarmMainTrackIdsRef.current.length) {
      setMainTrackIds(preAlarmMainTrackIdsRef.current);
    } else {
      setMainTrackIds([]);
    }
    setEndAt(Date.now() + snoozeDuration);
    setEndRemaining(snoozeDuration);
    setGroups((current) => current.map((group) => ({ ...group, plays: 0 })));
    setSessionStatus('running');
  };

  const activeMainTracks = useMemo(
    () => mainTrackIds.flatMap((trackId) => {
      const group = groups.find((item) => item.kind === 'main' && item.files.some((file) => file.id === trackId));
      const file = group?.files.find((item) => item.id === trackId && item.role === 'main');
      return group && file ? [{ group, file }] : [];
    }),
    [groups, mainTrackIds],
  );
  const activeTrack = activeMainTracks[0]?.file;
  const mainGroups = useMemo(
    () => groups.filter((group) => group.kind === 'main'),
    [groups],
  );
  const effectGroups = useMemo(
    () => groups.filter((group) => group.kind === 'effect'),
    [groups],
  );
  const startStopGroups = useMemo(
    () => groups.filter((group) => group.kind === 'startStop'),
    [groups],
  );
  const allFileCount = groups.reduce((count, group) => count + group.files.length, 0);

  useEffect(() => {
    try {
      const metadata = groups.map((group) => ({
        ...group,
        files: group.files.map(({ url: _url, ...file }) => file),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
    } catch { /* private browsing context */ }
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({
        nightTextColor, nightShowDate, nightShowSeconds, nightHour12, nightShowAmPm, nightClockFont, nightShowStopwatch,
        nightDimEnabled, nightOsDimEnabled, nightOsSleepEnabled, nightOsSleepDelaySecs, nightDimDelaySecs, nightDimColor, nightDimShowClock, nightDimShowDate, nightDimShowSeconds, nightDimShowAmPm, nightDimBrightness, flashlightBrightness,
        clockDisplayEnabled, clockDisplayDelaySecs, clockDisplayColor, clockDisplayRandomColor, clockDisplayCustomColors, clockDisplayColorSchedules, clockDisplayCycleEnabled, clockDisplayCycleColors, clockDisplayFont, clockDisplayShowDate, clockDisplayShowSeconds, clockDisplayHour12, clockDisplayShowAmPm,
        volume, alarmSoundId, alarmSoundName, alarmOnTimer, alarmOnAlarm, alarmSnoozeMins, alarmSnoozeSecs, alarmVolume, alarmSnoozeResumeAudio, alarmPulseOnTimer, alarmPulseOnAlarm,
      }));
    } catch { /* private browsing context */ }
  }, [nightTextColor, nightShowDate, nightShowSeconds, nightHour12, nightShowAmPm, nightClockFont, nightShowStopwatch, nightDimEnabled, nightOsDimEnabled, nightOsSleepEnabled, nightOsSleepDelaySecs, nightDimDelaySecs, nightDimColor, nightDimShowClock, nightDimShowDate, nightDimShowSeconds, nightDimShowAmPm, nightDimBrightness, flashlightBrightness, clockDisplayEnabled, clockDisplayDelaySecs, clockDisplayColor, clockDisplayRandomColor, clockDisplayCustomColors, clockDisplayColorSchedules, clockDisplayCycleEnabled, clockDisplayCycleColors, clockDisplayFont, clockDisplayShowDate, clockDisplayShowSeconds, clockDisplayHour12, clockDisplayShowAmPm, volume, alarmSoundId, alarmSoundName, alarmOnTimer, alarmOnAlarm, alarmSnoozeMins, alarmSnoozeSecs, alarmVolume, alarmSnoozeResumeAudio, alarmPulseOnTimer, alarmPulseOnAlarm]);

  const updateFlashlightBrightness = (value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setFlashlightBrightness(next);
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}');
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...saved, flashlightBrightness: next }));
    } catch { /* private browsing context */ }
  };
  useEffect(() => { try { localStorage.setItem(SAVED_TIMERS_KEY, JSON.stringify(savedTimers)); } catch { /* */ } }, [savedTimers]);
  useEffect(() => { try { localStorage.setItem(SAVED_ALARMS_KEY, JSON.stringify(savedAlarms)); } catch { /* */ } }, [savedAlarms]);

  useEffect(() => {
    setClockDisplayCycleIndex(0);
    if (!clockDisplayActive || !activeClockColorSchedule?.cycleEnabled || activeCycleColors.length < 2) return;
    const cycle = window.setInterval(() => {
      setClockDisplayCycleIndex((current) => (current + 1) % activeCycleColors.length);
    }, 30_000);
    return () => window.clearInterval(cycle);
  }, [activeClockColorSchedule, activeCycleColors, clockDisplayActive]);

  // ── Clock display: idle detection ───────────────────────────────────────────
  useEffect(() => {
    // Only engage automatically on the home page with no active session.
    // Manual activation from the Home card remains available when disabled.
    if (page !== 'home' || sessionStatus !== 'idle') {
      setClockDisplayActive(false);
      return;
    }
    // Overlay is already up — clicks handled by the overlay itself
    if (clockDisplayActive) return;
    if (!clockDisplayEnabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const activate = () => setClockDisplayActive(true);
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(activate, clockDisplayDelaySecs * 1000);
    };
    resetTimer();
    document.addEventListener('mousemove', resetTimer, { passive: true });
    document.addEventListener('mousedown', resetTimer, { passive: true });
    document.addEventListener('keydown', resetTimer as EventListener, { passive: true });
    document.addEventListener('touchstart', resetTimer, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('mousemove', resetTimer);
      document.removeEventListener('mousedown', resetTimer);
      document.removeEventListener('keydown', resetTimer as EventListener);
      document.removeEventListener('touchstart', resetTimer);
    };
  }, [clockDisplayEnabled, clockDisplayDelaySecs, page, sessionStatus, clockDisplayActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const tick = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(tick);
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'running' || !endAt) return;
    const checkEnd = () => {
      const remaining = Math.max(0, endAt - Date.now());
      setEndRemaining(remaining);
      if (remaining <= 0) {
        const isAlarmEnd = endMode === 'alarm';
        const hasAlarmFile = Boolean(alarmSoundUrlRef.current);
        // Snooze expiry always re-alarms (user explicitly asked to be woken again).
        const shouldAlarm = hasAlarmFile && (isSnoozeRef.current || (isAlarmEnd ? alarmOnAlarmRef.current : alarmOnTimerRef.current));
        if (shouldAlarm) {
          startAlarming(isSnoozeRef.current ? false : (isAlarmEnd ? alarmPulseOnAlarmRef.current : alarmPulseOnTimerRef.current));
        } else {
          finishSession(isAlarmEnd ? 'Your alarm went off. The session has ended.' : 'Your timer is finished. The session has ended.');
        }
      }
    };
    checkEnd();
    const tick = window.setInterval(checkEnd, 250);
    return () => window.clearInterval(tick);
  }, [endAt, endMode, sessionStatus]);

  // Main looping audio — every enabled main group gets its own sample-accurate
  // BufferSourceNode, all sharing one context. This keeps loops gapless while
  // allowing a rain, ocean, fan, etc. to play together.
  useEffect(() => {
    const desiredIds = new Set(activeMainTracks.map(({ file }) => file.id));
    mainChannelsRef.current.forEach((_channel, trackId) => {
      if (!desiredIds.has(trackId)) stopMainTrackAudio(trackId);
    });

    if (!activeMainTracks.length) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ctx = mainAudioCtxRef.current ?? new (window.AudioContext ?? (window as any).webkitAudioContext)() as AudioContext;
    mainAudioCtxRef.current = ctx;

    activeMainTracks.forEach(({ group, file }) => {
      const existing = mainChannelsRef.current.get(file.id);
      if (existing) {
        const targetVolume = combinedVolume(volumeRef.current, group.volume ?? 100);
        if (existing.fadingOut) {
          fadeMainChannel(file.id, targetVolume);
        } else if (existing.fadeStartedAt === undefined) {
          existing.gain.gain.value = targetVolume;
        }
        return;
      }
      if (!file.url || pendingMainTrackIdsRef.current.has(file.id)) return;

      pendingMainTrackIdsRef.current.add(file.id);
      const requestedCtx = ctx;
      fetch(file.url)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => requestedCtx.decodeAudioData(arrayBuffer))
        .then((decoded) => {
          if (!activeMainTrackIdsRef.current.has(file.id) || mainAudioCtxRef.current !== requestedCtx) return;
          const gain = requestedCtx.createGain();
          const targetVolume = combinedVolume(volumeRef.current, group.volume ?? 100);
          gain.gain.setValueAtTime(0, requestedCtx.currentTime);
          gain.connect(requestedCtx.destination);
          const source = requestedCtx.createBufferSource();
          source.buffer = decoded;
          source.loop = true;
          source.connect(gain);
          mainChannelsRef.current.set(file.id, { source, gain, groupId: group.id, fadeGeneration: 0 });
          source.start();
          fadeMainChannel(file.id, targetVolume, undefined, 0);
          if (sessionStatusRef.current === 'running') void requestedCtx.resume();
          else void requestedCtx.suspend();
        })
        .catch(() => { /* an unavailable local file simply remains silent */ })
        .finally(() => {
          pendingMainTrackIdsRef.current.delete(file.id);
          closeMainAudioIfIdle();
        });
    });

    if (sessionStatus === 'paused') void ctx.suspend();
    else void ctx.resume();
  }, [activeMainTracks, sessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopAllMainAudio(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only a true pause suspends the context. Idle/alarming states keep it running
  // long enough for the three-second Main-group fade-out to finish and close it.
  useEffect(() => {
    const ctx = mainAudioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    if (sessionStatus === 'paused') void ctx.suspend();
    else void ctx.resume();
  }, [sessionStatus]);

  // Update volumes when master slider changes.
  useEffect(() => {
    if (effectAudioRef.current) effectAudioRef.current.volume = combinedVolume(volume, currentEffectGroupVolumeRef.current);
  }, [volume]);

  // Live-sync effect group volume when user changes it mid-session (e.g. via the night panel).
  useEffect(() => {
    if (!currentEffectGroupIdRef.current || !effectAudioRef.current) return;
    const g = groups.find((group) => group.id === currentEffectGroupIdRef.current);
    if (g) {
      currentEffectGroupVolumeRef.current = g.volume ?? 100;
      effectAudioRef.current.volume = combinedVolume(volumeRef.current, currentEffectGroupVolumeRef.current);
    }
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect audio helpers ────────────────────────────────────────────────
  // Play a specific group's effect on the shared effect audio channel.
  // onFinished is called exactly once regardless of how the audio completes.
  const playGroupEffect = (group: SoundGroup, onFinished: () => void) => {
    if (isGroupSuppressed(group.id)) { onFinished(); return; }
    const files = group.files.filter((f) => f.role === 'effect');
    if (!files.length) { onFinished(); return; }
    const file = files[Math.floor(Math.random() * files.length)];

    // Never cut an in-flight effect off just because another group becomes
    // ready. This also lets a group that is being silenced finish gracefully.
    if (effectAudioRef.current && !effectAudioRef.current.ended) { onFinished(); return; }
    if (effectAudioRef.current?.ended) effectAudioRef.current = null;
    if (!file.url) { onFinished(); return; }

    const releaseSuppressedGroups = stopOtherGroupsOnPlay(group);
    effectSuppressionReleaseRef.current = releaseSuppressedGroups;
    setLastEffect(`${group.name} · ${file.name.replace(/\.[^.]+$/, '')}`);
    currentEffectGroupVolumeRef.current = group.volume ?? 100;
    currentEffectGroupIdRef.current = group.id;

    let called = false;

    // success = true  → audio played all the way through; count it towards the play budget.
    // success = false → audio errored or was rejected; reschedule without burning the budget.
    const done = (success: boolean) => {
      if (called) return;
      called = true;
      releaseSuppressedGroups();
      if (effectSuppressionReleaseRef.current === releaseSuppressedGroups) effectSuppressionReleaseRef.current = null;
      // Clear the refs so subsequent busy-checks don't see a stale ended/failed element.
      if (effectAudioRef.current === audio) effectAudioRef.current = null;
      if (currentEffectGroupIdRef.current === group.id) currentEffectGroupIdRef.current = null;
      if (success) {
        setGroups((current) => current.map((item) => item.id === group.id ? { ...item, plays: item.plays + 1 } : item));
      }
      onFinished();
    };

    const audio = new Audio(file.url);
    audio.volume = combinedVolume(volumeRef.current, currentEffectGroupVolumeRef.current);
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    effectAudioRef.current = audio;
    void audio.play().catch(() => done(false));
  };

  // Manual trigger — picks a random available group.
  const triggerEffect = (onFinished: () => void) => {
    const available = groupsRef.current.filter(
      (group) => group.enabled && group.kind === 'effect' && !isGroupSuppressed(group.id) && sessionEffectGroupIdsRef.current.has(group.id) && !hasReachedPlayLimit(group, elapsedMsRef.current, resolvedTimeLimitsRef.current[group.id]) && group.files.some((f) => f.role === 'effect'),
    );
    if (!available.length) { onFinished(); return; }
    const group = available[Math.floor(Math.random() * available.length)];
    playGroupEffect(group, onFinished);
  };

  // Per-group independent effect scheduler.
  // Each group has its own countdown, so a 10-20s group always fires in 10-20s
  // regardless of other groups with longer intervals.
  useEffect(() => {
    if (sessionStatus !== 'running') {
      Object.values(groupTimerRefs.current).forEach((id) => window.clearTimeout(id));
      groupTimerRefs.current = {};
      if (effectAudioRef.current) {
        effectAudioRef.current.onended = null;
        effectAudioRef.current.pause();
        effectAudioRef.current = null;
      }
      return;
    }

    const scheduleGroup = (groupId: string, immediate = false) => {
      // Guard: if this group already has a pending timer, don't double-schedule.
      if (groupId in groupTimerRefs.current) return;
      const g = groupsRef.current.find((group) => group.id === groupId);
      if (!g || !g.enabled || isGroupSuppressed(g.id) || !sessionEffectGroupIdsRef.current.has(g.id) || !g.files.some((f) => f.role === 'effect')) return;
      if (hasReachedPlayLimit(g, elapsedMsRef.current, resolvedTimeLimitsRef.current[g.id])) return;

      const delay = immediate ? 0 : g.minInterval + Math.random() * Math.max(0, g.maxInterval - g.minInterval);
      groupTimerRefs.current[groupId] = window.setTimeout(() => {
        delete groupTimerRefs.current[groupId];
        const current = groupsRef.current.find((group) => group.id === groupId);
        if (!current || !current.enabled || isGroupSuppressed(current.id) || !sessionEffectGroupIdsRef.current.has(current.id) || hasReachedPlayLimit(current, elapsedMsRef.current, resolvedTimeLimitsRef.current[current.id])) return;

        // If another effect is actively playing, wait briefly and retry rather than interrupting.
        const busy = effectAudioRef.current && !effectAudioRef.current.ended && !effectAudioRef.current.paused;
        if (busy) {
          groupTimerRefs.current[groupId] = window.setTimeout(() => {
            delete groupTimerRefs.current[groupId];
            scheduleGroup(groupId); // Re-enter with a fresh interval for this group.
          }, 1000 + Math.random() * 2000);
          return;
        }

        playGroupEffect(current, () => scheduleGroup(groupId));
      }, delay);
    };

    // Expose a stable ref so the visibility-change recovery handler can re-kick groups.
    scheduleGroupRef.current = scheduleGroup;

    // Kick off a timer for every currently-eligible effect group.
    groupsRef.current
      .filter((g) => g.enabled && g.kind === 'effect' && !isGroupSuppressed(g.id) && sessionEffectGroupIdsRef.current.has(g.id) && !hasReachedPlayLimit(g, elapsedMsRef.current, resolvedTimeLimitsRef.current[g.id]) && g.files.some((f) => f.role === 'effect'))
      .forEach((g) => scheduleGroup(g.id, sessionEffectImmediateGroupIdsRef.current.delete(g.id)));

    return () => {
      Object.values(groupTimerRefs.current).forEach((id) => window.clearTimeout(id));
      groupTimerRefs.current = {};
    };
  }, [sessionStatus]);

  // ── Audio recovery: resume audio suspended by browser background-tab policy ─
  // Browsers (Chrome especially) can silently pause HTMLAudioElement objects when
  // a tab is backgrounded for ~1 hour. This handler fires when the tab comes back
  // into focus and restores everything that should still be playing.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (sessionStatusRef.current !== 'running') return;

      // Restore main looping audio if the browser suspended the AudioContext.
      if (mainAudioCtxRef.current?.state === 'suspended') {
        void mainAudioCtxRef.current.resume();
      }

      // Restore an effect that was mid-play when the browser suspended it.
      if (effectAudioRef.current && effectAudioRef.current.paused && !effectAudioRef.current.ended) {
        void effectAudioRef.current.play().catch(() => {});
      }

      // Re-kick any eligible effect groups that lost their scheduled timer while the
      // tab was backgrounded (e.g. Chrome timer throttle cleared the setTimeout).
      groupsRef.current
        .filter((g) =>
          g.enabled && g.kind === 'effect' &&
            !isGroupSuppressed(g.id) && sessionEffectGroupIdsRef.current.has(g.id) &&
          g.files.some((f) => f.role === 'effect') &&
          !hasReachedPlayLimit(g, elapsedMsRef.current, resolvedTimeLimitsRef.current[g.id]) &&
          !(g.id in groupTimerRefs.current),
        )
        .forEach((g) => scheduleGroupRef.current(g.id));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── Periodic health heartbeat (every 60 s while running) ─────────────────
  // Belt-and-suspenders: catches any group whose timer silently died (e.g. due
  // to timer throttling) even in tabs that never fully go background.
  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const tick = window.setInterval(() => {
      // Revive main audio if the AudioContext was unexpectedly suspended.
      if (mainAudioCtxRef.current?.state === 'suspended') {
        void mainAudioCtxRef.current.resume();
      }
      // Re-kick any orphaned effect groups.
      groupsRef.current
        .filter((g) =>
          g.enabled && g.kind === 'effect' &&
            !isGroupSuppressed(g.id) && sessionEffectGroupIdsRef.current.has(g.id) &&
          g.files.some((f) => f.role === 'effect') &&
          !hasReachedPlayLimit(g, elapsedMsRef.current, resolvedTimeLimitsRef.current[g.id]) &&
          !(g.id in groupTimerRefs.current),
        )
        .forEach((g) => scheduleGroupRef.current(g.id));
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [sessionStatus]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // ── Music player effects ──────────────────────────────────────────────────
  // Persist playlists (metadata only — URLs are transient blob: references).
  useEffect(() => {
    try {
      const metadata = playlists.map((pl) => ({ ...pl, tracks: pl.tracks.map(({ url: _url, ...t }) => t) }));
      localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(metadata));
    } catch { /* private browsing */ }
  }, [playlists]);

  // Keep audio volume in sync when slider changes.
  useEffect(() => {
    if (musicAudioRef.current) musicAudioRef.current.volume = musicVolume / 100;
  }, [musicVolume]);

  // Keep audio.loop in sync with repeat mode.
  useEffect(() => {
    if (musicAudioRef.current) musicAudioRef.current.loop = musicRepeat === 'one' && !musicTimerExpiredRef.current;
  }, [musicRepeat]);

  // Tick musicElapsed while playing.
  useEffect(() => {
    if (musicStatus !== 'playing') return;
    const tick = window.setInterval(() => {
      if (musicAudioRef.current) setMusicElapsed(musicAudioRef.current.currentTime);
    }, 250);
    return () => window.clearInterval(tick);
  }, [musicStatus]);

  // Music auto-stop timer countdown — when time is up, flag it and let the current track finish naturally.
  useEffect(() => {
    if (!musicTimerEndAt) return;
    const check = () => {
      const remaining = Math.max(0, musicTimerEndAt - Date.now());
      setMusicTimerRemaining(remaining);
      if (remaining <= 0) {
        const audio = musicAudioRef.current;
        musicTimerExpiredRef.current = !!audio;
        if (audio) {
          // A looping track has no natural ending. Let its current pass finish
          // so the existing end handler can stop playback without cutting it.
          audio.loop = false;
        }
        setMusicTimerEndAt(null);
        setMusicTimerRemaining(0);
        setToast(audio ? 'Music will stop after this track.' : 'Music timer finished.');
      }
    };
    check();
    const tick = window.setInterval(check, 250);
    return () => window.clearInterval(tick);
  }, [musicTimerEndAt, musicStatus]);

  // Set musicNextTrackRef once — reads all mutable state through refs so it never goes stale.
  useEffect(() => {
    musicNextTrackRef.current = (fromEnded = false) => {
      // If the auto-stop timer expired, finish this track cleanly and stop.
      if (musicTimerExpiredRef.current) {
        finishMusicPlayback();
        return;
      }
      const playlist = playlistsRef.current.find((p) => p.id === activePlaylistIdRef.current);
      if (!playlist || !playlist.tracks.length) return;
      const total = playlist.tracks.length;
      if (musicRepeatRef.current === 'one' && fromEnded) return; // audio.loop handles automatic repeats
      let nextIndex: number;
      const cur = activeTrackIndexRef.current;
      if (musicShuffleRef.current) {
        nextIndex = total === 1 ? 0 : (() => { let n; do { n = Math.floor(Math.random() * total); } while (n === cur); return n; })();
      } else {
        nextIndex = cur + 1;
        if (nextIndex >= total) {
          if (musicRepeatRef.current === 'all') { nextIndex = 0; }
          else {
            finishMusicPlayback();
            return;
          }
        }
      }
      musicPlayTrackRef.current(playlist, nextIndex);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The player uses an imperatively-created element, so ensure it cannot outlive
  // the app if the component is unmounted.
  useEffect(() => () => {
    musicAudioGenerationRef.current += 1;
    musicPlayRequestGenerationRef.current += 1;
    musicDesiredPlayingRef.current = false;
    stopMusicAudio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show sidebar music mini-player while playing; hide 5 min after pausing or going idle.
  useEffect(() => {
    if (musicStatus === 'playing') { setSidebarMusicVisible(true); return; }
    const timer = window.setTimeout(() => setSidebarMusicVisible(false), 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [musicStatus]);

  // Preload all clock fonts from Google Fonts so switching is instant.
  useEffect(() => {
    CLOCK_FONTS.forEach((f) => {
      const id = `gf-${f.value.replace(/\s/g, '-')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, []);

  // Schedule countdown.
  useEffect(() => {
    if (!scheduleActive || scheduleMode !== 'countdown' || !scheduleEndAt) return;
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, scheduleEndAt - Date.now());
      setScheduleRemaining(remaining);
      if (remaining <= 0) {
        setScheduleActive(false); setScheduleEndAt(null); setScheduleRemaining(0);
        startSessionRef.current();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [scheduleActive, scheduleMode, scheduleEndAt]);

  // Schedule time-watch.
  useEffect(() => {
    if (!scheduleActive || scheduleMode !== 'time') return;
    const check = () => {
      const now = new Date();
      const [h, m] = scheduleTime.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return;
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() < 10) {
        if (!scheduleRepeat) setScheduleActive(false);
        startSessionRef.current();
      }
    };
    check();
    const tick = window.setInterval(check, 5000);
    return () => window.clearInterval(tick);
  }, [scheduleActive, scheduleMode, scheduleTime, scheduleRepeat]);

  // Auto-cancel schedule when session becomes active.
  useEffect(() => {
    if (sessionStatus === 'running') {
      setScheduleActive(false); setScheduleEndAt(null); setScheduleRemaining(0);
    }
  }, [sessionStatus]);

  const chooseMainSounds = () => {
    const eligibleGroups = mainGroups
      .filter((group) => group.enabled && group.files.some((file) => file.role === 'main'))
      .filter((group) => !group.sessionChanceEnabled || Math.random() * 100 < (group.sessionChance ?? 100));
    return eligibleGroups.map((group) => {
      const files = group.files.filter((file) => file.role === 'main');
      return { group, file: files[Math.floor(Math.random() * files.length)] };
    });
  };

  const chooseEffectGroups = () => new Set(
    groupsRef.current
      .filter((group) => group.enabled && group.kind === 'effect' && group.files.some((file) => file.role === 'effect'))
      .filter((group) => !group.sessionChanceEnabled || Math.random() * 100 < (group.sessionChance ?? 100))
      .map((group) => group.id),
  );

  const chooseStartStopGroups = () => new Set(
    groupsRef.current
      .filter((group) => group.enabled && group.kind === 'startStop')
      .filter((group) => {
        const files = startStopFilesForGroup(group);
        return Boolean(files.start && files.run && files.stop);
      })
      .filter((group) => !group.sessionChanceEnabled || Math.random() * 100 < (group.sessionChance ?? 100))
      .map((group) => group.id),
  );

  const chooseImmediateSessionStarts = (groupIds: Set<string>) => new Set(
    [...groupIds].filter((groupId) => {
      const group = groupsRef.current.find((item) => item.id === groupId);
      return Boolean(group?.playOnSessionStart && Math.random() * 100 < (group.playOnSessionStartChance ?? 100));
    }),
  );

  const startSession = () => {
    if (sessionStatus === 'paused') {
      if (endRemaining > 0) setEndAt(Date.now() + endRemaining);
      resumeMainStopTimers();
      setSessionStatus('running');
      return;
    }
    // Stop any music on a fresh session start.
    finishMusicPlayback(true);
    suppressedGroupIdsRef.current.clear();
    suppressionSourcesRef.current.clear();
    const selectedMains = chooseMainSounds(); // An effects-only or clock-only session is allowed.
    sessionEffectGroupIdsRef.current = chooseEffectGroups();
    sessionStartStopGroupIdsRef.current = chooseStartStopGroups();
    sessionEffectImmediateGroupIdsRef.current = chooseImmediateSessionStarts(sessionEffectGroupIdsRef.current);
    sessionStartStopImmediateGroupIdsRef.current = chooseImmediateSessionStarts(sessionStartStopGroupIdsRef.current);
    let deadline: number | null = null;
    if (endMode === 'timer') {
      const duration = timerPartsToMilliseconds(timerParts);
      if (duration < 1) { setToast('Set a timer longer than zero before starting.'); return; }
      deadline = Date.now() + duration;
    } else if (endMode === 'alarm') {
      deadline = getAlarmDeadline(alarmTime);
      if (!deadline) { setToast('Choose an alarm time before starting.'); return; }
    }
    clearAllMainStopTimers();
    pausedMainStopRemainingRef.current = {};
    setMainTrackIds(selectedMains.map(({ file }) => file.id));
    selectedMains.forEach(({ group, file }) => {
      if (!group.autoStopEnabled) return;
      const minimum = Math.max(1, group.minDuration ?? DEFAULT_MAIN_MIN_DURATION);
      const maximum = Math.max(minimum, group.maxDuration ?? DEFAULT_MAIN_MAX_DURATION);
      const duration = group.autoStopMode === 'fixed' ? minimum : minimum + Math.random() * (maximum - minimum);
      scheduleMainStop(file.id, duration);
    });
    setEndAt(deadline);
    setEndRemaining(deadline ? Math.max(0, deadline - Date.now()) : 0);

    // Resolve random time limits once at session start so the drawn value is stable.
    const resolved: Record<string, number> = {};
    groupsRef.current.forEach((g) => {
      if (g.limitEnabled && g.limitKind === 'time') {
        const minMs = g.timeLimit ?? DEFAULT_TIME_LIMIT;
        const maxMs = (g.timeLimitMode ?? 'fixed') === 'random'
          ? Math.max(minMs + 1, g.timeLimitMax ?? DEFAULT_TIME_LIMIT_MAX)
          : minMs;
        resolved[g.id] = minMs + Math.random() * (maxMs - minMs);
      }
    });
    resolvedTimeLimitsRef.current = resolved;

    setSessionStatus('running');
    setToast('The room is ready. Good night.');
  };

  const stopSession = () => {
    stopAlarmAudio();
    finishSession();
  };

  const pauseSession = () => {
    if (sessionStatus === 'running') {
      if (endAt) { setEndRemaining(Math.max(0, endAt - Date.now())); setEndAt(null); }
      clearAllMainStopTimers(true);
      setSessionStatus('paused');
      return;
    }
    if (sessionStatus === 'paused') {
      if (endRemaining > 0) setEndAt(Date.now() + endRemaining);
      setSessionStatus('running');
    }
  };

  const updateTimerPart = (unit: keyof TimerParts, value: number) => {
    const limits: TimerParts = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setTimerParts((current) => ({ ...current, [unit]: Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0)) }));
  };

  const updateMainSessionSetting = (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => {
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      if (key === 'sessionChanceEnabled' || key === 'autoStopEnabled' || key === 'playOnSessionStart' || key === 'stopGroupsOnPlay' || key === 'stopWhenOtherGroupsPlay') return { ...group, [key]: Boolean(value) };
      if (key === 'sessionChance' || key === 'playOnSessionStartChance') return { ...group, [key]: Math.min(100, Math.max(0, Number(value) || 0)) };
      return { ...group, [key]: Math.max(1, Number(value) || 1) };
    }));
  };

  const updateMainStopMode = (groupId: string, mode: TimeLimitMode) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, autoStopMode: mode } : group));
  };

  const updateMainDuration = (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => {
    const limits: Record<DurationUnit, number> = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const parts = getDurationParts(group[key] ?? (key === 'minDuration' ? DEFAULT_MAIN_MIN_DURATION : DEFAULT_MAIN_MAX_DURATION));
      parts[unit] = Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0));
      return { ...group, [key]: Math.max(1, timerPartsToMilliseconds(parts)) };
    }));
  };

  const openNewGroup = (kind?: GroupKind) => {
    setGroupName(''); setGroupKind(kind ?? 'effect'); setGroupColor(COLORS[groups.length % COLORS.length]); setGroupIcon(null); setIconPickerOpen(false); setModal('new');
  };

  const openEditGroup = (group: SoundGroup) => {
    setGroupName(group.name); setGroupKind(group.kind); setGroupColor(group.color); setGroupIcon(iconKeyForGroup(group.name, group.icon)); setIconPickerOpen(false); setModal(group.id);
  };

  const saveGroup = () => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    if (modal === 'new') {
      const group: SoundGroup = {
        id: `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        name: trimmed, kind: groupKind, color: groupColor, icon: groupIcon ?? undefined, enabled: true, volume: 100,
        minInterval: 8 * MINUTE_MS, maxInterval: 15 * MINUTE_MS,
        limitEnabled: false, limitKind: 'count', limit: 5, timeLimit: DEFAULT_TIME_LIMIT, plays: 0,
        sessionChanceEnabled: false, sessionChance: 100, playOnSessionStart: false, playOnSessionStartChance: 100,
        stopGroupsOnPlay: false, stopWhenOtherGroupsPlay: false, autoStopEnabled: false, autoStopMode: 'random',
        minDuration: DEFAULT_MAIN_MIN_DURATION, maxDuration: DEFAULT_MAIN_MAX_DURATION,
        runMinDuration: DEFAULT_START_STOP_RUN_MIN_DURATION, runMaxDuration: DEFAULT_START_STOP_RUN_MAX_DURATION,
        startRunPercent: DEFAULT_START_RUN_PERCENT, stopRunPercent: DEFAULT_STOP_RUN_PERCENT, files: [],
      };
      setGroups((current) => [...current, group]);
      setSelectedGroup(group.id);
      setToast(`${trimmed} is ready for sound.`);
    } else {
      const previous = groups.find((group) => group.id === modal);
      const kindChanged = previous?.kind !== groupKind;
      setGroups((current) => current.map((group) => group.id === modal ? {
        ...group,
        name: trimmed,
        kind: groupKind,
        color: groupColor,
        icon: groupIcon ?? undefined,
        // A group's playback mode and file assignments must always agree.
        files: kindChanged ? rolesForGroupKind(group.files, groupKind) : group.files,
      } : group));
      if (kindChanged && previous) {
        const previousTrackIds = previous.files.map((file) => file.id);
        if (previous.kind === 'main') {
          previousTrackIds.forEach((trackId) => stopMainTrackAudio(trackId));
          previousTrackIds.forEach((trackId) => clearMainStopTimer(trackId));
          setMainTrackIds((current) => current.filter((trackId) => !previousTrackIds.includes(trackId)));
        } else if (previous.kind === 'startStop') {
          stopStartStopPlayback(previous.id);
        } else if (currentEffectGroupIdRef.current === previous.id && effectAudioRef.current) {
          effectAudioRef.current.onended = null;
          effectAudioRef.current.onerror = null;
          effectAudioRef.current.pause();
          effectAudioRef.current = null;
          currentEffectGroupIdRef.current = null;
        }
        if (sessionStatusRef.current === 'running') {
          window.setTimeout(() => kickGroupImmediate(previous.id), 80);
        }
      }
      setToast('Group details saved.');
    }
    setModal(null);
  };

  const deleteGroup = (group: SoundGroup) => {
    if (!window.confirm(`Remove ${group.name} and all of its files?`)) return;
    stopStartStopPlayback(group.id);
    sessionStartStopGroupIdsRef.current.delete(group.id);
    setGroups((current) => current.filter((item) => item.id !== group.id));
    if (selectedGroup === group.id) setSelectedGroup(null);
    setToast(`${group.name} was removed.`);
  };

  const chooseGroup = (groupId: string) => {
    setSelectedGroup(groupId); setPage('library'); setMobileNavOpen(false);
  };

  const openFilePicker = (groupId?: string) => {
    if (groupId) setSelectedGroup(groupId);
    if (!groupId && !selectedGroup) { const fallback = groups[0]?.id; if (fallback) setSelectedGroup(fallback); }
    fileInputRef.current?.click();
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const groupId = selectedGroup ?? groups[0]?.id;
    if (!groupId || !files.length) return;
    const supportedFiles = files.filter(isSupportedAudioFile);
    const skippedCount = files.length - supportedFiles.length;
    if (!supportedFiles.length) {
      setToast('Choose MP3 or WAV files to add to your library.');
      event.target.value = '';
      return;
    }
    const additions: Array<{ file: File; soundFile: SoundFile }> = supportedFiles.map((file, index) => ({
      file,
      soundFile: {
        id: `${file.name}-${file.lastModified}-${Date.now()}-${index}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        name: file.name, size: file.size, role: groups.find((g) => g.id === groupId)?.kind ?? 'effect',
        url: URL.createObjectURL(file),
      },
    }));
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const assignedRoles = new Set(group.files.map((file) => file.role));
      const startStopRoles: SoundRole[] = ['start', 'run', 'stop'];
      const newFiles = additions.map(({ soundFile }) => {
        const role = group.kind === 'startStop'
          ? startStopRoles.find((candidate) => !assignedRoles.has(candidate)) ?? 'unassigned'
          : group.kind;
        assignedRoles.add(role);
        return { ...soundFile, role };
      });
      return { ...group, files: [...group.files, ...newFiles] };
    }));
    // Persist raw audio data to IndexedDB so files survive page reloads.
    additions.forEach(({ file, soundFile }) => void storeAudioFile(soundFile.id, file));
    setToast(`${supportedFiles.length} ${supportedFiles.length === 1 ? 'sound' : 'sounds'} added locally.${skippedCount ? ` ${skippedCount} unsupported file${skippedCount === 1 ? '' : 's'} skipped.` : ''}`);
    event.target.value = '';
  };

  const removeFile = (groupId: string, fileId: string) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, files: group.files.filter((file) => file.id !== fileId) } : group));
    void deleteAudioFile(fileId); // Remove from IndexedDB so it doesn't accumulate stale data.
    stopMainTrackAudio(fileId);
    clearMainStopTimer(fileId);
    setMainTrackIds((current) => current.filter((trackId) => trackId !== fileId));
    stopStartStopPlayback(groupId);
    setToast('Sound removed from the library.');
  };

  const setFileRole = (groupId: string, fileId: string, role: SoundRole) => {
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      if (group.kind !== 'startStop') return { ...group, files: group.files.map((file) => file.id === fileId ? { ...file, role: group.kind } : file) };
      return {
        ...group,
        files: group.files.map((file) => {
          if (file.id === fileId) return { ...file, role };
          if (role !== 'unassigned' && file.role === role) return { ...file, role: 'unassigned' };
          return file;
        }),
      };
    }));
    stopStartStopPlayback(groupId);
  };

  // ── Music player functions ────────────────────────────────────────────────
  // Stable play function — only refs + stable state setters, so safe as a ref callback.
  const playTrackAt = (playlist: Playlist, trackIndex: number) => {
    const track = playlist.tracks[trackIndex];
    if (!track?.url) { setToast('This track must be re-added — audio files don\'t survive a page reload.'); return; }
    const audioGeneration = musicAudioGenerationRef.current + 1;
    musicAudioGenerationRef.current = audioGeneration;
    const playRequestGeneration = musicPlayRequestGenerationRef.current + 1;
    musicPlayRequestGenerationRef.current = playRequestGeneration;
    musicDesiredPlayingRef.current = true;
    musicPreviousRestartedRef.current = false;
    stopMusicAudio();
    const audio = new Audio(track.url);
    audio.volume = musicVolumeRef.current / 100;
    audio.loop = musicRepeatRef.current === 'one' && !musicTimerExpiredRef.current;
    const isCurrentAudio = () => musicAudioGenerationRef.current === audioGeneration && musicAudioRef.current === audio;
    audio.onended = () => {
      if (isCurrentAudio()) musicNextTrackRef.current(true);
    };
    musicAudioRef.current = audio;
    activePlaylistIdRef.current = playlist.id;
    activeTrackIndexRef.current = trackIndex;
    setActivePlaylistId(playlist.id);
    setActiveTrackIndex(trackIndex);
    setMusicElapsed(0);
    setMusicDuration(0);
    musicStatusRef.current = 'paused';
    setMusicStatus('paused');
    audio.onloadedmetadata = () => {
      if (isCurrentAudio() && Number.isFinite(audio.duration) && audio.duration > 0) setMusicDuration(audio.duration);
    };
    void audio.play().then(() => {
      // A replaced element can still resolve its earlier play() promise after
      // it has been paused and detached. Pause it again so that late browser
      // playback cannot overlap the current track.
      if (!isCurrentAudio()) {
        audio.pause();
        return;
      }
      if (musicPlayRequestGenerationRef.current !== playRequestGeneration) {
        if (!musicDesiredPlayingRef.current) audio.pause();
        return;
      }
      musicStatusRef.current = 'playing';
      setMusicStatus('playing');
    }).catch(() => {
      if (!isCurrentAudio() || musicPlayRequestGenerationRef.current !== playRequestGeneration) return;
      musicDesiredPlayingRef.current = false;
      musicStatusRef.current = 'paused';
      setMusicStatus('paused');
      setToast('Your browser needs a click before it can play audio.');
    });
  };
  musicPlayTrackRef.current = playTrackAt;

  const stopMusicFn = () => finishMusicPlayback(true);

  const playTrack = (playlistId: string, trackIndex: number) => {
    const playlist = playlistsRef.current.find((p) => p.id === playlistId);
    if (playlist) playTrackAt(playlist, trackIndex);
  };

  const pauseMusic = () => {
    const audio = musicAudioRef.current;
    if (!audio) return;
    musicPlayRequestGenerationRef.current += 1;
    musicDesiredPlayingRef.current = false;
    musicPreviousRestartedRef.current = false;
    audio.pause();
    musicStatusRef.current = 'paused';
    setMusicStatus('paused');
  };

  const resumeMusic = () => {
    // If the audio element was cleared (e.g. after a night session), re-create it from the saved track.
    const currentAudio = musicAudioRef.current;
    if (!currentAudio) {
      const playlist = playlistsRef.current.find((p) => p.id === activePlaylistIdRef.current);
      if (playlist) { playTrackAt(playlist, activeTrackIndexRef.current); return; }
      return;
    }
    const playRequestGeneration = musicPlayRequestGenerationRef.current + 1;
    musicPlayRequestGenerationRef.current = playRequestGeneration;
    musicDesiredPlayingRef.current = true;
    musicPreviousRestartedRef.current = false;
    musicStatusRef.current = 'playing';
    void currentAudio.play().then(() => {
      if (musicAudioRef.current !== currentAudio) {
        currentAudio.pause();
        return;
      }
      if (musicPlayRequestGenerationRef.current !== playRequestGeneration) {
        if (!musicDesiredPlayingRef.current) currentAudio.pause();
        return;
      }
      setMusicStatus('playing');
    }).catch(() => {
      if (musicPlayRequestGenerationRef.current !== playRequestGeneration || musicAudioRef.current !== currentAudio) return;
      musicDesiredPlayingRef.current = false;
      musicStatusRef.current = 'paused';
      setMusicStatus('paused');
      setToast('Your browser needs a click before it can play audio.');
    });
  };

  const toggleMusic = () => {
    if (musicDesiredPlayingRef.current || musicStatusRef.current === 'playing') pauseMusic();
    else resumeMusic();
  };

  const nextTrack = () => musicNextTrackRef.current(false);

  const prevTrack = () => {
    const playlist = playlistsRef.current.find((p) => p.id === activePlaylistIdRef.current);
    if (!playlist) return;
    const currentAudio = musicAudioRef.current;
    if (currentAudio && currentAudio.currentTime > 3 && !musicPreviousRestartedRef.current) {
      currentAudio.currentTime = 0;
      musicPreviousRestartedRef.current = true;
      setMusicElapsed(0);
      return;
    }
    musicPreviousRestartedRef.current = false;
    const total = playlist.tracks.length;
    if (!total) return;
    const currentIndex = activeTrackIndexRef.current;
    const prevIndex = (currentIndex - 1 + total) % total;
    playTrackAt(playlist, prevIndex);
  };

  const seekMusic = (seconds: number) => {
    musicPreviousRestartedRef.current = false;
    if (musicAudioRef.current) musicAudioRef.current.currentTime = seconds;
    setMusicElapsed(seconds);
  };
  const toggleShuffle = () => setMusicShuffle((s) => !s);
  const cycleRepeat = () => setMusicRepeat((r) => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');

  const createPlaylist = () => {
    const id = `pl-${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const name = `Playlist ${playlists.length + 1}`;
    const pl: Playlist = { id, name, tracks: [] };
    setPlaylists((current) => [...current, pl]);
    setMusicViewPlaylistId(id);
  };

  const deletePlaylist = (playlistId: string) => {
    if (activePlaylistId === playlistId) stopMusicFn();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) pl.tracks.forEach((t) => void deleteAudioFile(`music:${t.id}`));
    setPlaylists((current) => current.filter((p) => p.id !== playlistId));
    setMusicViewPlaylistId((current) => current === playlistId ? null : current);
  };

  const renamePlaylist = (playlistId: string, name: string) => {
    setPlaylists((current) => current.map((p) => p.id === playlistId ? { ...p, name } : p));
  };

  const removeMusicTrack = (playlistId: string, trackId: string) => {
    if (activePlaylistId === playlistId) {
      const playlist = playlists.find((p) => p.id === playlistId);
      const idx = playlist?.tracks.findIndex((t) => t.id === trackId) ?? -1;
      if (idx === activeTrackIndex) stopMusicFn();
      else if (idx >= 0 && idx < activeTrackIndex) setActiveTrackIndex((i) => i - 1);
    }
    void deleteAudioFile(`music:${trackId}`);
    setPlaylists((current) => current.map((p) => p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p));
  };

  const openMusicFilePicker = (playlistId: string) => { addingToPlaylistRef.current = playlistId; musicFileInputRef.current?.click(); };

  const addMusicFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const playlistId = addingToPlaylistRef.current;
    if (!playlistId || !files.length) return;
    const supported = files.filter(isSupportedAudioFile);
    const skipped = files.length - supported.length;
    if (!supported.length) { setToast('Choose MP3 or WAV files to add to your playlist.'); event.target.value = ''; return; }
    const additions: MusicTrack[] = supported.map((file, i) => ({
      id: `track-${file.name}-${file.lastModified}-${Date.now()}-${i}`,
      name: file.name, size: file.size, url: URL.createObjectURL(file),
    }));
    setPlaylists((current) => current.map((p) => {
      if (p.id !== playlistId) return p;
      return { ...p, tracks: [...p.tracks, ...additions] };
    }));
    // Persist each music file in IndexedDB so it survives page reloads.
    supported.forEach((file, i) => void storeAudioFile(`music:${additions[i].id}`, file));
    setToast(`${supported.length} track${supported.length === 1 ? '' : 's'} added.${skipped ? ` ${skipped} unsupported skipped.` : ''}`);
    event.target.value = '';
  };

  const startMusicTimer = () => {
    const normalized = {
      hours: Math.min(23, Math.max(0, Number.isFinite(musicTimerParts.hours) ? Math.floor(musicTimerParts.hours) : 0)),
      minutes: Math.min(59, Math.max(0, Number.isFinite(musicTimerParts.minutes) ? Math.floor(musicTimerParts.minutes) : 0)),
      seconds: 0,
      milliseconds: 0,
    };
    const totalMs = timerPartsToMilliseconds(normalized);
    if (totalMs < 60_000) { setToast('Set a timer of at least 1 minute.'); return; }
    setMusicTimerParts(normalized);
    musicTimerExpiredRef.current = false;
    setMusicTimerEndAt(Date.now() + totalMs);
    setMusicTimerRemaining(totalMs);
    setToast('Music timer started.');
  };

  const cancelMusicTimer = () => { musicTimerExpiredRef.current = false; setMusicTimerEndAt(null); setMusicTimerRemaining(0); };

  const updateMusicTimerPart = (unit: MusicTimerUnit, value: number) => {
    const max = unit === 'hours' ? 23 : 59;
    const safeValue = Number.isFinite(value) ? Math.floor(value) : 0;
    setMusicTimerParts((current) => ({
      ...current,
      [unit]: Math.min(max, Math.max(0, safeValue)),
      seconds: 0,
      milliseconds: 0,
    }));
  };

  // ── Schedule start ────────────────────────────────────────────────────────
  const startSchedule = () => {
    if (scheduleMode === 'off') return;
    if (scheduleMode === 'countdown') {
      const ms = scheduleParts.hours * HOUR_MS + scheduleParts.minutes * MINUTE_MS + scheduleParts.seconds * SECOND_MS;
      if (ms < 10000) { setToast('Set at least 10 seconds for the schedule.'); return; }
      setScheduleEndAt(Date.now() + ms);
      setScheduleRemaining(ms);
      setScheduleActive(true);
      setToast('Session scheduled — it will start automatically.');
    } else {
      if (!scheduleTime) { setToast('Choose a start time first.'); return; }
      setScheduleActive(true);
      setToast(`Session scheduled for ${scheduleTime}${scheduleRepeat ? ' · repeats daily' : ''}.`);
    }
  };
  const cancelSchedule = () => { setScheduleActive(false); setScheduleEndAt(null); setScheduleRemaining(0); };
  const updateSchedulePart = (unit: keyof TimerParts, value: number) => {
    const maxes: Record<keyof TimerParts, number> = { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 };
    setScheduleParts((p) => ({ ...p, [unit]: Math.min(maxes[unit], Math.max(0, value)) }));
  };

  const updateGroupSetting = (groupId: string, key: 'minInterval' | 'maxInterval' | 'limit', value: number) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, [key]: Math.max(1, value) } : group));
  };

  const updateGroupVolume = (groupId: string, vol: number) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, volume: Math.min(100, Math.max(0, vol)) } : group));
  };

  const updateGroupInterval = (groupId: string, key: IntervalKey, unit: DurationUnit, value: number) => {
    const limits: Record<DurationUnit, number> = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const parts = getDurationParts(group[key]);
      parts[unit] = Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0));
      const total = parts.hours * HOUR_MS + parts.minutes * MINUTE_MS + parts.seconds * SECOND_MS + parts.milliseconds;
      return { ...group, [key]: Math.max(1, total) };
    }));
  };

  const updateStartStopDuration = (groupId: string, key: 'runMinDuration' | 'runMaxDuration', unit: DurationUnit, value: number) => {
    const limits: Record<DurationUnit, number> = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const fallback = key === 'runMinDuration' ? DEFAULT_START_STOP_RUN_MIN_DURATION : DEFAULT_START_STOP_RUN_MAX_DURATION;
      const parts = getDurationParts(group[key] ?? fallback);
      parts[unit] = Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0));
      return { ...group, [key]: Math.max(1, timerPartsToMilliseconds(parts)) };
    }));
  };

  const updateStartStopPercent = (groupId: string, key: 'startRunPercent' | 'stopRunPercent', value: number) => {
    setGroups((current) => current.map((group) => group.id === groupId
      ? { ...group, [key]: Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)) }
      : group));
  };

  const updateGroupLimitMode = (groupId: string, enabled: boolean) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, limitEnabled: enabled } : group));
  };

  const updateGroupLimitKind = (groupId: string, kind: LimitKind) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, limitKind: kind } : group));
  };

  const resetPrefs = () => {
    setNightTextColor(DEFAULT_PREFS.nightTextColor);
    setNightShowDate(DEFAULT_PREFS.nightShowDate);
    setNightShowSeconds(DEFAULT_PREFS.nightShowSeconds);
    setNightHour12(DEFAULT_PREFS.nightHour12);
    setNightShowAmPm(DEFAULT_PREFS.nightShowAmPm);
    setNightClockFont(DEFAULT_PREFS.nightClockFont);
    setNightShowStopwatch(DEFAULT_PREFS.nightShowStopwatch);
    setNightDimEnabled(DEFAULT_PREFS.nightDimEnabled);
    setNightOsDimEnabled(DEFAULT_PREFS.nightOsDimEnabled);
    setNightOsSleepEnabled(DEFAULT_PREFS.nightOsSleepEnabled);
    setNightOsSleepDelaySecs(DEFAULT_PREFS.nightOsSleepDelaySecs);
    setNightDimDelaySecs(DEFAULT_PREFS.nightDimDelaySecs);
    setNightDimColor(DEFAULT_PREFS.nightDimColor);
    setNightDimShowClock(DEFAULT_PREFS.nightDimShowClock);
    setNightDimShowDate(DEFAULT_PREFS.nightDimShowDate);
    setNightDimShowSeconds(DEFAULT_PREFS.nightDimShowSeconds);
    setNightDimShowAmPm(DEFAULT_PREFS.nightDimShowAmPm);
    setNightDimBrightness(DEFAULT_PREFS.nightDimBrightness);
    setClockDisplayEnabled(DEFAULT_PREFS.clockDisplayEnabled);
    setClockDisplayDelaySecs(DEFAULT_PREFS.clockDisplayDelaySecs);
    setClockDisplayColor(DEFAULT_PREFS.clockDisplayColor);
    setClockDisplayRandomColor(DEFAULT_PREFS.clockDisplayRandomColor);
    setClockDisplayCustomColors(DEFAULT_PREFS.clockDisplayCustomColors);
    setClockDisplayColorSchedules(DEFAULT_PREFS.clockDisplayColorSchedules);
    setClockDisplayCycleEnabled(DEFAULT_PREFS.clockDisplayCycleEnabled);
    setClockDisplayCycleColors(DEFAULT_PREFS.clockDisplayCycleColors);
    setClockDisplayFont(DEFAULT_PREFS.clockDisplayFont);
    setClockDisplayShowDate(DEFAULT_PREFS.clockDisplayShowDate);
    setClockDisplayShowSeconds(DEFAULT_PREFS.clockDisplayShowSeconds);
    setClockDisplayHour12(DEFAULT_PREFS.clockDisplayHour12);
    setClockDisplayShowAmPm(DEFAULT_PREFS.clockDisplayShowAmPm);
    setVolume(DEFAULT_PREFS.volume);
    setAlarmOnTimer(DEFAULT_PREFS.alarmOnTimer);
    setAlarmOnAlarm(DEFAULT_PREFS.alarmOnAlarm);
    setAlarmSnoozeMins(DEFAULT_PREFS.alarmSnoozeMins);
    setAlarmSnoozeSecs(DEFAULT_PREFS.alarmSnoozeSecs);
    setAlarmVolume(DEFAULT_PREFS.alarmVolume);
    setAlarmSnoozeResumeAudio(DEFAULT_PREFS.alarmSnoozeResumeAudio);
    setAlarmPulseOnTimer(DEFAULT_PREFS.alarmPulseOnTimer);
    setAlarmPulseOnAlarm(DEFAULT_PREFS.alarmPulseOnAlarm);
    // Note: the alarm sound file itself is kept on reset — only toggles are reset.
  };

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headerMenuOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setHeaderMenuOpen(false);
  };

  const stopAlarmTest = () => {
    if (alarmTestAudioRef.current) {
      alarmTestAudioRef.current.onended = null;
      alarmTestAudioRef.current.pause();
      alarmTestAudioRef.current = null;
    }
    if (alarmTestTimerRef.current !== null) {
      window.clearTimeout(alarmTestTimerRef.current);
      alarmTestTimerRef.current = null;
    }
    setAlarmTesting(false);
  };

  const startAlarmTest = () => {
    const url = alarmSoundUrlRef.current;
    if (!url) return;
    stopAlarmTest();
    setAlarmTesting(true);
    const playLoop = () => {
      if (!alarmTestAudioRef.current) return;
      const a = new Audio(url);
      a.volume = alarmVolumeRef.current / 100;
      a.onended = () => { if (alarmTestAudioRef.current) playLoop(); };
      alarmTestAudioRef.current = a;
      void a.play().catch(() => {});
    };
    const first = new Audio(url);
    first.volume = alarmVolumeRef.current / 100;
    alarmTestAudioRef.current = first;
    first.onended = () => { if (alarmTestAudioRef.current) playLoop(); };
    void first.play().catch(() => {});
    alarmTestTimerRef.current = window.setTimeout(stopAlarmTest, 60 * 1000);
  };

  // Stop the test preview whenever the user navigates away from settings.
  useEffect(() => {
    if (page !== 'settings') stopAlarmTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pickAlarmSound = () => alarmFileInputRef.current?.click();

  const clearAlarmSound = () => {
    if (alarmSoundId) void deleteAudioFile(`alarm:${alarmSoundId}`);
    setAlarmSoundId(null);
    setAlarmSoundName('');
    if (alarmSoundUrl) URL.revokeObjectURL(alarmSoundUrl);
    setAlarmSoundUrl(null);
  };

  const handleAlarmFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const id = `alarm-${Date.now()}`;
    if (alarmSoundId) void deleteAudioFile(`alarm:${alarmSoundId}`);
    if (alarmSoundUrl) URL.revokeObjectURL(alarmSoundUrl);
    await storeAudioFile(`alarm:${id}`, file);
    const url = URL.createObjectURL(file);
    setAlarmSoundId(id);
    setAlarmSoundName(file.name.replace(/\.[^.]+$/, ''));
    setAlarmSoundUrl(url);
  };

  const updateGroupTimeLimit = (groupId: string, unit: DurationUnit, value: number) => {
    const limits: Record<DurationUnit, number> = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const parts = getDurationParts(group.timeLimit ?? DEFAULT_TIME_LIMIT);
      parts[unit] = Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0));
      return { ...group, timeLimit: Math.max(1, timerPartsToMilliseconds(parts)) };
    }));
  };

  const updateGroupTimeLimitMax = (groupId: string, unit: DurationUnit, value: number) => {
    const limits: Record<DurationUnit, number> = { hours: 999, minutes: 59, seconds: 59, milliseconds: 999 };
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      const parts = getDurationParts(group.timeLimitMax ?? DEFAULT_TIME_LIMIT_MAX);
      parts[unit] = Math.min(limits[unit], Math.max(0, Number.isFinite(value) ? value : 0));
      return { ...group, timeLimitMax: Math.max(1, timerPartsToMilliseconds(parts)) };
    }));
  };

  const updateGroupTimeLimitMode = (groupId: string, mode: TimeLimitMode) => {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, timeLimitMode: mode } : group));
  };

  // Called when a group is enabled mid-session. Starts audio immediately instead
  // of waiting for the next scheduled interval.
  const kickGroupImmediate = (groupId: string) => {
    const g = groupsRef.current.find((group) => group.id === groupId);
    if (!g || !g.enabled || sessionStatusRef.current !== 'running') return;

    if (g.kind === 'main') {
      // For main groups: add one random loop without interrupting other main groups.
      const mainFiles = g.files.filter((f) => f.role === 'main');
      if (!mainFiles.length) return;
      const file = mainFiles[Math.floor(Math.random() * mainFiles.length)];
      setMainTrackIds((current) => current.includes(file.id) ? current : [...current, file.id]);
      if (g.autoStopEnabled) {
        const minimum = Math.max(1, g.minDuration ?? DEFAULT_MAIN_MIN_DURATION);
        const maximum = Math.max(minimum, g.maxDuration ?? DEFAULT_MAIN_MAX_DURATION);
        const duration = g.autoStopMode === 'fixed' ? minimum : minimum + Math.random() * (maximum - minimum);
        scheduleMainStop(file.id, duration);
      }
    } else if (g.kind === 'effect') {
      // A manual enable is an explicit session override of the original chance roll.
      sessionEffectGroupIdsRef.current.add(groupId);
      // For effect groups: play immediately if the channel is free and the limit
      // hasn't been hit; otherwise fall back to normal scheduling.
      if (hasReachedPlayLimit(g, elapsedMsRef.current, resolvedTimeLimitsRef.current[g.id])) return;
      if (!g.files.some((f) => f.role === 'effect')) return;
      const busy = effectAudioRef.current && !effectAudioRef.current.ended && !effectAudioRef.current.paused;
      if (busy) {
        scheduleGroupRef.current(groupId);
      } else {
        playGroupEffect(g, () => scheduleGroupRef.current(groupId));
      }
    } else {
      // Start/Stop groups are also a deliberate session-chance override.
      sessionStartStopGroupIdsRef.current.add(groupId);
      scheduleStartStopRef.current(groupId, true);
    }
  };

  const toggleGroup = (groupId: string) => {
    const group = groupsRef.current.find((g) => g.id === groupId);
    const willBeEnabled = group ? !group.enabled : false;

    if (!willBeEnabled) {
        sessionEffectGroupIdsRef.current.delete(groupId);
        sessionStartStopGroupIdsRef.current.delete(groupId);
        // Disabling: cancel any pending timer for this group right now so it
        // doesn't fire an effect after the user turns it off.
        if (groupId in groupTimerRefs.current) {
          window.clearTimeout(groupTimerRefs.current[groupId]);
          delete groupTimerRefs.current[groupId];
        }
        // Disabling a main group removes only that group's loop.
        if (group?.kind === 'main') {
          const trackIds = group.files.map((file) => file.id);
          trackIds.forEach((trackId) => stopMainTrackAudio(trackId));
          trackIds.forEach((trackId) => clearMainStopTimer(trackId));
          setMainTrackIds((active) => active.filter((trackId) => !trackIds.includes(trackId)));
        }
        if (group?.kind === 'startStop') stopStartStopPlayback(groupId);
        // If this effect group is currently playing, cut it immediately.
        if (group?.kind === 'effect' && group.id === currentEffectGroupIdRef.current) {
          if (effectAudioRef.current) {
            effectAudioRef.current.onended = null;
            effectAudioRef.current.onerror = null;
            effectAudioRef.current.pause();
            effectAudioRef.current = null;
          }
          effectSuppressionReleaseRef.current?.();
          effectSuppressionReleaseRef.current = null;
          currentEffectGroupIdRef.current = null;
        }
    }

    if (willBeEnabled && group?.kind === 'effect' && sessionStatusRef.current === 'running') {
      // Record the user's override immediately; the delayed playback kick then
      // sees this group as part of the current session.
      suppressedGroupIdsRef.current.delete(groupId);
      suppressionSourcesRef.current.delete(groupId);
      sessionEffectGroupIdsRef.current.add(groupId);
    }
    if (willBeEnabled && group?.kind === 'startStop' && sessionStatusRef.current === 'running') {
      suppressedGroupIdsRef.current.delete(groupId);
      suppressionSourcesRef.current.delete(groupId);
      sessionStartStopGroupIdsRef.current.add(groupId);
    }
    setGroups((current) => current.map((g) => g.id === groupId ? { ...g, enabled: !g.enabled } : g));
    if (willBeEnabled && sessionStatusRef.current === 'running') {
      // Explicitly starting a group mid-session bypasses its session chance
      // setting: the user's toggle is an intentional override.
      window.setTimeout(() => kickGroupImmediate(groupId), 80);
    }
  };

  const triggerEffectNow = () => triggerEffect(() => { /* manual trigger; no reschedule */ });

  // Keep startSessionRef fresh every render so schedule effects always call the latest version.
  startSessionRef.current = startSession;

  // ── Music derived (used by sidebar mini-player and home music strip) ───────
  const musicActivePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null;
  const musicActiveTrack = musicActivePlaylist?.tracks[activeTrackIndex] ?? null;
  const hasMusicTrack = !!musicActiveTrack;
  const canNavigateMusic = hasMusicTrack;
  // Every player surface calls these same transport actions, so the guarded
  // playback lifecycle is identical from Music, Home, sidebar, and clock views.
  const onMusicPlayPause = toggleMusic;
  const onMusicPrevious = prevTrack;
  const onMusicNext = nextTrack;

  return (
    <div className="night-app">
      <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} data-testid="button-close-navigation" />}
        <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-mark"><Moon size={20} strokeWidth={2.2} /></div>
            <div className="brand-copy"><div className="brand-name">Night Sound Machine</div><div className="brand-sub">your quiet room</div></div>
            <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((c) => !c)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} data-testid="button-toggle-sidebar">
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          {sidebarMusicVisible && (
            <div className="sidebar-music">
              <div className="sidebar-music-track">
                <ListMusic size={11} />
                <div className="sidebar-music-info">
                  <span className="sidebar-music-name">{musicActiveTrack ? musicActiveTrack.name.replace(/\.[^.]+$/, '') : 'Music player'}</span>
                  {musicActivePlaylist && <span className="sidebar-music-playlist">{musicActivePlaylist.name}</span>}
                </div>
              </div>
              <div className="sidebar-music-controls">
                <button className="icon-button" onClick={onMusicPrevious} disabled={!canNavigateMusic} aria-label="Previous track" title="Previous"><SkipBack size={13} /></button>
                <button className="icon-button sidebar-music-playpause" onClick={onMusicPlayPause} disabled={!musicActiveTrack} aria-label={musicStatus === 'playing' ? 'Pause music' : 'Play music'}>
                  {musicStatus === 'playing' ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
                <button className="icon-button" onClick={onMusicNext} disabled={!canNavigateMusic} aria-label="Next track" title="Next"><SkipForward size={13} /></button>
              </div>
            </div>
          )}
          <div className="nav-label">Your Space</div>
          <nav className="side-nav" aria-label="Main navigation">
            <button className={`nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => { setPage('home'); setMobileNavOpen(false); }} title="Home" data-testid="nav-home"><HomeIcon size={16} /><span className="nav-item-label">Home</span></button>
            <button className={`nav-item ${page === 'games' ? 'active' : ''}`} onClick={() => { setPage('games'); setMobileNavOpen(false); }} title="Games" data-testid="nav-games"><Gamepad2 size={16} /><span className="nav-item-label">Games</span></button>
            <button className={`nav-item ${page === 'music' ? 'active' : ''}`} onClick={() => { setPage('music'); setMobileNavOpen(false); }} title="Music player" data-testid="nav-music"><ListMusic size={16} /><span className="nav-item-label">Music player</span></button>
            <button className={`nav-item ${page === 'library' ? 'active' : ''}`} onClick={() => { setPage('library'); setMobileNavOpen(false); }} title="Sound library" data-testid="nav-library"><Library size={16} /><span className="nav-item-label">Sound library</span></button>
             <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); setSettingsSection('night-display'); setMobileNavOpen(false); }} title="Preferences" data-testid="nav-settings"><Settings size={16} /><span className="nav-item-label">Preferences</span></button>
             {page === 'settings' && (
               <div className="preferences-subnav" aria-label="Preference sections">
                 <button className={`preferences-subnav-item ${settingsSection === 'night-display' ? 'active' : ''}`} onClick={() => setSettingsSection('night-display')} data-testid="nav-preferences-night-display">Night Display</button>
                 <button className={`preferences-subnav-item ${settingsSection === 'screensaver' ? 'active' : ''}`} onClick={() => setSettingsSection('screensaver')} data-testid="nav-preferences-screensaver">ScreenSaver</button>
                 <button className={`preferences-subnav-item ${settingsSection === 'app-settings' ? 'active' : ''}`} onClick={() => setSettingsSection('app-settings')} data-testid="nav-preferences-app-settings">App Settings</button>
               </div>
             )}
          </nav>
          <div className="groups-head"><div className="group-label">Your groups</div><button className="icon-button" onClick={() => openNewGroup()} aria-label="Create a group" data-testid="button-create-group"><Plus size={16} /></button></div>
          <div className="group-list">
            {groups.map((group) => {
              const Icon = iconForGroup(group.name, group.icon);
              return <button key={group.id} className={`group-item ${selectedGroup === group.id && page === 'library' ? 'active' : ''}`} onClick={() => chooseGroup(group.id)} title={group.name} data-testid={`nav-group-${group.id}`}>
                <span className="group-dot" style={{ background: group.color }} /><Icon size={15} /><span>{group.name}</span><span className="group-count">{group.files.length}</span>
              </button>;
            })}
          </div>
          <div className="side-footer"><div className="local-note"><LockKeyhole size={13} /><span>Everything stays in the app. No accounts, no cloud.</span></div></div>
        </aside>

        <main className="main-content">
          <div className="content-wrap">
            <header className="topbar">
              <div className="crumb"><button className="icon-button menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={20} /></button><span>Night Sound Machine</span><ChevronRight size={13} /><strong>{page === 'home' ? 'Home' : page === 'games' ? 'Games' : page === 'music' ? 'Music player' : page === 'library' ? 'Sound library' : 'Preferences'}</strong></div>
              <div className="top-actions">
                <div className="status-pill"><span className="status-dot" /> Local only</div>
                <div className="header-menu-wrap" ref={headerMenuRef}>
                  <button className="icon-button" aria-label="Menu" onClick={() => setHeaderMenuOpen((o) => !o)} aria-expanded={headerMenuOpen} data-testid="button-header-menu"><Menu size={17} /></button>
                  {headerMenuOpen && (
                    <div className="header-dropdown" role="menu">
                       <button className="header-dropdown-item" role="menuitemcheckbox" aria-checked={clockDisplayEnabled} onClick={() => { setClockDisplayEnabled(!clockDisplayEnabled); setHeaderMenuOpen(false); }} data-testid="button-toggle-clock-display">
                         <Clock size={14} />
                         {clockDisplayEnabled ? 'Disable clock display' : 'Enable clock display'}
                       </button>
                      <button className="header-dropdown-item" role="menuitem" onClick={toggleFullscreen} data-testid="button-toggle-fullscreen">
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {isFullscreen ? 'Exit full screen' : 'Full screen'}
                      </button>
                      <button className="header-dropdown-item" role="menuitem" onClick={() => { setHelpOpen(true); setHeaderMenuOpen(false); }} data-testid="button-open-help">
                        <CircleHelp size={14} /> Help
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
            {updateCheck.status === 'update-available' && updateCheck.latestVersion !== dismissedUpdateVersion && (
              <div className="update-banner" role="status" aria-live="polite">
                <span className="update-banner-text">
                  Version {updateCheck.latestVersion} is available
                </span>
                <a
                  className="update-banner-link"
                  href={updateCheck.releasesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download version ${updateCheck.latestVersion} from GitHub`}
                >
                  Download <ExternalLink size={11} />
                </a>
                <button
                  className="update-banner-dismiss"
                  aria-label="Dismiss update notification"
                  onClick={() => {
                    const v = updateCheck.latestVersion;
                    setDismissedUpdateVersion(v);
                    try { localStorage.setItem(DISMISSED_UPDATE_KEY, v); } catch { /* private browsing */ }
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {page === 'home' && <HomePage
              groups={groups} mainGroups={mainGroups} effectGroups={effectGroups}
              startStopGroups={startStopGroups}
              activeTrack={activeTrack} mainTrackIds={mainTrackIds} elapsed={elapsed}
              sessionStatus={sessionStatus} volume={volume} setVolume={setVolume}
              startSession={startSession} stopSession={stopSession} pauseSession={pauseSession}
              endMode={endMode} setEndMode={setEndMode} timerParts={timerParts} updateTimerPart={updateTimerPart}
              alarmTime={alarmTime} setAlarmTime={setAlarmTime} endRemaining={endRemaining}
              toggleGroup={toggleGroup} openFilePicker={openFilePicker} openNewGroup={openNewGroup} chooseGroup={chooseGroup}
              triggerEffect={triggerEffectNow} lastEffect={lastEffect}
              updateGroupSetting={updateGroupSetting} updateGroupVolume={updateGroupVolume}
              updateGroupLimitMode={updateGroupLimitMode} updateGroupLimitKind={updateGroupLimitKind}
              updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax}
              updateGroupTimeLimitMode={updateGroupTimeLimitMode} updateGroupInterval={updateGroupInterval}
              updateMainSessionSetting={updateMainSessionSetting} updateMainDuration={updateMainDuration}
              musicStatus={musicStatus} musicActiveTrack={musicActiveTrack} musicActivePlaylist={musicActivePlaylist}
              canNavigateMusic={canNavigateMusic}
              musicVolume={musicVolume} setMusicVolume={setMusicVolume}
               onMusicPlayPause={onMusicPlayPause} onMusicPrev={onMusicPrevious} onMusicNext={onMusicNext}
              musicTimerEndAt={musicTimerEndAt} musicTimerRemaining={musicTimerRemaining}
              showMusicStrip={sidebarMusicVisible}
               clockNow={clockNow} activateClockDisplay={() => setClockDisplayActive(true)}
              scheduleMode={scheduleMode} setScheduleMode={setScheduleMode}
              scheduleParts={scheduleParts} updateSchedulePart={updateSchedulePart}
              scheduleTime={scheduleTime} setScheduleTime={setScheduleTime}
              scheduleRepeat={scheduleRepeat} setScheduleRepeat={setScheduleRepeat}
              scheduleActive={scheduleActive} scheduleEndAt={scheduleEndAt} scheduleRemaining={scheduleRemaining}
              startSchedule={startSchedule} cancelSchedule={cancelSchedule}
              savedTimers={savedTimers} savedAlarms={savedAlarms}
              onSaveTimer={(t) => setSavedTimers((prev) => { if (prev.some((p) => timerPartsEqual(p, t))) return prev; return [t, ...prev].slice(0, MAX_SAVED_PRESETS); })}
              onDeleteTimer={(i) => setSavedTimers((prev) => prev.filter((_, idx) => idx !== i))}
              onSaveAlarm={(a) => setSavedAlarms((prev) => { if (prev.includes(a)) return prev; return [a, ...prev].slice(0, MAX_SAVED_PRESETS); })}
              onDeleteAlarm={(i) => setSavedAlarms((prev) => prev.filter((_, idx) => idx !== i))}
            />}
            {page === 'games' && <GamesPage />}
            {page === 'library' && <LibraryPage
              groups={groups} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
              openNewGroup={openNewGroup} openEditGroup={openEditGroup} deleteGroup={deleteGroup}
              openFilePicker={openFilePicker} removeFile={removeFile} setFileRole={setFileRole}
              updateGroupSetting={updateGroupSetting} updateGroupVolume={updateGroupVolume}
              updateGroupLimitMode={updateGroupLimitMode} updateGroupLimitKind={updateGroupLimitKind}
              updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax}
              updateGroupTimeLimitMode={updateGroupTimeLimitMode} updateGroupInterval={updateGroupInterval}
               updateMainSessionSetting={updateMainSessionSetting} updateMainDuration={updateMainDuration}
                updateMainStopMode={updateMainStopMode}
                updateStartStopDuration={updateStartStopDuration} updateStartStopPercent={updateStartStopPercent}
              toggleGroup={toggleGroup}
            />}
            {page === 'music' && <MusicPage
              playlists={playlists} musicViewPlaylistId={musicViewPlaylistId} setMusicViewPlaylistId={setMusicViewPlaylistId}
              activePlaylistId={activePlaylistId} activeTrackIndex={activeTrackIndex}
              musicStatus={musicStatus} musicVolume={musicVolume} setMusicVolume={setMusicVolume}
              musicElapsed={musicElapsed} musicDuration={musicDuration}
              musicShuffle={musicShuffle} musicRepeat={musicRepeat}
              musicTimerParts={musicTimerParts} musicTimerEndAt={musicTimerEndAt} musicTimerRemaining={musicTimerRemaining}
              createPlaylist={createPlaylist} deletePlaylist={deletePlaylist} renamePlaylist={renamePlaylist}
              openMusicFilePicker={openMusicFilePicker} removeTrack={removeMusicTrack}
               playTrack={playTrack} onMusicPlayPause={onMusicPlayPause}
               onMusicNext={onMusicNext} onMusicPrev={onMusicPrevious} seekMusic={seekMusic}
              toggleShuffle={toggleShuffle} cycleRepeat={cycleRepeat}
              startMusicTimer={startMusicTimer} cancelMusicTimer={cancelMusicTimer} updateMusicTimerPart={updateMusicTimerPart}
            />}
             {page === 'settings' && <SettingsPage section={settingsSection} setSection={setSettingsSection} volume={volume} setVolume={setVolume} fileCount={allFileCount} groupCount={groups.length} nightShowDate={nightShowDate} setNightShowDate={setNightShowDate} nightShowSeconds={nightShowSeconds} setNightShowSeconds={setNightShowSeconds} nightHour12={nightHour12} setNightHour12={setNightHour12} nightShowAmPm={nightShowAmPm} setNightShowAmPm={setNightShowAmPm} nightTextColor={nightTextColor} setNightTextColor={setNightTextColor} nightClockFont={nightClockFont} setNightClockFont={setNightClockFont} nightShowStopwatch={nightShowStopwatch} setNightShowStopwatch={setNightShowStopwatch} nightDimEnabled={nightDimEnabled} setNightDimEnabled={setNightDimEnabled} nightOsDimEnabled={nightOsDimEnabled} setNightOsDimEnabled={setNightOsDimEnabled} nightOsSleepEnabled={nightOsSleepEnabled} setNightOsSleepEnabled={setNightOsSleepEnabled} nightOsSleepDelaySecs={nightOsSleepDelaySecs} setNightOsSleepDelaySecs={setNightOsSleepDelaySecs} nightDimDelaySecs={nightDimDelaySecs} setNightDimDelaySecs={setNightDimDelaySecs} nightDimColor={nightDimColor} setNightDimColor={setNightDimColor} nightDimShowClock={nightDimShowClock} setNightDimShowClock={setNightDimShowClock} nightDimShowDate={nightDimShowDate} setNightDimShowDate={setNightDimShowDate} nightDimShowSeconds={nightDimShowSeconds} setNightDimShowSeconds={setNightDimShowSeconds} nightDimShowAmPm={nightDimShowAmPm} setNightDimShowAmPm={setNightDimShowAmPm} nightDimBrightness={nightDimBrightness} setNightDimBrightness={setNightDimBrightness} clockDisplayEnabled={clockDisplayEnabled} setClockDisplayEnabled={setClockDisplayEnabled} clockDisplayDelaySecs={clockDisplayDelaySecs} setClockDisplayDelaySecs={setClockDisplayDelaySecs} clockDisplayColor={clockDisplayColor} setClockDisplayColor={setClockDisplayColor} clockDisplayRandomColor={clockDisplayRandomColor} setClockDisplayRandomColor={setClockDisplayRandomColor} clockDisplayCustomColors={clockDisplayCustomColors} setClockDisplayCustomColors={setClockDisplayCustomColors} clockDisplayColorSchedules={clockDisplayColorSchedules} setClockDisplayColorSchedules={setClockDisplayColorSchedules} clockDisplayCycleEnabled={clockDisplayCycleEnabled} setClockDisplayCycleEnabled={setClockDisplayCycleEnabled} clockDisplayCycleColors={clockDisplayCycleColors} setClockDisplayCycleColors={setClockDisplayCycleColors} clockDisplayFont={clockDisplayFont} setClockDisplayFont={setClockDisplayFont} clockDisplayShowDate={clockDisplayShowDate} setClockDisplayShowDate={setClockDisplayShowDate} clockDisplayShowSeconds={clockDisplayShowSeconds} setClockDisplayShowSeconds={setClockDisplayShowSeconds} clockDisplayHour12={clockDisplayHour12} setClockDisplayHour12={setClockDisplayHour12} clockDisplayShowAmPm={clockDisplayShowAmPm} setClockDisplayShowAmPm={setClockDisplayShowAmPm} onResetPrefs={resetPrefs} alarmSoundName={alarmSoundName} alarmOnTimer={alarmOnTimer} setAlarmOnTimer={setAlarmOnTimer} alarmOnAlarm={alarmOnAlarm} setAlarmOnAlarm={setAlarmOnAlarm} alarmPulseOnTimer={alarmPulseOnTimer} setAlarmPulseOnTimer={setAlarmPulseOnTimer} alarmPulseOnAlarm={alarmPulseOnAlarm} setAlarmPulseOnAlarm={setAlarmPulseOnAlarm} alarmSnoozeMins={alarmSnoozeMins} setAlarmSnoozeMins={setAlarmSnoozeMins} alarmSnoozeSecs={alarmSnoozeSecs} setAlarmSnoozeSecs={setAlarmSnoozeSecs} alarmVolume={alarmVolume} setAlarmVolume={setAlarmVolume} alarmSnoozeResumeAudio={alarmSnoozeResumeAudio} setAlarmSnoozeResumeAudio={setAlarmSnoozeResumeAudio} alarmTesting={alarmTesting} onTestAlarm={startAlarmTest} onStopTestAlarm={stopAlarmTest} onPickAlarmSound={pickAlarmSound} onClearAlarmSound={clearAlarmSound} />}
          </div>
        </main>
      </div>

      <NightModeOverlay
        active={sessionStatus === 'running' || sessionStatus === 'alarming'}
        isAlarming={sessionStatus === 'alarming'}
        alarmPulseActive={alarmPulseActive}
        endMode={endMode} endRemaining={endRemaining} alarmTime={alarmTime}
        elapsed={elapsed}
        textColor={nightTextColor} setTextColor={setNightTextColor}
        now={clockNow} stopSession={stopSession}
        onSnooze={snoozeAlarm} snoozeMins={alarmSnoozeMins} snoozeSecs={alarmSnoozeSecs}
        showDate={nightShowDate} showSeconds={nightShowSeconds} hour12={nightHour12} showAmPm={nightShowAmPm}
        clockFont={nightClockFont} setClockFont={setNightClockFont}
        groups={groups} updateGroupVolume={updateGroupVolume} toggleGroup={toggleGroup}
        dimEnabled={nightDimEnabled} dimDelaySecs={nightDimDelaySecs} dimColor={nightDimColor}
        dimShowClock={nightDimShowClock} dimShowDate={nightDimShowDate}
        dimShowSeconds={nightDimShowSeconds} dimShowAmPm={nightDimShowAmPm} dimBrightness={nightDimBrightness} showStopwatch={nightShowStopwatch}
        flashlightBrightness={flashlightBrightness} setFlashlightBrightness={updateFlashlightBrightness}
        osDimEnabled={nightOsDimEnabled} osSleepEnabled={nightOsSleepEnabled} osSleepDelaySecs={nightOsSleepDelaySecs}
        onToggleDim={() => setNightDimEnabled(!nightDimEnabled)}
      />

      <ClockDisplayOverlay
        active={clockDisplayActive}
        onDismiss={() => setClockDisplayActive(false)}
        now={clockNow}
        color={effectiveClockDisplayColor}
        clockFont={clockDisplayFont}
        showDate={clockDisplayShowDate}
        showSeconds={clockDisplayShowSeconds}
        hour12={clockDisplayHour12}
        showAmPm={clockDisplayShowAmPm}
        musicStatus={musicStatus}
        musicActiveTrack={musicActiveTrack}
        musicActivePlaylist={musicActivePlaylist}
        canNavigateMusic={canNavigateMusic}
        musicVolume={musicVolume}
        setMusicVolume={setMusicVolume}
        onMusicPlayPause={onMusicPlayPause}
         onMusicPrev={onMusicPrevious}
         onMusicNext={onMusicNext}
      />

      <input ref={fileInputRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave" multiple hidden onChange={addFiles} data-testid="input-audio-files" />
      <input ref={musicFileInputRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave" multiple hidden onChange={addMusicFiles} data-testid="input-music-files" />
      <input ref={alarmFileInputRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave" hidden onChange={handleAlarmFileChange} data-testid="input-alarm-sound" />
      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="group-dialog-title">
          <div className="modal-head"><div><h2 id="group-dialog-title">{modal === 'new' ? 'New sound group' : 'Edit group'}</h2><p>Give this part of the night a name and choose how it sounds.</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog" data-testid="button-close-dialog"><X size={17} /></button></div>
          <div className="form-field"><label htmlFor="group-name">Group name</label><input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Cabin wind" autoFocus data-testid="input-group-name" /></div>
          <div className="form-field"><label htmlFor="group-kind">Sound behavior</label><select id="group-kind" value={groupKind} onChange={(event) => setGroupKind(event.target.value as GroupKind)} data-testid="select-group-kind"><option value="main">Main sound · loops continuously</option><option value="effect">Effect group · arrives occasionally</option><option value="startStop">Start/Stop · opening, loop, and closing</option></select></div>
          <div className="form-field"><label>Color marker</label><div className="color-options">{COLORS.map((color) => <button key={color} className={`color-option ${groupColor === color ? 'selected' : ''}`} style={{ background: color }} onClick={() => setGroupColor(color)} aria-label={`Choose ${color} marker`} data-testid={`button-color-${color.replace('#', '')}`}><span>{groupColor === color ? <Check size={13} color="#1b1823" /> : null}</span></button>)}</div></div>
          <div className="form-field icon-picker-field">
            <div className="icon-picker-row">
              <label className="icon-picker-label">
                Icon
                {groupIcon && GROUP_ICON_MAP[groupIcon] ? (() => { const Sel = GROUP_ICON_MAP[groupIcon]!; return <span className="icon-selected-preview" style={{ color: groupColor, borderColor: groupColor }}><Sel size={13} /></span>; })() : <span className="form-label-hint"> optional</span>}
              </label>
              <button type="button" className="icon-picker-toggle" onClick={() => setIconPickerOpen((o) => !o)} aria-expanded={iconPickerOpen}>
                {iconPickerOpen ? 'Hide' : groupIcon ? 'Change' : 'Choose'}
                <ChevronDown size={11} style={{ transform: iconPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>
            {iconPickerOpen && <div className="icon-options">{GROUP_ICONS.map(({ key, Component }) => <button key={key} className={`icon-option ${groupIcon === key ? 'selected' : ''}`} style={groupIcon === key ? { color: groupColor, borderColor: groupColor } : {}} onClick={() => setGroupIcon(groupIcon === key ? null : key)} aria-label={`Choose ${key} icon`} aria-pressed={groupIcon === key} data-testid={`button-icon-${key}`}><Component size={15} /></button>)}</div>}
          </div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)} data-testid="button-cancel-group">Cancel</button><button className="primary-button" onClick={saveGroup} disabled={!groupName.trim()} data-testid="button-save-group">{modal === 'new' ? 'Create group' : 'Save changes'}</button></div>
        </div>
      </div>}
      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}

      {helpOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
          <div className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
            <div className="modal-head">
              <div><h2 id="help-dialog-title">How it works</h2><p>Night Sound Machine at a glance.</p></div>
              <button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close help" data-testid="button-close-help"><X size={17} /></button>
            </div>
            <div className="help-body">
              <div className="help-section">
                <div className="help-step"><span className="help-num">1</span><div><strong>Build your library</strong><p>Go to Sound Library, create a group, and upload audio files from your device.</p></div></div>
                <div className="help-step"><span className="help-num">2</span><div><strong>Choose a main sound</strong><p>On the Home screen, pick a main group — this plays continuously in the background.</p></div></div>
                <div className="help-step"><span className="help-num">3</span><div><strong>Enable effects</strong><p>Turn on effect groups to add sounds that arrive naturally throughout the night.</p></div></div>
                <div className="help-step"><span className="help-num">4</span><div><strong>Start the session</strong><p>Press play. The night display takes over with the clock and a quiet set of controls.</p></div></div>
              </div>
              <div className="help-divider" />
              <div className="help-section">
                <p className="help-label">During a session</p>
                <ul className="help-list">
                  <li>Tap the <strong>slider icon</strong> on the left edge to adjust volumes and toggle groups.</li>
                  <li>Move the mouse, click, or tap to <strong>wake the display</strong> if it has dimmed.</li>
                  <li>Set timers, alarms, and dim settings in <strong>Preferences</strong>.</li>
                </ul>
              </div>
              <div className="help-divider" />
              <p className="help-footer"><Moon size={12} /> Everything stays in the app — no accounts, no servers, no cloud.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomePage
// ─────────────────────────────────────────────────────────────────────────────

type HomePageProps = {
  groups: SoundGroup[];
  mainGroups: SoundGroup[];
  effectGroups: SoundGroup[];
  startStopGroups: SoundGroup[];
  activeTrack?: SoundFile;
  mainTrackIds: string[];
  elapsed: number;
  sessionStatus: SessionStatus;
  volume: number;
  setVolume: (value: number) => void;
  startSession: () => void;
  stopSession: () => void;
  pauseSession: () => void;
  toggleGroup: (id: string) => void;
  openFilePicker: (groupId?: string) => void;
  openNewGroup: (kind?: GroupKind) => void;
  chooseGroup: (id: string) => void;
  triggerEffect: () => void;
  lastEffect: string;
  updateGroupSetting: (groupId: string, key: 'minInterval' | 'maxInterval' | 'limit', value: number) => void;
  updateGroupVolume: (groupId: string, volume: number) => void;
  updateGroupLimitMode: (groupId: string, enabled: boolean) => void;
  updateGroupLimitKind: (groupId: string, kind: LimitKind) => void;
  updateGroupTimeLimit: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMax: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMode: (groupId: string, mode: TimeLimitMode) => void;
  updateGroupInterval: (groupId: string, key: IntervalKey, unit: DurationUnit, value: number) => void;
  endMode: EndMode;
  setEndMode: (mode: EndMode) => void;
  timerParts: TimerParts;
  updateTimerPart: (unit: keyof TimerParts, value: number) => void;
  alarmTime: string;
  setAlarmTime: (value: string) => void;
  endRemaining: number;
  updateMainSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void;
  updateMainDuration: (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => void;
  // Music mini-strip
  musicStatus: MusicStatus;
  musicActiveTrack: MusicTrack | null;
  musicActivePlaylist: Playlist | null;
  canNavigateMusic: boolean;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  onMusicPlayPause: () => void;
  onMusicPrev: () => void;
  onMusicNext: () => void;
  musicTimerEndAt: number | null;
  musicTimerRemaining: number;
  showMusicStrip: boolean;
  clockNow: Date;
  activateClockDisplay: () => void;
  // Schedule start
  scheduleMode: ScheduleMode;
  setScheduleMode: (m: ScheduleMode) => void;
  scheduleParts: TimerParts;
  updateSchedulePart: (unit: keyof TimerParts, value: number) => void;
  scheduleTime: string;
  setScheduleTime: (t: string) => void;
  scheduleRepeat: boolean;
  setScheduleRepeat: (r: boolean) => void;
  scheduleActive: boolean;
  scheduleEndAt: number | null;
  scheduleRemaining: number;
  startSchedule: () => void;
  cancelSchedule: () => void;
  savedTimers: TimerParts[];
  savedAlarms: string[];
  onSaveTimer: (t: TimerParts) => void;
  onDeleteTimer: (idx: number) => void;
  onSaveAlarm: (a: string) => void;
  onDeleteAlarm: (idx: number) => void;
};

function HomePage(props: HomePageProps) {
  const { groups, mainGroups, effectGroups, startStopGroups, activeTrack, mainTrackIds, elapsed, sessionStatus, volume, setVolume, startSession, stopSession, pauseSession, toggleGroup, openFilePicker, openNewGroup, chooseGroup, triggerEffect, lastEffect, updateGroupSetting, updateGroupVolume, updateGroupLimitMode, updateGroupLimitKind, updateGroupTimeLimit, updateGroupTimeLimitMax, updateGroupTimeLimitMode, updateGroupInterval, updateMainSessionSetting, updateMainDuration, endMode, setEndMode, timerParts, updateTimerPart, alarmTime, setAlarmTime, endRemaining, musicStatus, musicActiveTrack, musicActivePlaylist, canNavigateMusic, musicVolume, setMusicVolume, onMusicPlayPause, onMusicPrev, onMusicNext, musicTimerEndAt, musicTimerRemaining, showMusicStrip, clockNow, activateClockDisplay, scheduleMode, setScheduleMode, scheduleParts, updateSchedulePart, scheduleTime, setScheduleTime, scheduleRepeat, setScheduleRepeat, scheduleActive, scheduleEndAt, scheduleRemaining, startSchedule, cancelSchedule, savedTimers, savedAlarms, onSaveTimer, onDeleteTimer, onSaveAlarm, onDeleteAlarm } = props;
  const enabledEffects = effectGroups.filter((group) => group.enabled).length;
  const enabledEffectGroups = effectGroups.filter((group) => group.enabled);
  const effectWindow = enabledEffectGroups.length
    ? `${formatDuration(Math.min(...enabledEffectGroups.map((g) => g.minInterval)))}–${formatDuration(Math.max(...enabledEffectGroups.map((g) => g.maxInterval)))}`
    : 'No effect groups enabled';
  const [mainSoundsOpen, setMainSoundsOpen] = useState(true);
  const [effectsOpen, setEffectsOpen] = useState(true);
  const [startStopOpen, setStartStopOpen] = useState(true);
  const [recipeOpen, setRecipeOpen] = useState(true);
  return <div>
    <section className="page-intro"><div className="eyebrow">A softer way to end the day</div><h1>Make room for <em>quiet.</em></h1><p>Your sounds, arranged with a little intention. Set the room, press play, and let the edges of the day dissolve.</p></section>
    <div className="dashboard-grid">
      <section className={`session-card ${sessionStatus === 'idle' ? 'idle' : ''}`} aria-label="Current night session">
        {sessionStatus !== 'idle' && <div className="session-top"><div className={`session-status ${sessionStatus === 'paused' ? 'paused' : ''}`}>{sessionStatus === 'running' ? 'Listening now' : 'Session paused'}</div></div>}
        {sessionStatus === 'idle' && !activeTrack && (
          <button
            className="waiting-clock-button"
            onClick={activateClockDisplay}
            aria-label={`Show clock ${formatClockTime(clockNow, false, true, true)}`}
            title="Show clock now"
            data-testid="button-waiting-clock"
          >
            <span>{formatClockTime(clockNow, false, true, true)}</span>
          </button>
        )}
        <h2>{activeTrack ? activeTrack.name.replace(/\.[^.]+$/, '') : 'The room is waiting'}</h2>
        <div className="session-sub">{activeTrack ? (activeTrack.demo ? 'A preview from your night library' : 'Playing from your library') : 'Press play to begin'}</div>
        <div className={`wave ${sessionStatus !== 'running' ? 'paused' : ''}`} aria-label={sessionStatus === 'running' ? 'Sound is playing' : 'Sound is paused'} data-testid="status-waveform">{Array.from({ length: 15 }, (_, index) => <i key={index} />)}</div>
        <div className="session-controls">
          {sessionStatus === 'running' ? <button className="round-button" onClick={pauseSession} aria-label="Pause session" data-testid="button-pause-session"><Pause size={18} fill="currentColor" /></button> : <button className="round-button" onClick={startSession} aria-label={sessionStatus === 'paused' ? 'Resume session' : 'Start session'} data-testid="button-start-session"><Play size={18} fill="currentColor" /></button>}
          <button className="round-button stop" onClick={stopSession} aria-label="Stop session" data-testid="button-stop-session"><Square size={15} fill="currentColor" /></button>
          <div className="volume-wrap"><Volume2 size={15} /><input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Session volume" data-testid="input-session-volume" /><span>{volume}%</span></div>
        </div>
        {showMusicStrip && (
          <div className="home-music-strip">
            <div className="home-music-info">
              <ListMusic size={12} color="hsl(var(--primary))" />
              <div className="home-music-text">
                <span className="home-music-name">{musicActiveTrack ? musicActiveTrack.name.replace(/\.[^.]+$/, '') : 'Music player'}</span>
                {musicActivePlaylist && <span className="home-music-playlist">{musicActivePlaylist.name}</span>}
              </div>
            </div>
            <div className="home-music-right">
              <button className="icon-button home-music-btn" onClick={onMusicPrev} disabled={!canNavigateMusic} aria-label="Previous track" title="Previous"><SkipBack size={13} /></button>
              <button className="icon-button home-music-btn" onClick={onMusicPlayPause} disabled={!musicActiveTrack} aria-label={musicStatus === 'playing' ? 'Pause music' : 'Play music'}>
                {musicStatus === 'playing' ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
              </button>
              <button className="icon-button home-music-btn" onClick={onMusicNext} disabled={!canNavigateMusic} aria-label="Next track" title="Next"><SkipForward size={13} /></button>
              {musicTimerEndAt && (
                <span className="home-music-timer"><Timer size={11} />{formatAudioTime(musicTimerRemaining / 1000)}</span>
              )}
              <input type="range" className="home-music-vol" min="0" max="100" value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} aria-label="Music volume" />
              <span className="home-music-vol-label">{musicVolume}%</span>
            </div>
          </div>
        )}
        <SessionSchedulePanel scheduleMode={scheduleMode} setScheduleMode={setScheduleMode} scheduleParts={scheduleParts} updateSchedulePart={updateSchedulePart} scheduleTime={scheduleTime} setScheduleTime={setScheduleTime} scheduleRepeat={scheduleRepeat} setScheduleRepeat={setScheduleRepeat} scheduleActive={scheduleActive} scheduleEndAt={scheduleEndAt} scheduleRemaining={scheduleRemaining} startSchedule={startSchedule} cancelSchedule={cancelSchedule} sessionStatus={sessionStatus} savedTimers={savedTimers} savedAlarms={savedAlarms} onSaveTimer={onSaveTimer} onDeleteTimer={onDeleteTimer} onSaveAlarm={onSaveAlarm} onDeleteAlarm={onDeleteAlarm} />
        <SessionEndPanel sessionStatus={sessionStatus} endMode={endMode} setEndMode={setEndMode} timerParts={timerParts} updateTimerPart={updateTimerPart} alarmTime={alarmTime} setAlarmTime={setAlarmTime} endRemaining={endRemaining} savedTimers={savedTimers} savedAlarms={savedAlarms} onSaveTimer={onSaveTimer} onDeleteTimer={onDeleteTimer} onSaveAlarm={onSaveAlarm} onDeleteAlarm={onDeleteAlarm} />
      </section>
      <aside className="recipe-card">
        <button className="card-heading recipe-heading-toggle" onClick={() => setRecipeOpen((o) => !o)} aria-expanded={recipeOpen} aria-label={recipeOpen ? 'Collapse tonight\'s sounds' : 'Expand tonight\'s sounds'}>
          <div><div className="eyebrow">Active now</div><h3>Tonight&rsquo;s sounds</h3></div>
          <div className="recipe-heading-right"><Sparkles size={17} color="hsl(var(--primary))" /><ChevronDown size={15} className={`collapse-chevron${recipeOpen ? ' rotated' : ''}`} /></div>
        </button>
        {recipeOpen && <>
          <div className="recipe-list">
            {mainGroups.filter((g) => g.enabled).slice(0, 3).map((group) => <div key={group.id} className="recipe-row"><div className="recipe-icon" style={{ color: group.color }}><Headphones size={15} /></div><div className="recipe-copy"><strong>{group.name}</strong><span>{group.files.length} looping {group.files.length === 1 ? 'sound' : 'sounds'}</span></div><Check size={14} color="hsl(var(--primary))" /></div>)}
            {!mainGroups.some((g) => g.enabled) && <div className="recipe-row recipe-row-empty"><div className="recipe-copy"><span>No main sounds active yet</span></div></div>}
            <div className="recipe-line" />
            <div className="recipe-row"><div className="recipe-icon" style={{ color: 'hsl(var(--accent))' }}><Radio size={15} /></div><div className="recipe-copy"><strong>{enabledEffects} effect {enabledEffects === 1 ? 'group' : 'groups'}</strong><span>{effectWindow}</span></div><button className="quiet-button" onClick={triggerEffect} aria-label="Play an effect now" data-testid="button-trigger-effect"><MoreHorizontal size={17} /></button></div>
          </div>
          <div className="recipe-foot"><SlidersHorizontal size={14} /><span>{lastEffect === 'Waiting for a little weather' ? 'Effects will choose their own moment.' : `Last arrival \u00b7 ${lastEffect}`}</span></div>
        </>}
      </aside>
    </div>
    <section>
      <div className="section-head">
        <div className="section-title">
          <div className="eyebrow">The steady layer</div>
          <h2>Main sounds</h2>
          {mainSoundsOpen && <p>These hold the room open and loop until you say stop.</p>}
        </div>
        <div className="section-head-right">
          {!mainSoundsOpen && (
            <div className="sound-chips">
              {mainGroups.filter((g) => g.enabled).map((g) => (
                <span key={g.id} className="sound-chip"><span className="sound-chip-dot" style={{ background: g.color }} />{g.name}</span>
              ))}
            </div>
          )}
          <button className="quiet-button" onClick={() => openNewGroup('main')} data-testid="button-add-main-sound">Add</button>
          <button className="icon-button section-toggle" onClick={() => setMainSoundsOpen((o) => !o)} aria-label={mainSoundsOpen ? 'Collapse main sounds' : 'Expand main sounds'} aria-expanded={mainSoundsOpen}><ChevronDown size={16} className={`collapse-chevron${mainSoundsOpen ? ' rotated' : ''}`} /></button>
        </div>
      </div>
      {mainSoundsOpen && (
        <div className="group-cards">
          {mainGroups.map((group) => <SoundGroupCard key={group.id} group={group} selected={group.files.some((file) => mainTrackIds.includes(file.id))} toggleGroup={toggleGroup} chooseGroup={chooseGroup} updateGroupVolume={updateGroupVolume} updateMainSessionSetting={updateMainSessionSetting} updateMainDuration={updateMainDuration} />)}
          <button className="sound-card add-card" onClick={() => openNewGroup('main')} data-testid="button-add-main-card"><Plus size={18} /><span>Add a new sound group</span></button>
        </div>
      )}
    </section>
    <section>
      <div className="section-head">
        <div className="section-title">
          <div className="eyebrow">The little surprises</div>
          <h2>Effects</h2>
          {effectsOpen && <p>Randomized moments, bounded by your settings.</p>}
        </div>
        <div className="section-head-right">
          {!effectsOpen && enabledEffectGroups.length > 0 && (
            <div className="sound-chips">
              {enabledEffectGroups.map((g) => (
                <span key={g.id} className="sound-chip"><span className="sound-chip-dot" style={{ background: g.color ?? 'hsl(var(--accent))' }} />{g.name}</span>
              ))}
            </div>
          )}
          <button className="quiet-button" onClick={() => openNewGroup('effect')} data-testid="button-add-effect-sound">Add</button>
          <button className="icon-button section-toggle" onClick={() => setEffectsOpen((o) => !o)} aria-label={effectsOpen ? 'Collapse effects' : 'Expand effects'} aria-expanded={effectsOpen}><ChevronDown size={16} className={`collapse-chevron${effectsOpen ? ' rotated' : ''}`} /></button>
        </div>
      </div>
      {effectsOpen && (
        <div className="effects-grid">
          {effectGroups.map((group) => <EffectGroupCard key={group.id} group={group} toggleGroup={toggleGroup} chooseGroup={chooseGroup} updateGroupSetting={updateGroupSetting} updateGroupVolume={updateGroupVolume} updateGroupLimitMode={updateGroupLimitMode} updateGroupLimitKind={updateGroupLimitKind} updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax} updateGroupTimeLimitMode={updateGroupTimeLimitMode} updateGroupInterval={updateGroupInterval} />)}
          {!effectGroups.length && <div className="empty-panel"><Music2 size={20} /><h3>No effects yet</h3><p>Build a group for the sounds that should visit only once in a while.</p><button className="primary-button" onClick={() => openFilePicker()} data-testid="button-add-first-effect">Add MP3 / WAV</button></div>}
        </div>
      )}
    </section>
    <section>
      <div className="section-head">
        <div className="section-title">
          <div className="eyebrow">The gentle transitions</div>
          <h2>Start/Stop groups</h2>
          {startStopOpen && <p>Opening, looping, and closing sounds that arrive as one sequence.</p>}
        </div>
        <div className="section-head-right">
          {!startStopOpen && startStopGroups.filter((g) => g.enabled).length > 0 && (
            <div className="sound-chips">
              {startStopGroups.filter((g) => g.enabled).map((g) => (
                <span key={g.id} className="sound-chip"><span className="sound-chip-dot" style={{ background: g.color }} />{g.name}</span>
              ))}
            </div>
          )}
          <button className="quiet-button" onClick={() => openNewGroup('startStop')} data-testid="button-add-start-stop-group">Add</button>
          <button className="icon-button section-toggle" onClick={() => setStartStopOpen((o) => !o)} aria-label={startStopOpen ? 'Collapse Start/Stop groups' : 'Expand Start/Stop groups'} aria-expanded={startStopOpen}><ChevronDown size={16} className={`collapse-chevron${startStopOpen ? ' rotated' : ''}`} /></button>
        </div>
      </div>
      {startStopOpen && (
        <div className="effects-grid">
          {startStopGroups.map((group) => <StartStopGroupCard key={group.id} group={group} toggleGroup={toggleGroup} chooseGroup={chooseGroup} updateGroupVolume={updateGroupVolume} />)}
          {!startStopGroups.length && <div className="empty-panel"><Play size={20} /><h3>No Start/Stop groups yet</h3><p>Build a three-part sequence for a softer entrance or exit.</p><button className="primary-button" onClick={() => openNewGroup('startStop')} data-testid="button-add-first-start-stop-group">Create a Start/Stop group</button></div>}
        </div>
      )}
    </section>
    <div style={{ display: 'none' }}>{groups.length}</div>
  </div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// TimePickerModal — touch/mouse popup for selecting a clock time (no keyboard)
// ─────────────────────────────────────────────────────────────────────────────

function TimePickerModal({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const parseTime = (v: string) => {
    const [hStr = '7', mStr = '0'] = (v || '07:00').split(':');
    const h24 = Math.max(0, Math.min(23, parseInt(hStr, 10) || 0));
    const m   = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
    const ampm: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 || 12;
    // snap minute to nearest 5-min mark for initial highlight
    const mSnap = Math.round(m / 5) * 5 % 60;
    return { h12, m: mSnap, ampm };
  };
  const init = parseTime(value);
  const [hour,   setHour]   = useState(init.h12);
  const [minute, setMinute] = useState(init.m);
  const [ampm,   setAmPm]   = useState<'AM' | 'PM'>(init.ampm);

  const toHHMM = (h: number, m: number, a: 'AM' | 'PM') => {
    let h24 = h;
    if (a === 'PM' && h !== 12) h24 += 12;
    if (a === 'AM' && h === 12) h24 = 0;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const HOURS   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const handleConfirm = () => { onChange(toHHMM(hour, minute, ampm)); onClose(); };

  return ReactDOM.createPortal(
    <div className="time-picker-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="time-picker-modal" role="dialog" aria-label="Set time" aria-modal="true">
        {/* Preview */}
        <div className="time-picker-preview">
          <span className="time-picker-time">{hour}:{String(minute).padStart(2, '0')}</span>
          <div className="time-picker-ampm-group">
            <button className={`tp-ampm${ampm === 'AM' ? ' sel' : ''}`} onClick={() => setAmPm('AM')}>AM</button>
            <button className={`tp-ampm${ampm === 'PM' ? ' sel' : ''}`} onClick={() => setAmPm('PM')}>PM</button>
          </div>
        </div>
        {/* Hour + Minute grids side by side */}
        <div className="time-picker-cols">
          <div className="time-picker-col">
            <div className="tp-col-label">Hour</div>
            <div className="tp-grid tp-grid-hours">
              {HOURS.map((h) => (
                <button key={h} className={`tp-cell${hour === h ? ' sel' : ''}`} onClick={() => setHour(h)}>{h}</button>
              ))}
            </div>
          </div>
          <div className="time-picker-col">
            <div className="tp-col-label">Minute</div>
            <div className="tp-grid tp-grid-mins">
              {MINUTES.map((m) => (
                <button key={m} className={`tp-cell${minute === m ? ' sel' : ''}`} onClick={() => setMinute(m)}>{String(m).padStart(2, '0')}</button>
              ))}
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="time-picker-actions">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={handleConfirm}>Set time</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SpinnerField — touch-friendly +/− stepper for a single time unit
// ─────────────────────────────────────────────────────────────────────────────

function SpinnerField({ value, min, max, onChange, label, disabled = false }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const [draftValue, setDraftValue] = useState(String(value));
  const holdRef = useRef<number | null>(null);
  const repeatRef = useRef<number | null>(null);
  const clearTimers = () => {
    if (holdRef.current !== null) { clearTimeout(holdRef.current); holdRef.current = null; }
    if (repeatRef.current !== null) { clearInterval(repeatRef.current); repeatRef.current = null; }
  };
  useEffect(() => clearTimers, []);
  useEffect(() => { setDraftValue(String(value)); }, [value]);
  const stepValue = (dir: 1 | -1) => {
    const next = Math.max(min, Math.min(max, valueRef.current + dir));
    if (next !== valueRef.current) onChange(next);
  };
  const commitDraftValue = () => {
    const trimmed = draftValue.trim();
    if (!trimmed) { setDraftValue(String(value)); return; }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) { setDraftValue(String(value)); return; }
    onChange(Math.max(min, Math.min(max, Math.trunc(parsed))));
  };
  const startHold = (dir: 1 | -1) => {
    const step = () => stepValue(dir);
    step();
    holdRef.current = window.setTimeout(() => { repeatRef.current = window.setInterval(step, 80); }, 450);
  };
  const handleValueKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); stepValue(-1); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); stepValue(1); }
    if (event.key === 'Enter') { event.preventDefault(); commitDraftValue(); event.currentTarget.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); setDraftValue(String(value)); event.currentTarget.blur(); }
  };
  return (
    <div className="spinner-field">
      <button type="button" className="spinner-btn" onPointerDown={(event) => { if (!disabled && event.button === 0) { event.currentTarget.setPointerCapture?.(event.pointerId); startHold(-1); } }} onPointerUp={clearTimers} onPointerCancel={clearTimers} onPointerLeave={clearTimers} onClick={(event) => { if (event.detail === 0) stepValue(-1); }} disabled={disabled || value <= min} aria-label={`Decrease ${label}`}>−</button>
      <div className="spinner-value">
        <input type="number" className="spinner-num spinner-input" value={draftValue} min={min} max={max} step={1} inputMode="numeric" disabled={disabled} aria-label={`${label} value`} aria-valuenow={value} onChange={(event) => setDraftValue(event.target.value)} onBlur={commitDraftValue} onKeyDown={handleValueKeyDown} />
        <span className="spinner-label">{label}</span>
      </div>
      <button type="button" className="spinner-btn" onPointerDown={(event) => { if (!disabled && event.button === 0) { event.currentTarget.setPointerCapture?.(event.pointerId); startHold(1); } }} onPointerUp={clearTimers} onPointerCancel={clearTimers} onPointerLeave={clearTimers} onClick={(event) => { if (event.detail === 0) stepValue(1); }} disabled={disabled || value >= max} aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionEndPanel
// ─────────────────────────────────────────────────────────────────────────────

type SessionEndPanelProps = {
  sessionStatus: SessionStatus; endMode: EndMode; setEndMode: (mode: EndMode) => void;
  timerParts: TimerParts; updateTimerPart: (unit: keyof TimerParts, value: number) => void;
  alarmTime: string; setAlarmTime: (value: string) => void;
  endRemaining: number;
  savedTimers: TimerParts[]; savedAlarms: string[];
  onSaveTimer: (t: TimerParts) => void; onDeleteTimer: (idx: number) => void;
  onSaveAlarm: (a: string) => void; onDeleteAlarm: (idx: number) => void;
};

function SessionEndPanel({ sessionStatus, endMode, setEndMode, timerParts, updateTimerPart, alarmTime, setAlarmTime, endRemaining, savedTimers, savedAlarms, onSaveTimer, onDeleteTimer, onSaveAlarm, onDeleteAlarm }: SessionEndPanelProps) {
  const [open, setOpen] = useState(false);
  const [showCustomTimer, setShowCustomTimer] = useState(savedTimers.length === 0);
  const [showCustomAlarm, setShowCustomAlarm] = useState(savedAlarms.length === 0);
  const [alarmPickerOpen, setAlarmPickerOpen] = useState(false);
  // When last preset deleted, reveal custom input automatically
  useEffect(() => { if (savedTimers.length === 0) setShowCustomTimer(true); }, [savedTimers.length]);
  useEffect(() => { if (savedAlarms.length === 0) setShowCustomAlarm(true); }, [savedAlarms.length]);

  const activeSchedule = sessionStatus !== 'idle' && endRemaining > 0;
  const timerMs = timerPartsToMilliseconds(timerParts);
  const alarmChip = formatAlarmChip(alarmTime);
  const summary = endMode === 'timer'
    ? (activeSchedule ? `Ends in ${formatDurationNoMs(endRemaining)}` : formatDurationNoMs(timerMs))
    : endMode === 'alarm' ? (alarmTime ? (activeSchedule ? `Ends at ${alarmChip}` : `At ${alarmChip}`) : '') : '';

  const timerAlreadySaved = savedTimers.some((t) => timerPartsEqual(t, timerParts));
  const alarmAlreadySaved = savedAlarms.includes(alarmTime);

  return (
    <div className={`session-end-card${open ? ' sec-open' : ''}`} aria-label="Automatic session ending">
      <button className="session-end-heading collapse-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div><div className="eyebrow">Close the room gently</div><h3>Automatic ending</h3></div>
        <div className="collapse-right">
          {!open && summary && <span className={`collapse-summary${activeSchedule ? ' active' : ''}`}>{summary}</span>}
          <ChevronDown size={15} className={`collapse-chevron${open ? ' rotated' : ''}`} />
          <AlarmClock size={18} color="hsl(var(--accent))" />
        </div>
      </button>
      {open && (
        <div className="collapse-body">
          <div className="end-mode-buttons" role="group" aria-label="Session ending mode">
            <button className={`end-mode-button ${endMode === 'none' ? 'selected' : ''}`} onClick={() => setEndMode('none')} aria-pressed={endMode === 'none'} data-testid="button-end-mode-none"><span>Manual</span><small>Stop it yourself</small></button>
            <button className={`end-mode-button ${endMode === 'timer' ? 'selected' : ''}`} onClick={() => setEndMode('timer')} aria-pressed={endMode === 'timer'} data-testid="button-end-mode-timer"><Timer size={15} /><span>Timer</span><small>Run for a duration</small></button>
            <button className={`end-mode-button ${endMode === 'alarm' ? 'selected' : ''}`} onClick={() => setEndMode('alarm')} aria-pressed={endMode === 'alarm'} data-testid="button-end-mode-alarm"><AlarmClock size={15} /><span>Alarm</span><small>End at a clock time</small></button>
          </div>

          {endMode === 'timer' && (
            <div className="end-option">
              {/* Saved preset chips */}
              {savedTimers.length > 0 && (
                <div className="preset-chips" role="group" aria-label="Saved timers">
                  {savedTimers.map((t, i) => (
                    <div key={i} className={`preset-chip${timerPartsEqual(t, timerParts) && !showCustomTimer ? ' active' : ''}`}>
                      <button className="preset-chip-label" onClick={() => { updateTimerPart('hours', t.hours); updateTimerPart('minutes', t.minutes); updateTimerPart('seconds', t.seconds); updateTimerPart('milliseconds', t.milliseconds); setShowCustomTimer(false); }} data-testid={`button-saved-timer-${i}`}>{formatTimerChip(t)}</button>
                      <button className="preset-chip-delete" onClick={() => onDeleteTimer(i)} aria-label={`Remove ${formatTimerChip(t)}`}>×</button>
                    </div>
                  ))}
                  <button className={`preset-chip-add${showCustomTimer ? ' active' : ''}`} onClick={() => setShowCustomTimer((v) => !v)} data-testid="button-custom-timer">
                    <Plus size={11} /><span>Custom</span>
                  </button>
                </div>
              )}
              {/* Spinner inputs (shown when no presets or Custom selected) */}
              {(showCustomTimer || savedTimers.length === 0) && (
                <div className="spinner-row">
                  <SpinnerField value={timerParts.hours} min={0} max={999} label="hr" onChange={(v) => updateTimerPart('hours', v)} />
                  <SpinnerField value={timerParts.minutes} min={0} max={59} label="min" onChange={(v) => updateTimerPart('minutes', v)} />
                  <SpinnerField value={timerParts.seconds} min={0} max={59} label="sec" onChange={(v) => updateTimerPart('seconds', v)} />
                  {savedTimers.length < MAX_SAVED_PRESETS && timerMs > 0 && !timerAlreadySaved && (
                    <button className="preset-save-btn" onClick={() => { onSaveTimer(timerParts); setShowCustomTimer(false); }} aria-label="Save this timer" data-testid="button-save-timer">
                      <Bookmark size={12} /><span>Save</span>
                    </button>
                  )}
                </div>
              )}
              <p className="end-option-hint">Session length: <strong>{formatDuration(timerMs)}</strong></p>
            </div>
          )}

          {endMode === 'alarm' && (
            <div className="end-option">
              {/* Saved alarm chips */}
              {savedAlarms.length > 0 && (
                <div className="preset-chips" role="group" aria-label="Saved alarms">
                  {savedAlarms.map((a, i) => (
                    <div key={i} className={`preset-chip${alarmTime === a && !showCustomAlarm ? ' active' : ''}`}>
                      <button className="preset-chip-label" onClick={() => { setAlarmTime(a); setShowCustomAlarm(false); }} data-testid={`button-saved-alarm-${i}`}>{formatAlarmChip(a)}</button>
                      <button className="preset-chip-delete" onClick={() => onDeleteAlarm(i)} aria-label={`Remove ${formatAlarmChip(a)}`}>×</button>
                    </div>
                  ))}
                  <button className={`preset-chip-add${showCustomAlarm ? ' active' : ''}`} onClick={() => setShowCustomAlarm((v) => !v)} data-testid="button-custom-alarm">
                    <Plus size={11} /><span>Custom</span>
                  </button>
                </div>
              )}
              {/* Time picker (shown when no presets or Custom selected) */}
              {(showCustomAlarm || savedAlarms.length === 0) && (
                <div className="alarm-custom-row">
                  <span className="alarm-custom-label">End at</span>
                  <button className="alarm-time-trigger" onClick={() => setAlarmPickerOpen(true)} aria-label="Set alarm time" data-testid="button-alarm-time-trigger">
                    <Clock size={13} />
                    <span>{alarmTime ? formatAlarmChip(alarmTime) : 'Set time…'}</span>
                  </button>
                  {alarmPickerOpen && <TimePickerModal value={alarmTime} onChange={setAlarmTime} onClose={() => setAlarmPickerOpen(false)} />}
                  {savedAlarms.length < MAX_SAVED_PRESETS && alarmTime && !alarmAlreadySaved && (
                    <button className="preset-save-btn" onClick={() => { onSaveAlarm(alarmTime); setShowCustomAlarm(false); }} aria-label="Save this alarm time" data-testid="button-save-alarm">
                      <Bookmark size={12} /><span>Save</span>
                    </button>
                  )}
                </div>
              )}
              <p className="end-option-hint">The next occurrence of this time will end the session.</p>
            </div>
          )}

          <div className={`end-status ${activeSchedule ? 'active' : ''}`} role="status"><span className="end-status-dot" />{activeSchedule ? `${sessionStatus === 'paused' ? 'Paused' : 'Active'} \u00b7 ends in ${formatDuration(endRemaining)}` : endMode === 'none' ? 'No automatic ending set.' : 'This ending rule will apply when you start the session.'}</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionSchedulePanel
// ─────────────────────────────────────────────────────────────────────────────

type SessionSchedulePanelProps = {
  scheduleMode: ScheduleMode; setScheduleMode: (m: ScheduleMode) => void;
  scheduleParts: TimerParts; updateSchedulePart: (unit: keyof TimerParts, value: number) => void;
  scheduleTime: string; setScheduleTime: (t: string) => void;
  scheduleRepeat: boolean; setScheduleRepeat: (r: boolean) => void;
  scheduleActive: boolean; scheduleEndAt: number | null; scheduleRemaining: number;
  startSchedule: () => void; cancelSchedule: () => void;
  sessionStatus: SessionStatus;
  savedTimers: TimerParts[]; savedAlarms: string[];
  onSaveTimer: (t: TimerParts) => void; onDeleteTimer: (idx: number) => void;
  onSaveAlarm: (a: string) => void; onDeleteAlarm: (idx: number) => void;
};

function SessionSchedulePanel({ scheduleMode, setScheduleMode, scheduleParts, updateSchedulePart, scheduleTime, setScheduleTime, scheduleRepeat, setScheduleRepeat, scheduleActive, scheduleEndAt, scheduleRemaining, startSchedule, cancelSchedule, sessionStatus, savedTimers, savedAlarms, onSaveTimer, onDeleteTimer, onSaveAlarm, onDeleteAlarm }: SessionSchedulePanelProps) {
  const [open, setOpen] = useState(false);
  const [showCustomTimer, setShowCustomTimer] = useState(savedTimers.length === 0);
  const [showCustomAlarm, setShowCustomAlarm] = useState(savedAlarms.length === 0);
  const [schedPickerOpen, setSchedPickerOpen] = useState(false);
  useEffect(() => { if (savedTimers.length === 0) setShowCustomTimer(true); }, [savedTimers.length]);
  useEffect(() => { if (savedAlarms.length === 0) setShowCustomAlarm(true); }, [savedAlarms.length]);

  const isRunning = scheduleActive && sessionStatus === 'idle';
  const scheduleDuration = scheduleParts.hours * HOUR_MS + scheduleParts.minutes * MINUTE_MS + scheduleParts.seconds * SECOND_MS;
  const scheduleChip = formatAlarmChip(scheduleTime);
  const summary = scheduleMode === 'countdown'
    ? (isRunning ? `Starting in ${formatDurationNoMs(scheduleRemaining)}` : (scheduleDuration > 0 ? formatDurationNoMs(scheduleDuration) : ''))
    : scheduleMode === 'time' ? (scheduleTime ? (isRunning ? `Starting at ${scheduleChip}` : `${scheduleChip}${scheduleRepeat ? ' · daily' : ''}`) : '') : '';

  const timerAlreadySaved = savedTimers.some((t) => timerPartsEqual(t, scheduleParts));
  const alarmAlreadySaved = savedAlarms.includes(scheduleTime);

  return (
    <div className={`session-end-card${open ? ' sec-open' : ''}`} aria-label="Scheduled session start">
      <button className="session-end-heading collapse-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div><div className="eyebrow">Begin automatically</div><h3>Schedule start</h3></div>
        <div className="collapse-right">
          {!open && summary && <span className={`collapse-summary${isRunning ? ' active' : ''}`}>{summary}</span>}
          <ChevronDown size={15} className={`collapse-chevron${open ? ' rotated' : ''}`} />
          <Clock size={18} color="hsl(var(--primary))" />
        </div>
      </button>
      {open && (
        <div className="collapse-body">
          <div className="end-mode-buttons" role="group" aria-label="Schedule mode">
            <button className={`end-mode-button ${scheduleMode === 'off' ? 'selected' : ''}`} onClick={() => { setScheduleMode('off'); cancelSchedule(); }} aria-pressed={scheduleMode === 'off'} data-testid="button-schedule-off"><span>Off</span><small>Start manually</small></button>
            <button className={`end-mode-button ${scheduleMode === 'countdown' ? 'selected' : ''}`} onClick={() => setScheduleMode('countdown')} aria-pressed={scheduleMode === 'countdown'} data-testid="button-schedule-countdown"><Timer size={15} /><span>Countdown</span><small>Start after a delay</small></button>
            <button className={`end-mode-button ${scheduleMode === 'time' ? 'selected' : ''}`} onClick={() => setScheduleMode('time')} aria-pressed={scheduleMode === 'time'} data-testid="button-schedule-time"><Clock size={15} /><span>At time</span><small>Start at a specific time</small></button>
          </div>

          {scheduleMode === 'countdown' && (
            <div className="end-option">
              {savedTimers.length > 0 && (
                <div className="preset-chips" role="group" aria-label="Saved countdown delays">
                  {savedTimers.map((t, i) => (
                    <div key={i} className={`preset-chip${timerPartsEqual(t, scheduleParts) && !showCustomTimer ? ' active' : ''}`}>
                      <button className="preset-chip-label" onClick={() => { updateSchedulePart('hours', t.hours); updateSchedulePart('minutes', t.minutes); updateSchedulePart('seconds', t.seconds); setShowCustomTimer(false); }} data-testid={`button-saved-sched-timer-${i}`}>{formatTimerChip(t)}</button>
                      <button className="preset-chip-delete" onClick={() => onDeleteTimer(i)} aria-label={`Remove ${formatTimerChip(t)}`}>×</button>
                    </div>
                  ))}
                  <button className={`preset-chip-add${showCustomTimer ? ' active' : ''}`} onClick={() => setShowCustomTimer((v) => !v)} data-testid="button-custom-sched-timer">
                    <Plus size={11} /><span>Custom</span>
                  </button>
                </div>
              )}
              {(showCustomTimer || savedTimers.length === 0) && (
                <div className="spinner-row">
                  <SpinnerField value={scheduleParts.hours} min={0} max={23} label="hr" onChange={(v) => updateSchedulePart('hours', v)} disabled={isRunning} />
                  <SpinnerField value={scheduleParts.minutes} min={0} max={59} label="min" onChange={(v) => updateSchedulePart('minutes', v)} disabled={isRunning} />
                  <SpinnerField value={scheduleParts.seconds} min={0} max={59} label="sec" onChange={(v) => updateSchedulePart('seconds', v)} disabled={isRunning} />
                  {!isRunning && savedTimers.length < MAX_SAVED_PRESETS && scheduleDuration > 0 && !timerAlreadySaved && (
                    <button className="preset-save-btn" onClick={() => { onSaveTimer(scheduleParts); setShowCustomTimer(false); }} aria-label="Save this delay">
                      <Bookmark size={12} /><span>Save</span>
                    </button>
                  )}
                </div>
              )}
              <div className="sched-actions">
                {isRunning
                  ? <><span className="schedule-remaining">{formatDurationNoMs(scheduleRemaining)}</span><button className="quiet-button" onClick={cancelSchedule} data-testid="button-cancel-schedule">Cancel</button></>
                  : <button className="quiet-button" onClick={startSchedule} disabled={sessionStatus !== 'idle'} data-testid="button-start-schedule">Schedule</button>
                }
              </div>
            </div>
          )}

          {scheduleMode === 'time' && (
            <div className="end-option">
              {savedAlarms.length > 0 && (
                <div className="preset-chips" role="group" aria-label="Saved start times">
                  {savedAlarms.map((a, i) => (
                    <div key={i} className={`preset-chip${scheduleTime === a && !showCustomAlarm ? ' active' : ''}`}>
                      <button className="preset-chip-label" onClick={() => { setScheduleTime(a); setShowCustomAlarm(false); }} data-testid={`button-saved-sched-alarm-${i}`}>{formatAlarmChip(a)}</button>
                      <button className="preset-chip-delete" onClick={() => onDeleteAlarm(i)} aria-label={`Remove ${formatAlarmChip(a)}`}>×</button>
                    </div>
                  ))}
                  <button className={`preset-chip-add${showCustomAlarm ? ' active' : ''}`} onClick={() => setShowCustomAlarm((v) => !v)} data-testid="button-custom-sched-alarm">
                    <Plus size={11} /><span>Custom</span>
                  </button>
                </div>
              )}
              {(showCustomAlarm || savedAlarms.length === 0) && (
                <div className="alarm-custom-row">
                  <span className="alarm-custom-label">Start at</span>
                  <button className="alarm-time-trigger" onClick={() => { if (!isRunning) setSchedPickerOpen(true); }} disabled={isRunning} aria-label="Set start time" data-testid="button-sched-time-trigger">
                    <Clock size={13} />
                    <span>{scheduleTime ? formatAlarmChip(scheduleTime) : 'Set time…'}</span>
                  </button>
                  {schedPickerOpen && <TimePickerModal value={scheduleTime} onChange={setScheduleTime} onClose={() => setSchedPickerOpen(false)} />}
                  {!isRunning && savedAlarms.length < MAX_SAVED_PRESETS && scheduleTime && !alarmAlreadySaved && (
                    <button className="preset-save-btn" onClick={() => { onSaveAlarm(scheduleTime); setShowCustomAlarm(false); }} aria-label="Save this start time">
                      <Bookmark size={12} /><span>Save</span>
                    </button>
                  )}
                </div>
              )}
              <div className="alarm-custom-row" style={{ marginTop: 6 }}>
                <label className="settings-toggle">
                  <input type="checkbox" checked={scheduleRepeat} onChange={(e) => setScheduleRepeat(e.target.checked)} disabled={isRunning} data-testid="toggle-schedule-repeat" />
                  <span>Repeat daily</span>
                </label>
                <div style={{ marginLeft: 'auto' }}>
                  {isRunning
                    ? <button className="quiet-button" onClick={cancelSchedule} data-testid="button-cancel-schedule-time">Cancel</button>
                    : <button className="quiet-button" onClick={startSchedule} disabled={sessionStatus !== 'idle'} data-testid="button-start-schedule-time">Schedule</button>
                  }
                </div>
              </div>
            </div>
          )}

          <div className={`end-status ${isRunning ? 'active' : ''}`} role="status">
            <span className="end-status-dot" />
            {isRunning
              ? scheduleMode === 'countdown'
                ? `Starting in ${formatDurationNoMs(scheduleRemaining)}`
                : `Waiting for ${scheduleChip}${scheduleRepeat ? ' · repeats daily' : ''}`
              : scheduleMode === 'off'
                ? 'No scheduled start — you\'ll press play yourself.'
                : 'This schedule will activate when you configure it and click Schedule.'
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NightModeOverlay — full-screen dim with collapsible left control panel
// ─────────────────────────────────────────────────────────────────────────────

type NightModeOverlayProps = {
  active: boolean;
  isAlarming: boolean;
  alarmPulseActive: boolean;
  endMode: EndMode;
  endRemaining: number;
  alarmTime: string;
  elapsed: number;
  textColor: string;
  setTextColor: (color: string) => void;
  now: Date;
  stopSession: () => void;
  onSnooze: () => void;
  snoozeMins: number;
  snoozeSecs: number;
  showDate: boolean;
  showSeconds: boolean;
  hour12: boolean;
  showAmPm: boolean;
  groups: SoundGroup[];
  updateGroupVolume: (id: string, vol: number) => void;
  toggleGroup: (id: string) => void;
  clockFont: string;
  setClockFont: (f: string) => void;
  dimEnabled: boolean;
  dimDelaySecs: number;
  dimColor: string;
  dimShowClock: boolean;
  dimShowDate: boolean;
  dimShowSeconds: boolean;
  dimShowAmPm: boolean;
  dimBrightness: number;
  flashlightBrightness: number;
  setFlashlightBrightness: (value: number) => void;
  showStopwatch: boolean;
  osDimEnabled: boolean;
  osSleepEnabled: boolean;
  osSleepDelaySecs: number;
  onToggleDim: () => void;
};

function NightModeOverlay({ active, isAlarming, alarmPulseActive, endMode, endRemaining, alarmTime, elapsed, textColor, setTextColor, now, stopSession, onSnooze, snoozeMins, snoozeSecs, showDate, showSeconds, hour12, showAmPm, groups, updateGroupVolume, toggleGroup, clockFont, setClockFont, dimEnabled, dimDelaySecs, dimColor, dimShowClock, dimShowDate, dimShowSeconds, dimShowAmPm, dimBrightness, flashlightBrightness, setFlashlightBrightness, showStopwatch, osDimEnabled, osSleepEnabled, osSleepDelaySecs, onToggleDim }: NightModeOverlayProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [mouseHoveringFlashlight, setMouseHoveringFlashlight] = useState(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osSleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDimmedRef = useRef(false);

  // Restart the 5-minute panel inactivity countdown.
  const resetPanelAutoClose = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => setPanelOpen(false), 5 * 60 * 1000);
  };

  // Auto-close panel when session ends.
  useEffect(() => {
    if (!active) {
      setPanelOpen(false);
      setFlashlightOn(false);
    }
  }, [active]);

  // Flashlight mode is an uncluttered reading state: close and hide the
  // controls while it is on, then restore the menu button when it turns off.
  useEffect(() => {
    if (flashlightOn) setPanelOpen(false);
  }, [flashlightOn]);

  // Hide the page scrollbar while the night overlay is active so OS-level
  // scrollbars (Windows / Ubuntu always-visible style) don't bleed through.
  useEffect(() => {
    document.body.style.overflow = active ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);

  // Keep Chromium awake for the active, visible Night UI. When the user has
  // allowed OS dimming, release the lock only after our UI is dimmed and the
  // flashlight is off, so the operating system can take over at that point.
  useEffect(() => {
    const canLetOsDim = active && osDimEnabled && isDimmed && !flashlightOn;
    if (!active || canLetOsDim) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (!nav.wakeLock) return;

    let lock: { release: () => Promise<void>; addEventListener: (event: string, callback: () => void) => void } | null = null;
    let cancelled = false;
    const acquire = () => {
      if (cancelled) return;
      nav.wakeLock.request('screen')
        .then((nextLock: typeof lock) => {
          if (cancelled) { void nextLock?.release(); return; }
          lock = nextLock;
          nextLock?.addEventListener('release', () => { if (!cancelled) acquire(); });
        })
        .catch(() => { /* unsupported or permission denied */ });
    };

    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    acquire();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active, isDimmed, flashlightOn, osDimEnabled]);

  // Start/clear the panel inactivity timer as the panel opens and closes.
  useEffect(() => {
    if (panelOpen) {
      resetPanelAutoClose();
    } else {
      if (autoCloseTimerRef.current) { clearTimeout(autoCloseTimerRef.current); autoCloseTimerRef.current = null; }
    }
    return () => { if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current); };
  }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start/reset dim timer when session starts, stops, or dim settings change.
  useEffect(() => {
    if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
    isDimmedRef.current = false;
    setIsDimmed(false);
    if (active && dimEnabled && !flashlightOn) {
      dimTimerRef.current = setTimeout(() => {
        isDimmedRef.current = true;
        setIsDimmed(true);
        setPanelOpen(false);
      }, dimDelaySecs * 1000);
    }
    return () => { if (dimTimerRef.current) clearTimeout(dimTimerRef.current); };
  }, [active, dimEnabled, dimDelaySecs, flashlightOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Best-effort handoff for installed desktop wrappers. A normal PWA has no
  // OS display-sleep API, so an absent bridge is intentionally a no-op.
  useEffect(() => {
    if (osSleepTimerRef.current) clearTimeout(osSleepTimerRef.current);
    if (!active || !isDimmed || flashlightOn || !osSleepEnabled) return;
    osSleepTimerRef.current = setTimeout(() => {
      void requestOsDisplaySleep();
      osSleepTimerRef.current = null;
    }, osSleepDelaySecs * 1000);
    return () => {
      if (osSleepTimerRef.current) {
        clearTimeout(osSleepTimerRef.current);
        osSleepTimerRef.current = null;
      }
    };
  }, [active, isDimmed, flashlightOn, osSleepEnabled, osSleepDelaySecs]);

  // Wake from dim when alarm fires.
  useEffect(() => {
    if (isAlarming) {
      isDimmedRef.current = false;
      setIsDimmed(false);
      if (dimTimerRef.current) { clearTimeout(dimTimerRef.current); dimTimerRef.current = null; }
    }
  }, [isAlarming]);

  // Any user activity (move, click, tap) wakes the display and restarts the dim timer.
  const handleActivity = () => {
    if (isDimmedRef.current) {
      isDimmedRef.current = false;
      setIsDimmed(false);
    }
    if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
    if (osSleepTimerRef.current) { clearTimeout(osSleepTimerRef.current); osSleepTimerRef.current = null; }
    if (dimEnabled && active && !flashlightOn) {
      dimTimerRef.current = setTimeout(() => {
        isDimmedRef.current = true;
        setIsDimmed(true);
        setPanelOpen(false);
      }, dimDelaySecs * 1000);
    }
  };

  const endingLabel = isAlarming
    ? 'Alarm ringing'
    : endMode === 'timer'
    ? `Timer \u00b7 ${formatDurationNoMs(endRemaining)} remaining`
    : endMode === 'alarm' ? `Alarm \u00b7 ${alarmTime || 'not set'}` : 'Manual stop';

  const controllableGroups = groups.filter((g) => g.files.length > 0);

  return <div
    className={`night-mode-overlay ${active ? 'active' : ''} ${panelOpen ? 'panel-open' : ''} ${isDimmed ? 'dimmed' : ''} ${flashlightOn ? 'flashlight-on' : ''}`}
    aria-hidden={!active}
    style={{ '--night-text-color': isDimmed ? dimColor : textColor, '--flashlight-opacity': flashlightOn ? 0.08 + (flashlightBrightness / 100) * 0.82 : 0 } as CSSProperties}
    onMouseMove={handleActivity}
    onClick={handleActivity}
    onTouchStart={handleActivity}
  >

    {/* ── Background pulse when alarming ─────────────────────────── */}
    {alarmPulseActive && !isDimmed && (
      <div className="alarm-pulse-overlay" style={{ backgroundColor: textColor }} aria-hidden="true" />
    )}

    {/* ── Left control panel — hidden while dimmed ─────────────────── */}
    {!isDimmed && !flashlightOn && (
      <div className={`night-panel ${panelOpen ? 'open' : ''}`} aria-label="Night controls" role="region">
        <button
          className="night-panel-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          tabIndex={active ? 0 : -1}
          aria-label={panelOpen ? 'Close night controls' : 'Open night controls'}
          aria-expanded={panelOpen}
          data-testid="button-night-panel-toggle"
        >
          {panelOpen ? <X size={18} /> : <Menu size={20} />}
        </button>

        <div className="night-panel-body" aria-hidden={!panelOpen} onPointerMove={() => { resetPanelAutoClose(); handleActivity(); }} onClick={() => { resetPanelAutoClose(); handleActivity(); }}>
            <div className="night-panel-section">
              <div className="night-panel-vol-name">
                <Moon size={12} />
                <span className="night-panel-label" style={{margin:0}}>Auto-dim</span>
                <button
                  className={`night-panel-group-toggle ${dimEnabled ? 'on' : ''}`}
                  onClick={onToggleDim}
                  tabIndex={active && panelOpen ? 0 : -1}
                  aria-label={dimEnabled ? 'Turn off auto-dim' : 'Turn on auto-dim'}
                  aria-pressed={dimEnabled}
                  data-testid="button-night-dim-toggle"
                ><span /></button>
              </div>
            </div>
            <div className="night-panel-section">
              <div className="night-panel-label">Clock font</div>
                <select className="night-font-select" value={clockFont} onChange={(e) => setClockFont(e.target.value)} tabIndex={active && panelOpen ? 0 : -1} aria-label="Clock font" data-testid="select-clock-font">
                {CLOCK_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="night-panel-section">
              <div className="night-panel-label">Text color</div>
              <div className="night-panel-colors">
                {NIGHT_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`night-panel-swatch ${textColor === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setTextColor(color)}
                    tabIndex={active && panelOpen ? 0 : -1}
                    aria-label={`Night text color ${color}`}
                    aria-pressed={textColor === color}
                    data-testid={`button-night-panel-color-${color.replace('#', '')}`}
                  >
                    {textColor === color && <Check size={11} color="#1b1823" />}
                  </button>
                ))}
              </div>
            </div>

            {controllableGroups.length > 0 && (
              <div className="night-panel-section">
                <div className="night-panel-label">Groups</div>
                {controllableGroups.map((group) => {
                  const Icon = iconForGroup(group.name, group.icon);
                  return (
                    <div key={group.id} className="night-panel-volume">
                      <div className="night-panel-vol-name">
                        <Icon size={12} />
                        <span>{group.name}</span>
                        <button
                          className={`night-panel-group-toggle ${group.enabled ? 'on' : ''}`}
                          onClick={() => toggleGroup(group.id)}
                          tabIndex={active && panelOpen ? 0 : -1}
                          aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.name}`}
                          aria-pressed={group.enabled}
                          data-testid={`button-night-toggle-${group.id}`}
                        >
                          <span />
                        </button>
                      </div>
                      <div className="night-panel-vol-row">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={group.volume ?? 100}
                          onChange={(e) => updateGroupVolume(group.id, Number(e.target.value))}
                          tabIndex={active && panelOpen ? 0 : -1}
                          aria-label={`${group.name} volume`}
                          data-testid={`input-night-vol-${group.id}`}
                        />
                        <span>{group.volume ?? 100}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    )}

    {active && !isDimmed && (
      <div
        className={`flashlight-control ${flashlightOn ? 'on' : ''} ${mouseHoveringFlashlight ? 'mouse-hover' : ''}`}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setMouseHoveringFlashlight(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setMouseHoveringFlashlight(false);
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse') setMouseHoveringFlashlight(false);
          event.stopPropagation();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flashlight-slider-wrap" aria-hidden={!flashlightOn}>
          <span className="flashlight-slider-label">Brightness</span>
          <input
            type="range"
            min="0"
            max="100"
            value={flashlightBrightness}
            onChange={(event) => setFlashlightBrightness(Number(event.target.value))}
            className="flashlight-slider"
            aria-label="Flashlight brightness"
            aria-orientation="vertical"
            tabIndex={flashlightOn && active ? 0 : -1}
            data-testid="input-flashlight-brightness"
          />
          <span className="flashlight-slider-value">{flashlightBrightness}%</span>
        </div>
        <button
          type="button"
          className="flashlight-button"
          onClick={() => setFlashlightOn((on) => !on)}
          tabIndex={active ? 0 : -1}
          aria-label={flashlightOn ? 'Turn off flashlight' : 'Turn on flashlight'}
          aria-pressed={flashlightOn}
          data-testid="button-flashlight"
        >
          <Sun size={21} strokeWidth={1.8} />
        </button>
      </div>
    )}

    {active && !isDimmed && !flashlightOn && !panelOpen && showStopwatch && (
      <div className="night-session-stopwatch" aria-label={`Session elapsed ${formatTime(elapsed)}`} data-testid="night-session-stopwatch">
        <Timer size={14} />
        <span>{formatTime(elapsed)}</span>
      </div>
    )}

    {/* ── Clock / stop button — dims in place ─────────────────────── */}
    <div className={`night-mode-content${isDimmed ? ' content-dimmed' : ''}`} style={isDimmed ? { opacity: 0.05 + (dimBrightness / 100) * 0.75 } : undefined}>
      <div className={`night-mode-time${isDimmed && !dimShowClock ? ' night-aux-out' : ''}`} style={{ fontFamily: `'${clockFont}', sans-serif`, fontWeight: CLOCK_FONTS.find((f) => f.value === clockFont)?.weight ?? '800' }}>{formatClockTime(now, isDimmed ? dimShowSeconds : (showSeconds && !panelOpen), hour12, isDimmed ? dimShowAmPm : showAmPm)}</div>
      {showDate && (
        <div className={`night-mode-date${isDimmed && !dimShowDate ? ' night-aux-out' : ''}`}>{formatClockDate(now)}</div>
      )}
      <div className={`night-mode-aux${isDimmed ? ' night-aux-out' : ''}`}>
        <div className="night-mode-ending">{endingLabel}</div>
        {isAlarming && (
          <button className="night-mode-snooze" onClick={onSnooze} tabIndex={active ? 0 : -1} aria-label={`Snooze for ${snoozeMins} minutes and ${snoozeSecs} seconds`} data-testid="button-night-mode-snooze">
            <BellOff size={14} /> Snooze {snoozeMins}m {String(snoozeSecs).padStart(2, '0')}s
          </button>
        )}
        <button className={`night-mode-stop ${isAlarming ? 'alarming' : ''}`} onClick={stopSession} tabIndex={active ? 0 : -1} aria-label="Stop session" data-testid="button-night-mode-stop"><Square size={15} fill="currentColor" /> {isAlarming ? 'Silence & end' : 'Stop session'}</button>
      </div>
    </div>
  </div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clock Display Overlay
// ─────────────────────────────────────────────────────────────────────────────

type ClockDisplayOverlayProps = {
  active: boolean;
  onDismiss: () => void;
  now: Date;
  color: string;
  showDate: boolean;
  showSeconds: boolean;
  hour12: boolean;
  showAmPm: boolean;
  clockFont: string;
  musicStatus: MusicStatus;
  musicActiveTrack: MusicTrack | null;
  musicActivePlaylist: { id: string; name: string; tracks: MusicTrack[] } | null;
  canNavigateMusic: boolean;
  musicVolume: number;
  setMusicVolume: (value: number) => void;
  onMusicPlayPause: () => void;
  onMusicPrev: () => void;
  onMusicNext: () => void;
};

function ClockDisplayOverlay({ active, onDismiss, now, color, showDate, showSeconds, hour12, showAmPm, clockFont, musicStatus, musicActiveTrack, musicActivePlaylist, canNavigateMusic, musicVolume, setMusicVolume, onMusicPlayPause, onMusicPrev, onMusicNext }: ClockDisplayOverlayProps) {
  const [showMusicControls, setShowMusicControls] = useState(false);
  const trackName = musicActiveTrack ? musicActiveTrack.name.replace(/\.[^.]+$/, '') : null;

  useEffect(() => {
    document.body.style.overflow = active ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);

  // Match the home mini-player: keep controls visible while music plays,
  // then leave them available for five minutes after pausing or going idle.
  useEffect(() => {
    if (musicStatus === 'playing') {
      setShowMusicControls(true);
      return;
    }
    const timer = window.setTimeout(() => setShowMusicControls(false), 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [musicStatus]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    if (e.clientY - rect.top < rect.height / 2) onDismiss();
  };

  return (
    <div
      className={`clock-display-overlay${active ? ' active' : ''}`}
      style={{ '--clock-color': color } as CSSProperties}
      onClick={handleOverlayClick}
      aria-hidden={!active}
    >
      <div className="clock-display-content">
        <div className="clock-display-time" style={{ fontFamily: `'${clockFont}', sans-serif`, fontWeight: CLOCK_FONTS.find((f) => f.value === clockFont)?.weight ?? '800' }}>{formatClockTime(now, showSeconds, hour12, showAmPm)}</div>
        {showDate && <div className="clock-display-date">{formatClockDate(now)}</div>}
        {showMusicControls && musicActiveTrack && (
          <div className="clock-display-music">
            <div className="clock-display-track">
              {trackName && <span className="clock-display-track-name">{trackName}</span>}
              {musicActivePlaylist && <span className="clock-display-playlist-name">{musicActivePlaylist.name}</span>}
            </div>
            <div className="clock-display-controls" onClick={(e) => e.stopPropagation()}>
              <button className="clock-display-btn" onClick={onMusicPrev} disabled={!canNavigateMusic} aria-label="Previous track"><SkipBack size={18} /></button>
              <button className="clock-display-btn clock-display-btn-play" onClick={onMusicPlayPause} aria-label={musicStatus === 'playing' ? 'Pause' : 'Play'}>
                {musicStatus === 'playing' ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button className="clock-display-btn" onClick={onMusicNext} disabled={!canNavigateMusic} aria-label="Next track"><SkipForward size={18} /></button>
            </div>
            <div className="clock-display-volume" onClick={(e) => e.stopPropagation()}>
              <Volume2 size={14} />
              <input type="range" min="0" max="100" value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} aria-label="Music volume" />
              <span>{musicVolume}%</span>
            </div>
          </div>
        )}
      </div>
      <button
        className="clock-display-home-btn"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        aria-label="Return to home"
      >
        Go to Home
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function GroupVolumeRow({ group, updateGroupVolume }: { group: SoundGroup; updateGroupVolume: (id: string, vol: number) => void }) {
  return (
    <div className="group-volume-row">
      <Volume2 size={12} />
      <input type="range" min="0" max="100" value={group.volume ?? 100} onChange={(e) => updateGroupVolume(group.id, Number(e.target.value))} aria-label={`${group.name} volume`} data-testid={`input-group-volume-${group.id}`} />
      <span>{group.volume ?? 100}%</span>
    </div>
  );
}

function SoundGroupCard({ group, selected, toggleGroup, chooseGroup, updateGroupVolume, updateMainSessionSetting, updateMainDuration }: { group: SoundGroup; selected: boolean; toggleGroup: (id: string) => void; chooseGroup: (id: string) => void; updateGroupVolume: (id: string, vol: number) => void; updateMainSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void; updateMainDuration: (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => void }) {
  const Icon = iconForGroup(group.name, group.icon);
  return <article className={`sound-card ${selected ? 'selected' : ''}`} onDoubleClick={() => chooseGroup(group.id)} data-testid={`card-main-group-${group.id}`}>
    <div className="sound-card-top"><div className="sound-symbol" style={{ '--symbol-color': group.color } as CSSProperties}><Icon size={17} /></div><button className={`toggle ${group.enabled ? 'on' : ''}`} onClick={() => toggleGroup(group.id)} aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.name}`} aria-pressed={group.enabled} data-testid={`toggle-group-${group.id}`}><span /></button></div>
    <h3>{group.name}</h3><div className="sound-meta"><Music2 size={12} /><span className="sound-meta-name" title={group.files.length === 1 ? group.files[0].name : undefined}>{group.files.length === 1 ? group.files[0].name : `${group.files.length} sounds`}</span></div>
    <GroupVolumeRow group={group} updateGroupVolume={updateGroupVolume} />
    <div className="sound-card-foot"><span>{group.enabled ? 'In tonight\u2019s room' : 'Tucked away'}</span><button className="quiet-button" onClick={() => chooseGroup(group.id)} aria-label={`Manage ${group.name}`} data-testid={`button-manage-${group.id}`}><ChevronRight size={14} /></button></div>
  </article>;
}

function MainSessionSettings({ group, updateMainSessionSetting, updateMainDuration, updateMainStopMode }: { group: SoundGroup; updateMainSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void; updateMainDuration: (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => void; updateMainStopMode: (groupId: string, mode: TimeLimitMode) => void }) {
  return <div className="main-session-settings">
    <SessionChanceSetting group={group} updateSessionSetting={updateMainSessionSetting} />
    <div className="main-setting-row">
      <label className="main-setting-toggle"><input type="checkbox" checked={group.autoStopEnabled === true} onChange={(event) => updateMainSessionSetting(group.id, 'autoStopEnabled', event.target.checked)} data-testid={`toggle-main-auto-stop-${group.id}`} /><span>Sound limit</span></label>
    </div>
    {group.autoStopEnabled && <>
      <div className="limit-kind-group" role="group" aria-label={`${group.name} sound limit mode`}>
        <label className={`limit-kind-opt ${(group.autoStopMode ?? 'random') === 'fixed' ? 'selected' : ''}`}><input type="radio" name={`main-limit-mode-${group.id}`} checked={(group.autoStopMode ?? 'random') === 'fixed'} onChange={() => updateMainStopMode(group.id, 'fixed')} data-testid={`radio-main-limit-fixed-${group.id}`} /><span>Fixed</span></label>
        <label className={`limit-kind-opt ${(group.autoStopMode ?? 'random') === 'random' ? 'selected' : ''}`}><input type="radio" name={`main-limit-mode-${group.id}`} checked={(group.autoStopMode ?? 'random') === 'random'} onChange={() => updateMainStopMode(group.id, 'random')} data-testid={`radio-main-limit-random-${group.id}`} /><span>Random</span></label>
      </div>
      <div className="main-duration-settings">
        <div><label>{(group.autoStopMode ?? 'random') === 'fixed' ? 'Stop after' : 'After at least'}</label><MainDurationFields group={group} settingKey="minDuration" updateMainDuration={updateMainDuration} /></div>
        {(group.autoStopMode ?? 'random') === 'random' && <div><label>Before at most</label><MainDurationFields group={group} settingKey="maxDuration" updateMainDuration={updateMainDuration} /></div>}
      </div>
    </>}
  </div>;
}

function SessionChanceSetting({ group, updateSessionSetting }: { group: SoundGroup; updateSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void }) {
  const chanceEnabled = group.sessionChanceEnabled === true;
  return <>
    <div className="main-setting-row">
      <label className="main-setting-toggle"><input type="checkbox" checked={chanceEnabled} onChange={(event) => updateSessionSetting(group.id, 'sessionChanceEnabled', event.target.checked)} data-testid={`toggle-${group.kind}-chance-${group.id}`} /><span>Chance this session</span></label>
      {chanceEnabled && <label className="main-percent"><input type="number" min="0" max="100" value={group.sessionChance ?? 100} onChange={(event) => updateSessionSetting(group.id, 'sessionChance', Number(event.target.value))} aria-label={`${group.name} session chance`} data-testid={`input-${group.kind}-chance-${group.id}`} /><span>%</span></label>}
    </div>
  </>;
}

function GroupInteractionSettings({ group, updateSessionSetting }: { group: SoundGroup; updateSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void }) {
  const startsOnSession = group.playOnSessionStart === true;
  return <div className="group-interaction-settings">
    <div className="main-setting-row">
      <label className="main-setting-toggle"><input type="checkbox" checked={startsOnSession} onChange={(event) => updateSessionSetting(group.id, 'playOnSessionStart', event.target.checked)} data-testid={`toggle-play-on-session-start-${group.id}`} /><span>Play on session start</span></label>
      {startsOnSession && <label className="main-percent"><input type="number" min="0" max="100" value={group.playOnSessionStartChance ?? 100} onChange={(event) => updateSessionSetting(group.id, 'playOnSessionStartChance', Number(event.target.value))} aria-label={`${group.name} session start chance`} data-testid={`input-play-on-session-start-chance-${group.id}`} /><span>%</span></label>}
    </div>
    <div className="main-setting-row">
      <label className="main-setting-toggle"><input type="checkbox" checked={group.stopGroupsOnPlay === true} onChange={(event) => updateSessionSetting(group.id, 'stopGroupsOnPlay', event.target.checked)} data-testid={`toggle-stop-groups-on-play-${group.id}`} /><span>Stop other groups on play</span></label>
    </div>
    <div className="main-setting-row">
      <label className="main-setting-toggle"><input type="checkbox" checked={group.stopWhenOtherGroupsPlay === true} onChange={(event) => updateSessionSetting(group.id, 'stopWhenOtherGroupsPlay', event.target.checked)} data-testid={`toggle-stop-when-other-groups-play-${group.id}`} /><span>Can be stopped by another group</span></label>
    </div>
    <p className="group-interaction-hint">A stopped group finishes its current sound or sequence, then resumes its usual schedule when the stopping playback ends.</p>
  </div>;
}

function MainDurationFields({ group, settingKey, updateMainDuration }: { group: SoundGroup; settingKey: 'minDuration' | 'maxDuration'; updateMainDuration: (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => void }) {
  const fields: Array<{ unit: DurationUnit; label: string; max: number }> = [
    { unit: 'hours', label: 'hr', max: 999 }, { unit: 'minutes', label: 'min', max: 59 },
    { unit: 'seconds', label: 'sec', max: 59 }, { unit: 'milliseconds', label: 'ms', max: 999 },
  ];
  const duration = group[settingKey] ?? (settingKey === 'minDuration' ? DEFAULT_MAIN_MIN_DURATION : DEFAULT_MAIN_MAX_DURATION);
  return <div className="duration-fields">{fields.map(({ unit, label, max }) => <label key={unit} className="duration-field"><input type="number" min="0" max={max} value={getDurationParts(duration)[unit]} onChange={(event) => updateMainDuration(group.id, settingKey, unit, Number(event.target.value))} aria-label={`${group.name} ${settingKey} ${label}`} data-testid={`input-${settingKey}-${unit}-${group.id}`} /><span>{label}</span></label>)}</div>;
}

function StartStopDurationFields({ group, settingKey, updateStartStopDuration }: { group: SoundGroup; settingKey: 'runMinDuration' | 'runMaxDuration'; updateStartStopDuration: (groupId: string, key: 'runMinDuration' | 'runMaxDuration', unit: DurationUnit, value: number) => void }) {
  const fields: Array<{ unit: DurationUnit; label: string; max: number }> = [
    { unit: 'hours', label: 'hr', max: 999 }, { unit: 'minutes', label: 'min', max: 59 },
    { unit: 'seconds', label: 'sec', max: 59 }, { unit: 'milliseconds', label: 'ms', max: 999 },
  ];
  const fallback = settingKey === 'runMinDuration' ? DEFAULT_START_STOP_RUN_MIN_DURATION : DEFAULT_START_STOP_RUN_MAX_DURATION;
  const duration = group[settingKey] ?? fallback;
  return <div className="duration-fields">{fields.map(({ unit, label, max }) => <label key={unit} className="duration-field"><input type="number" min="0" max={max} value={getDurationParts(duration)[unit]} onChange={(event) => updateStartStopDuration(group.id, settingKey, unit, Number(event.target.value))} aria-label={`${group.name} ${settingKey} ${label}`} data-testid={`input-${settingKey}-${unit}-${group.id}`} /><span>{label}</span></label>)}</div>;
}

function DurationFields({ group, prefix, updateGroupInterval }: { group: SoundGroup; prefix: string; updateGroupInterval: (groupId: string, key: IntervalKey, unit: DurationUnit, value: number) => void }) {
  const fields: Array<{ unit: DurationUnit; label: string; max: number }> = [
    { unit: 'hours', label: 'hr', max: 999 }, { unit: 'minutes', label: 'min', max: 59 },
    { unit: 'seconds', label: 'sec', max: 59 }, { unit: 'milliseconds', label: 'ms', max: 999 },
  ];
  return <div className="duration-fields">{fields.map(({ unit, label, max }) => <label key={unit} className="duration-field"><input id={`${prefix}-${unit}`} type="number" min="0" max={max} value={getDurationParts(group[prefix.startsWith('min') ? 'minInterval' : 'maxInterval'])[unit]} onChange={(event) => updateGroupInterval(group.id, prefix.startsWith('min') ? 'minInterval' : 'maxInterval', unit, Number(event.target.value))} aria-label={`${prefix} ${label}`} data-testid={`input-${prefix}-${unit}-${group.id}`} /><span>{label}</span></label>)}</div>;
}

function TimeLimitFields({ group, updateGroupTimeLimit }: { group: SoundGroup; updateGroupTimeLimit: (groupId: string, unit: DurationUnit, value: number) => void }) {
  const fields: Array<{ unit: DurationUnit; label: string; max: number }> = [
    { unit: 'hours', label: 'hr', max: 999 }, { unit: 'minutes', label: 'min', max: 59 },
    { unit: 'seconds', label: 'sec', max: 59 }, { unit: 'milliseconds', label: 'ms', max: 999 },
  ];
  const timeLimit = group.timeLimit ?? DEFAULT_TIME_LIMIT;
  return <div className="duration-fields">{fields.map(({ unit, label, max }) => <label key={unit} className="duration-field"><input type="number" min="0" max={max} value={getDurationParts(timeLimit)[unit]} onChange={(e) => updateGroupTimeLimit(group.id, unit, Number(e.target.value))} aria-label={`${group.name} time limit ${label}`} data-testid={`input-timelimit-${unit}-${group.id}`} /><span>{label}</span></label>)}</div>;
}

// Renders duration fields for timeLimitMax (the "latest" bound in random mode).
function TimeLimitFieldsMax({ group, updateGroupTimeLimitMax }: { group: SoundGroup; updateGroupTimeLimitMax: (groupId: string, unit: DurationUnit, value: number) => void }) {
  const fields: Array<{ unit: DurationUnit; label: string; max: number }> = [
    { unit: 'hours', label: 'hr', max: 999 }, { unit: 'minutes', label: 'min', max: 59 },
    { unit: 'seconds', label: 'sec', max: 59 }, { unit: 'milliseconds', label: 'ms', max: 999 },
  ];
  const timeLimit = group.timeLimitMax ?? DEFAULT_TIME_LIMIT_MAX;
  return <div className="duration-fields">{fields.map(({ unit, label, max }) => <label key={unit} className="duration-field"><input type="number" min="0" max={max} value={getDurationParts(timeLimit)[unit]} onChange={(e) => updateGroupTimeLimitMax(group.id, unit, Number(e.target.value))} aria-label={`${group.name} time limit max ${label}`} data-testid={`input-timelimitmax-${unit}-${group.id}`} /><span>{label}</span></label>)}</div>;
}

// Composites the Fixed/Random toggle + the appropriate duration field(s).
function TimeLimitSection({ group, updateGroupTimeLimit, updateGroupTimeLimitMax, updateGroupTimeLimitMode }: {
  group: SoundGroup;
  updateGroupTimeLimit: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMax: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMode: (groupId: string, mode: TimeLimitMode) => void;
}) {
  const mode = group.timeLimitMode ?? 'fixed';
  return (
    <div className="time-limit-section">
      <div className="limit-kind-group time-limit-mode-group" role="group" aria-label="Time limit mode">
        <label className={`limit-kind-opt ${mode === 'fixed' ? 'selected' : ''}`}>
          <input type="radio" name={`timelimit-mode-${group.id}`} checked={mode === 'fixed'} onChange={() => updateGroupTimeLimitMode(group.id, 'fixed')} data-testid={`radio-timelimit-fixed-${group.id}`} /><span>Fixed</span>
        </label>
        <label className={`limit-kind-opt ${mode === 'random' ? 'selected' : ''}`}>
          <input type="radio" name={`timelimit-mode-${group.id}`} checked={mode === 'random'} onChange={() => updateGroupTimeLimitMode(group.id, 'random')} data-testid={`radio-timelimit-random-${group.id}`} /><span>Random</span>
        </label>
      </div>
      {mode === 'fixed' ? (
        <div className="time-limit-fields">
          <span className="time-limit-label">Stop after</span>
          <TimeLimitFields group={group} updateGroupTimeLimit={updateGroupTimeLimit} />
        </div>
      ) : (
        <div className="time-limit-fields">
          <span className="time-limit-label">Earliest</span>
          <TimeLimitFields group={group} updateGroupTimeLimit={updateGroupTimeLimit} />
          <span className="time-limit-label">Latest</span>
          <TimeLimitFieldsMax group={group} updateGroupTimeLimitMax={updateGroupTimeLimitMax} />
        </div>
      )}
    </div>
  );
}

function LimitKindToggle({ group, updateGroupLimitKind }: { group: SoundGroup; updateGroupLimitKind: (id: string, kind: LimitKind) => void }) {
  return (
    <div className="limit-kind-group" role="group" aria-label="Limit type">
      <label className={`limit-kind-opt ${(group.limitKind ?? 'count') === 'count' ? 'selected' : ''}`}>
        <input type="radio" name={`limit-kind-${group.id}`} checked={(group.limitKind ?? 'count') === 'count'} onChange={() => updateGroupLimitKind(group.id, 'count')} data-testid={`radio-limit-count-${group.id}`} /><span>Plays</span>
      </label>
      <label className={`limit-kind-opt ${group.limitKind === 'time' ? 'selected' : ''}`}>
        <input type="radio" name={`limit-kind-${group.id}`} checked={group.limitKind === 'time'} onChange={() => updateGroupLimitKind(group.id, 'time')} data-testid={`radio-limit-time-${group.id}`} /><span>Time</span>
      </label>
    </div>
  );
}

type EffectGroupCardProps = {
  group: SoundGroup;
  toggleGroup: (id: string) => void;
  chooseGroup: (id: string) => void;
  updateGroupSetting: (groupId: string, key: 'minInterval' | 'maxInterval' | 'limit', value: number) => void;
  updateGroupVolume: (groupId: string, volume: number) => void;
  updateGroupLimitMode: (groupId: string, enabled: boolean) => void;
  updateGroupLimitKind: (groupId: string, kind: LimitKind) => void;
  updateGroupTimeLimit: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMax: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMode: (groupId: string, mode: TimeLimitMode) => void;
  updateGroupInterval: (groupId: string, key: IntervalKey, unit: DurationUnit, value: number) => void;
};

function EffectGroupCard({ group, toggleGroup, chooseGroup, updateGroupSetting, updateGroupVolume, updateGroupLimitMode, updateGroupLimitKind, updateGroupTimeLimit, updateGroupTimeLimitMax, updateGroupTimeLimitMode, updateGroupInterval }: EffectGroupCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const Icon = iconForGroup(group.name, group.icon);
  const limitKind = group.limitKind ?? 'count';
  const tlMode = group.timeLimitMode ?? 'fixed';
  const limitSummary = group.limitEnabled
    ? limitKind === 'time'
      ? tlMode === 'random'
        ? `stops ${formatDurationNoMs(group.timeLimit ?? DEFAULT_TIME_LIMIT)}\u2013${formatDurationNoMs(group.timeLimitMax ?? DEFAULT_TIME_LIMIT_MAX)} in`
        : `stops after ${formatDurationNoMs(group.timeLimit ?? DEFAULT_TIME_LIMIT)}`
      : `${group.limit} play limit`
    : 'unlimited';
  return <article className="effect-card" data-testid={`card-effect-group-${group.id}`}>
    <div className="sound-symbol" style={{ '--symbol-color': group.color } as CSSProperties}><Icon size={17} /></div>
    <div>
      <h3>{group.name}</h3>
      <p className="effect-summary">{group.files.length} sounds · {formatDurationNoMs(group.minInterval)}–{formatDurationNoMs(group.maxInterval)} · {limitSummary}</p>
    </div>
    <div className="effect-card-actions">
      <button className={`effect-settings-toggle ${settingsOpen ? 'open' : ''}`} onClick={() => setSettingsOpen((open) => !open)} aria-label={`${settingsOpen ? 'Collapse' : 'Expand'} ${group.name} controls`} aria-expanded={settingsOpen} title={settingsOpen ? 'Hide effect controls' : 'Adjust effect controls'} data-testid={`button-toggle-effect-settings-${group.id}`}>
        <SlidersHorizontal size={13} /><ChevronDown size={13} className={`collapse-chevron${settingsOpen ? ' rotated' : ''}`} />
      </button>
      <button className={`toggle ${group.enabled ? 'on' : ''}`} onClick={() => toggleGroup(group.id)} aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.name}`} aria-pressed={group.enabled} data-testid={`toggle-effect-${group.id}`}><span /></button>
    </div>
    {settingsOpen && <div className="effect-settings">
      <div className="duration-setting"><label>Minimum interval</label><DurationFields group={group} prefix="minInterval" updateGroupInterval={updateGroupInterval} /></div>
      <div className="duration-setting"><label>Maximum interval</label><DurationFields group={group} prefix="maxInterval" updateGroupInterval={updateGroupInterval} /></div>
      <div className="setting limit-setting">
        <label htmlFor={`limit-${group.id}`}>Play limit</label>
        <label className="limit-toggle"><input id={`limit-${group.id}`} type="checkbox" checked={group.limitEnabled} onChange={(event) => updateGroupLimitMode(group.id, event.target.checked)} data-testid={`toggle-limit-${group.id}`} /><span>{group.limitEnabled ? 'Limited' : 'Unlimited'}</span></label>
        {group.limitEnabled && <>
          <LimitKindToggle group={group} updateGroupLimitKind={updateGroupLimitKind} />
          {limitKind === 'count'
            ? <input type="number" min="1" value={group.limit} onChange={(event) => updateGroupSetting(group.id, 'limit', Number(event.target.value))} aria-label={`${group.name} play limit`} data-testid={`input-limit-${group.id}`} />
            : <TimeLimitSection group={group} updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax} updateGroupTimeLimitMode={updateGroupTimeLimitMode} />
          }
        </>}
      </div>
      <div className="effect-volume-wrap"><GroupVolumeRow group={group} updateGroupVolume={updateGroupVolume} /></div>
      <button className="quiet-button" onClick={() => chooseGroup(group.id)} data-testid={`button-edit-effect-${group.id}`}><SlidersHorizontal size={14} /> Tune</button>
    </div>}
  </article>;
}

function StartStopGroupCard({ group, toggleGroup, chooseGroup, updateGroupVolume }: { group: SoundGroup; toggleGroup: (id: string) => void; chooseGroup: (id: string) => void; updateGroupVolume: (groupId: string, volume: number) => void }) {
  const Icon = iconForGroup(group.name, group.icon);
  const start = group.files.find((file) => file.role === 'start')?.name;
  const run = group.files.find((file) => file.role === 'run')?.name;
  const stop = group.files.find((file) => file.role === 'stop')?.name;
  const sequenceReady = Boolean(start && run && stop);
  return <article className="effect-card start-stop-card" data-testid={`card-start-stop-group-${group.id}`}>
    <div className="sound-symbol" style={{ '--symbol-color': group.color } as CSSProperties}><Icon size={17} /></div>
    <div>
      <h3>{group.name}</h3>
      <p className="effect-summary">{sequenceReady ? '3-part sequence' : 'Assign Start, Run, and Stop files'} · {formatDurationNoMs(group.minInterval)}–{formatDurationNoMs(group.maxInterval)}</p>
      {sequenceReady && <p className="start-stop-card-files"><span title={start}>Start</span><span title={run}>Run</span><span title={stop}>Stop</span></p>}
    </div>
    <div className="effect-card-actions">
      <button className={`toggle ${group.enabled ? 'on' : ''}`} onClick={() => toggleGroup(group.id)} aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.name}`} aria-pressed={group.enabled} data-testid={`toggle-start-stop-${group.id}`}><span /></button>
    </div>
    <div className="effect-volume-wrap"><GroupVolumeRow group={group} updateGroupVolume={updateGroupVolume} /></div>
    <div className="start-stop-card-foot">
      <span>{group.enabled ? (sequenceReady ? 'In tonight’s room' : 'Needs its three files') : 'Tucked away'}</span>
      <button className="quiet-button" onClick={() => chooseGroup(group.id)} aria-label={`Manage ${group.name}`} data-testid={`button-manage-start-stop-${group.id}`}><ChevronRight size={14} /></button>
    </div>
  </article>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LibraryPage
// ─────────────────────────────────────────────────────────────────────────────

type LibraryPageProps = {
  groups: SoundGroup[];
  selectedGroup: string | null;
  setSelectedGroup: (id: string) => void;
  openNewGroup: () => void;
  openEditGroup: (group: SoundGroup) => void;
  deleteGroup: (group: SoundGroup) => void;
  openFilePicker: (groupId?: string) => void;
  removeFile: (groupId: string, fileId: string) => void;
  setFileRole: (groupId: string, fileId: string, role: SoundRole) => void;
  updateGroupSetting: (groupId: string, key: 'minInterval' | 'maxInterval' | 'limit', value: number) => void;
  updateGroupVolume: (groupId: string, volume: number) => void;
  updateGroupLimitMode: (groupId: string, enabled: boolean) => void;
  updateGroupLimitKind: (groupId: string, kind: LimitKind) => void;
  updateGroupTimeLimit: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMax: (groupId: string, unit: DurationUnit, value: number) => void;
  updateGroupTimeLimitMode: (groupId: string, mode: TimeLimitMode) => void;
  updateGroupInterval: (groupId: string, key: IntervalKey, unit: DurationUnit, value: number) => void;
  updateMainSessionSetting: (groupId: string, key: GroupSessionSettingKey, value: boolean | number) => void;
  updateMainDuration: (groupId: string, key: 'minDuration' | 'maxDuration', unit: DurationUnit, value: number) => void;
  updateMainStopMode: (groupId: string, mode: TimeLimitMode) => void;
  updateStartStopDuration: (groupId: string, key: 'runMinDuration' | 'runMaxDuration', unit: DurationUnit, value: number) => void;
  updateStartStopPercent: (groupId: string, key: 'startRunPercent' | 'stopRunPercent', value: number) => void;
  toggleGroup: (id: string) => void;
};

function LibraryPage(props: LibraryPageProps) {
  const { groups, selectedGroup, setSelectedGroup, openNewGroup, openEditGroup, deleteGroup, openFilePicker, removeFile, setFileRole, updateGroupSetting, updateGroupVolume, updateGroupLimitMode, updateGroupLimitKind, updateGroupTimeLimit, updateGroupTimeLimitMax, updateGroupTimeLimitMode, updateGroupInterval, updateMainSessionSetting, updateMainDuration, updateMainStopMode, updateStartStopDuration, updateStartStopPercent, toggleGroup } = props;
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; key: 'minInterval' | 'maxInterval' | 'limit'; value: number }>).detail;
      updateGroupSetting(detail.id, detail.key, detail.value);
    };
    window.addEventListener('night-setting', handler);
    return () => window.removeEventListener('night-setting', handler);
  }, [updateGroupSetting]);
  const visibleGroups = selectedGroup ? groups.filter((group) => group.id === selectedGroup) : groups;
  return <div>
    <div className="library-heading"><div><div className="eyebrow">Your local collection</div><h1>Sound library</h1></div><div><p>{groups.length} groups \u00b7 {groups.reduce((sum, group) => sum + group.files.length, 0)} sounds, kept on this device. Add your own MP3 or WAV files.</p><button className="primary-button" onClick={openNewGroup} style={{ marginTop: 15 }} data-testid="button-new-library-group"><FolderPlus size={14} /> New group</button></div></div>
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 19 }}>{selectedGroup && <button className="tag" onClick={() => setSelectedGroup('')} data-testid="button-show-all-groups">Showing one group <X size={12} /></button>}{groups.map((group) => <button key={group.id} className={`tag ${selectedGroup === group.id ? 'selected' : ''}`} style={selectedGroup === group.id ? { borderColor: group.color, color: group.color } : undefined} onClick={() => setSelectedGroup(group.id)} data-testid={`filter-group-${group.id}`}><span className="group-dot" style={{ background: group.color }} />{group.name}</button>)}</div>
    <div className="library-grid">
      {visibleGroups.map((group) => <LibraryGroupRow key={group.id} group={group} openEditGroup={openEditGroup} deleteGroup={deleteGroup} openFilePicker={openFilePicker} removeFile={removeFile} setFileRole={setFileRole} updateGroupSetting={updateGroupSetting} updateGroupVolume={updateGroupVolume} updateGroupLimitMode={updateGroupLimitMode} updateGroupLimitKind={updateGroupLimitKind} updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax} updateGroupTimeLimitMode={updateGroupTimeLimitMode} updateGroupInterval={updateGroupInterval} updateMainSessionSetting={updateMainSessionSetting} updateMainDuration={updateMainDuration} updateMainStopMode={updateMainStopMode} updateStartStopDuration={updateStartStopDuration} updateStartStopPercent={updateStartStopPercent} toggleGroup={toggleGroup} />)}
      {!visibleGroups.length && <div className="empty-panel"><Archive size={22} /><h3>Your library is quiet</h3><p>Add a group, then choose local audio files from your device. Nothing leaves the app.</p><button className="primary-button" onClick={openNewGroup} data-testid="button-empty-create-group"><Plus size={14} /> Create your first group</button></div>}
    </div>
  </div>;
}

function LibraryGroupRow({ group, openEditGroup, deleteGroup, openFilePicker, removeFile, setFileRole, updateGroupSetting, updateGroupVolume, updateGroupLimitMode, updateGroupLimitKind, updateGroupTimeLimit, updateGroupTimeLimitMax, updateGroupTimeLimitMode, updateGroupInterval, updateMainSessionSetting, updateMainDuration, updateMainStopMode, updateStartStopDuration, updateStartStopPercent, toggleGroup }: Omit<LibraryPageProps, 'groups' | 'selectedGroup' | 'setSelectedGroup' | 'openNewGroup'> & { group: SoundGroup }) {
  const Icon = iconForGroup(group.name, group.icon);
  const limitKind = group.limitKind ?? 'count';
  return <section className="library-row" data-testid={`row-library-group-${group.id}`}>
    <div className="library-row-head"><span className="group-dot" style={{ background: group.color }} /><Icon size={17} color={group.color} /><div><h3>{group.name}</h3><p>{group.kind === 'main' ? 'Main sound · continuous loop' : group.kind === 'startStop' ? `Start/Stop sequence · starts ${formatDuration(group.minInterval)}–${formatDuration(group.maxInterval)}` : `Effect group · ${formatDuration(group.minInterval)}–${formatDuration(group.maxInterval)}`}</p></div><button className={`toggle ${group.enabled ? 'on' : ''}`} onClick={() => toggleGroup(group.id)} aria-label={`${group.enabled ? 'Disable' : 'Enable'} ${group.name}`} aria-pressed={group.enabled} data-testid={`toggle-library-group-${group.id}`}><span /></button><div className="actions"><button className="icon-button" onClick={() => openEditGroup(group)} aria-label={`Edit ${group.name}`} data-testid={`button-rename-group-${group.id}`}><Pencil size={14} /></button><button className="icon-button" onClick={() => deleteGroup(group)} aria-label={`Delete ${group.name}`} data-testid={`button-delete-group-${group.id}`}><Trash2 size={14} /></button><button className="icon-button" onClick={() => openFilePicker(group.id)} aria-label={`Add files to ${group.name}`} data-testid={`button-add-files-${group.id}`}><Upload size={14} /></button></div></div>
    <div className="library-volume-row"><GroupVolumeRow group={group} updateGroupVolume={updateGroupVolume} /></div>
    {group.kind === 'effect' && <div className="effect-settings library-effect-settings" style={{ margin: '0 19px', paddingBottom: 13 }}>
      <div className="duration-setting"><label>Minimum interval</label><DurationFields group={group} prefix="minInterval-library" updateGroupInterval={updateGroupInterval} /></div>
      <div className="duration-setting"><label>Maximum interval</label><DurationFields group={group} prefix="maxInterval-library" updateGroupInterval={updateGroupInterval} /></div>
      <SessionChanceSetting group={group} updateSessionSetting={updateMainSessionSetting} />
      <GroupInteractionSettings group={group} updateSessionSetting={updateMainSessionSetting} />
      <div className="setting limit-setting">
        <label htmlFor={`library-limit-${group.id}`}>Play limit</label>
        <label className="limit-toggle"><input id={`library-limit-${group.id}`} type="checkbox" checked={group.limitEnabled} onChange={(event) => updateGroupLimitMode(group.id, event.target.checked)} data-testid={`toggle-library-limit-${group.id}`} /><span>{group.limitEnabled ? 'Limited' : 'Unlimited'}</span></label>
        {group.limitEnabled && <>
          <LimitKindToggle group={group} updateGroupLimitKind={updateGroupLimitKind} />
          {limitKind === 'count'
            ? <input type="number" min="1" value={group.limit} onChange={(event) => updateGroupSetting(group.id, 'limit', Number(event.target.value))} aria-label={`${group.name} play limit`} data-testid={`input-library-limit-${group.id}`} />
            : <TimeLimitSection group={group} updateGroupTimeLimit={updateGroupTimeLimit} updateGroupTimeLimitMax={updateGroupTimeLimitMax} updateGroupTimeLimitMode={updateGroupTimeLimitMode} />
          }
        </>}
      </div>
    </div>}
    {group.kind === 'main' && <div className="effect-settings library-effect-settings" style={{ margin: '0 19px', paddingBottom: 13 }}>
      <MainSessionSettings group={group} updateMainSessionSetting={updateMainSessionSetting} updateMainDuration={updateMainDuration} updateMainStopMode={updateMainStopMode} />
    </div>}
    {group.kind === 'startStop' && <div className="effect-settings library-effect-settings start-stop-settings" style={{ margin: '0 19px', paddingBottom: 13 }}>
      <div className="duration-setting"><label>Start after at least</label><DurationFields group={group} prefix="minInterval-library" updateGroupInterval={updateGroupInterval} /></div>
      <div className="duration-setting"><label>Start before at most</label><DurationFields group={group} prefix="maxInterval-library" updateGroupInterval={updateGroupInterval} /></div>
      <div className="duration-setting"><label>Run for at least</label><StartStopDurationFields group={group} settingKey="runMinDuration" updateStartStopDuration={updateStartStopDuration} /></div>
      <div className="duration-setting"><label>Run before at most</label><StartStopDurationFields group={group} settingKey="runMaxDuration" updateStartStopDuration={updateStartStopDuration} /></div>
      <label className="start-stop-percent">Start → Run overlap <input type="range" min="0" max="100" value={group.startRunPercent ?? DEFAULT_START_RUN_PERCENT} onChange={(event) => updateStartStopPercent(group.id, 'startRunPercent', Number(event.target.value))} data-testid={`input-start-run-percent-${group.id}`} /><span>{group.startRunPercent ?? DEFAULT_START_RUN_PERCENT}%</span></label>
      <label className="start-stop-percent">Stop → Run overlap <input type="range" min="0" max="100" value={group.stopRunPercent ?? DEFAULT_STOP_RUN_PERCENT} onChange={(event) => updateStartStopPercent(group.id, 'stopRunPercent', Number(event.target.value))} data-testid={`input-stop-run-percent-${group.id}`} /><span>{group.stopRunPercent ?? DEFAULT_STOP_RUN_PERCENT}%</span></label>
      <SessionChanceSetting group={group} updateSessionSetting={updateMainSessionSetting} />
      <GroupInteractionSettings group={group} updateSessionSetting={updateMainSessionSetting} />
      <p className="start-stop-hint">Assign one Start, Run, and Stop file below. Run begins near the end of Start and ends just after Stop begins.</p>
    </div>}
    <div className="file-list">{group.files.map((file) => <div className="file-row" key={file.id} data-testid={`row-file-${file.id}`}><Music2 size={14} color={group.color} /><span className="file-name">{file.name}</span><span className="file-type">{file.demo ? 'Preview' : formatSize(file.size)}</span>{group.kind === 'startStop' ? <select value={file.role} onChange={(event) => setFileRole(group.id, file.id, event.target.value as SoundRole)} aria-label={`Assign ${file.name} role`} data-testid={`select-start-stop-role-${file.id}`}><option value="start">Start</option><option value="run">Run</option><option value="stop">Stop</option><option value="unassigned">Unassigned</option></select> : <button className="quiet-button" onClick={() => setFileRole(group.id, file.id, file.role === 'main' ? 'effect' : 'main')} aria-label={`Assign ${file.name} as ${file.role === 'main' ? 'effect' : 'main'} sound`} data-testid={`button-role-${file.id}`}>{file.role === 'main' ? 'Main' : 'Effect'}</button>}<button className="icon-button" onClick={() => removeFile(group.id, file.id)} aria-label={`Remove ${file.name}`} data-testid={`button-remove-file-${file.id}`}><Trash2 size={14} /></button></div>)}{!group.files.length && <div className="empty-panel" style={{ border: 0, padding: '24px 10px' }}><Upload size={18} /><h3>{group.kind === 'startStop' ? 'Add Start, Run, and Stop files' : 'No files in this group'}</h3><p>{group.kind === 'startStop' ? 'Add three MP3 or WAV files; they are assigned in Start, Run, Stop order.' : 'Choose MP3 or WAV audio from your device to make this group yours.'}</p><button className="secondary-button" onClick={() => openFilePicker(group.id)} data-testid={`button-empty-add-files-${group.id}`}><Upload size={14} /> Choose MP3 / WAV</button></div>}</div>
  </section>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GamesPage
// ─────────────────────────────────────────────────────────────────────────────

function GamesPage() {
  return (
    <div className="games-page">
      <div className="games-coming-card">
        <Gamepad2 size={28} />
        <p>Games Coming in a future update</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MusicPage
// ─────────────────────────────────────────────────────────────────────────────

type MusicPageProps = {
  playlists: Playlist[];
  musicViewPlaylistId: string | null;
  setMusicViewPlaylistId: (id: string | null) => void;
  activePlaylistId: string | null;
  activeTrackIndex: number;
  musicStatus: MusicStatus;
  musicVolume: number;
  setMusicVolume: (v: number) => void;
  musicElapsed: number;
  musicDuration: number;
  musicShuffle: boolean;
  musicRepeat: MusicRepeat;
  musicTimerParts: TimerParts;
  musicTimerEndAt: number | null;
  musicTimerRemaining: number;
  createPlaylist: () => void;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  openMusicFilePicker: (playlistId: string) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  playTrack: (playlistId: string, index: number) => void;
  onMusicPlayPause: () => void;
  onMusicNext: () => void;
  onMusicPrev: () => void;
  seekMusic: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  startMusicTimer: () => void;
  cancelMusicTimer: () => void;
  updateMusicTimerPart: (unit: MusicTimerUnit, value: number) => void;
};

function PlaylistCard({ playlist, active, nowPlaying, onSelect, onDelete, onRename }: {
  playlist: Playlist; active: boolean; nowPlaying: boolean;
  onSelect: () => void; onDelete: () => void; onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(playlist.name);
  const commit = () => {
    if (draft.trim()) onRename(playlist.id, draft.trim()); else setDraft(playlist.name);
    setEditing(false);
  };
  return (
    <div className={`playlist-card ${active ? 'selected' : ''}`} onClick={onSelect} data-testid={`card-playlist-${playlist.id}`}>
      <ListMusic size={14} color={nowPlaying ? 'hsl(var(--primary))' : undefined} />
      {editing
        ? <input className="playlist-name-input" value={draft} onChange={(e) => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(playlist.name); setEditing(false); } }}
            autoFocus onClick={(e) => e.stopPropagation()} data-testid={`input-rename-playlist-${playlist.id}`} />
        : <span className="playlist-name">{playlist.name}</span>}
      <span className="playlist-count">{playlist.tracks.length}</span>
      <button className="icon-button" onClick={(e) => { e.stopPropagation(); setDraft(playlist.name); setEditing(true); }} aria-label={`Rename ${playlist.name}`} data-testid={`button-rename-playlist-${playlist.id}`}><Pencil size={12} /></button>
      <button className="icon-button" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={`Delete ${playlist.name}`} data-testid={`button-delete-playlist-${playlist.id}`}><Trash2 size={12} /></button>
    </div>
  );
}

function MusicPage(props: MusicPageProps) {
  const {
    playlists, musicViewPlaylistId, setMusicViewPlaylistId,
    activePlaylistId, activeTrackIndex, musicStatus, musicVolume, setMusicVolume,
    musicElapsed, musicDuration, musicShuffle, musicRepeat,
    musicTimerParts, musicTimerEndAt, musicTimerRemaining,
    createPlaylist, deletePlaylist, renamePlaylist, openMusicFilePicker, removeTrack,
    playTrack, onMusicPlayPause, onMusicNext, onMusicPrev, seekMusic,
    toggleShuffle, cycleRepeat, startMusicTimer, cancelMusicTimer, updateMusicTimerPart,
  } = props;

  const viewPlaylist = playlists.find((p) => p.id === musicViewPlaylistId) ?? playlists[0] ?? null;
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null;
  const activeTrack = activePlaylist?.tracks[activeTrackIndex] ?? null;
  const hasLivePlayback = musicStatus === 'playing' || musicStatus === 'paused';
  const timerRunning = !!musicTimerEndAt;

  return (
    <div className="music-page">
      <section className="page-intro">
        <div className="eyebrow">Your music, any time of day</div>
        <h1>Music player</h1>
        <p>Add playlists, drop in MP3 or WAV files, and listen. Music pauses automatically when a night session begins.</p>
      </section>

      <div className="music-layout">
        {/* ── Playlists sidebar ──────────────────────────────────────────── */}
        <aside className="playlists-panel">
          <div className="playlists-panel-head">
            <span className="eyebrow">Playlists</span>
            <button className="icon-button" onClick={createPlaylist} aria-label="New playlist" data-testid="button-new-playlist"><Plus size={15} /></button>
          </div>
          {playlists.length === 0
            ? <div className="music-empty" style={{ padding: '28px 0' }}><ListMusic size={20} /><p>No playlists yet.<br />Create one to get started.</p></div>
            : playlists.map((pl) => (
              <PlaylistCard key={pl.id} playlist={pl}
                active={pl.id === (viewPlaylist?.id ?? null)}
                nowPlaying={pl.id === activePlaylistId && hasLivePlayback}
                onSelect={() => setMusicViewPlaylistId(pl.id)}
                onDelete={() => deletePlaylist(pl.id)}
                onRename={renamePlaylist}
              />
            ))
          }
        </aside>

        {/* ── Track list ─────────────────────────────────────────────────── */}
        <div className="tracks-panel">
          {!viewPlaylist
            ? <div className="music-empty"><ListMusic size={24} /><h3>Select a playlist</h3><p>Choose from the list on the left, or create a new one.</p></div>
            : <>
                <div className="tracks-panel-head">
                  <div>
                    <h2>{viewPlaylist.name}</h2>
                    <p className="tracks-count">{viewPlaylist.tracks.length} {viewPlaylist.tracks.length === 1 ? 'track' : 'tracks'}</p>
                  </div>
                  <button className="secondary-button" onClick={() => openMusicFilePicker(viewPlaylist.id)} data-testid={`button-add-tracks-${viewPlaylist.id}`}><Upload size={13} /> Add tracks</button>
                </div>
                {viewPlaylist.tracks.length === 0
                  ? <div className="music-empty" style={{ padding: '40px 0' }}>
                      <Upload size={20} /><h3>No tracks yet</h3>
                      <p>Add MP3 or WAV files to start listening.</p>
                      <button className="primary-button" onClick={() => openMusicFilePicker(viewPlaylist.id)}><Upload size={13} /> Add tracks</button>
                    </div>
                  : <div className="track-list">
                      {viewPlaylist.tracks.map((track, index) => {
                        const isPlayingThis = activePlaylistId === viewPlaylist.id && activeTrackIndex === index;
                        return (
                          <div key={track.id} className={`track-row ${isPlayingThis ? 'playing' : ''}`} data-testid={`row-track-${track.id}`}>
                            <span className="track-index">
                              {isPlayingThis && musicStatus === 'playing'
                                ? <span className="track-eq"><i /><i /><i /></span>
                                : index + 1}
                            </span>
                            <button className="track-play-btn" onClick={() => {
                              if (isPlayingThis) onMusicPlayPause();
                              else playTrack(viewPlaylist.id, index);
                            }} disabled={!track.url && !isPlayingThis} aria-label={isPlayingThis && musicStatus === 'playing' ? `Pause ${track.name}` : `Play ${track.name}`} data-testid={`button-play-track-${track.id}`}>
                              {isPlayingThis && musicStatus === 'playing' ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
                            </button>
                            <span className="track-name" title={track.name}>{track.name.replace(/\.[^.]+$/, '')}</span>
                            <span className="track-size">{track.url ? formatSize(track.size) : <em>Re-add file</em>}</span>
                            <button className="icon-button" onClick={() => removeTrack(viewPlaylist.id, track.id)} aria-label={`Remove ${track.name}`} data-testid={`button-remove-track-${track.id}`}><Trash2 size={13} /></button>
                          </div>
                        );
                      })}
                    </div>
                }
              </>
          }
        </div>
      </div>

      {/* ── Player bar ──────────────────────────────────────────────────── */}
      <div className="music-player-bar">
        <div className="music-player-info">
          {activeTrack
            ? <>
                <span className="music-now-name">{activeTrack.name.replace(/\.[^.]+$/, '')}</span>
                <span className="music-now-playlist">{activePlaylist?.name}</span>
              </>
            : <span className="music-now-name music-idle">Nothing playing</span>
          }
        </div>

        <div className="music-player-center">
          <div className="music-controls">
            <button className="icon-button" onClick={onMusicPrev} disabled={!activeTrack} aria-label="Previous / restart"><SkipBack size={16} /></button>
            {musicStatus === 'playing'
              ? <button className="round-button" onClick={onMusicPlayPause} aria-label="Pause" data-testid="button-pause-music"><Pause size={15} fill="currentColor" /></button>
              : <button className="round-button" onClick={onMusicPlayPause} disabled={!activeTrack} aria-label="Play" data-testid="button-play-music"><Play size={15} fill="currentColor" /></button>
            }
            <button className="icon-button" onClick={onMusicNext} disabled={!activeTrack} aria-label="Next track"><SkipForward size={16} /></button>
            <button className={`icon-button music-mode-btn ${musicShuffle ? 'music-mode-on' : ''}`} onClick={toggleShuffle} aria-label="Toggle shuffle" title="Shuffle" data-testid="button-shuffle"><Shuffle size={14} /></button>
            <button className={`icon-button music-mode-btn ${musicRepeat !== 'none' ? 'music-mode-on' : ''}`} onClick={cycleRepeat} aria-label={`Repeat: ${musicRepeat}`} title={`Repeat: ${musicRepeat}`} data-testid="button-repeat">
              {musicRepeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            </button>
          </div>
          <div className="music-progress">
            <span className="music-time">{formatAudioTime(musicElapsed)}</span>
            <input type="range" className="music-seek" min="0" max={musicDuration || 1} step="0.5"
              value={hasLivePlayback ? musicElapsed : 0}
              onChange={(e) => seekMusic(Number(e.target.value))}
              disabled={!hasLivePlayback} aria-label="Seek" />
            <span className="music-time">{formatAudioTime(musicDuration)}</span>
          </div>
        </div>

        <div className="music-player-right">
          <div className="music-volume-row">
            <Volume2 size={13} />
            <input type="range" className="music-vol-slider" min="0" max="100" value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))} aria-label="Music volume" />
            <span className="music-vol-label">{musicVolume}%</span>
          </div>
          <div className="music-timer-row">
            <div className="music-timer-heading"><Timer size={13} /><span className="music-timer-label">Stop after</span></div>
            <div className="music-timer-controls">
              <SpinnerField value={musicTimerParts.hours} min={0} max={23} label="hr" onChange={(value) => updateMusicTimerPart('hours', value)} disabled={timerRunning} />
              <SpinnerField value={musicTimerParts.minutes} min={0} max={59} label="min" onChange={(value) => updateMusicTimerPart('minutes', value)} disabled={timerRunning} />
            </div>
            <div className="music-timer-action">
              {timerRunning
                ? <>
                  <span className="music-timer-remaining">{formatAudioTime(musicTimerRemaining / 1000)}</span>
                  <button className="quiet-button" onClick={cancelMusicTimer} data-testid="button-cancel-music-timer">Cancel</button>
                </>
                : <button className="quiet-button" onClick={startMusicTimer} data-testid="button-start-music-timer">Start</button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPage({ section, setSection, volume, setVolume, fileCount, groupCount, nightShowDate, setNightShowDate, nightShowSeconds, setNightShowSeconds, nightHour12, setNightHour12, nightShowAmPm, setNightShowAmPm, nightTextColor, setNightTextColor, nightClockFont, setNightClockFont, nightShowStopwatch, setNightShowStopwatch, nightDimEnabled, setNightDimEnabled, nightOsDimEnabled, setNightOsDimEnabled, nightOsSleepEnabled, setNightOsSleepEnabled, nightOsSleepDelaySecs, setNightOsSleepDelaySecs, nightDimDelaySecs, setNightDimDelaySecs, nightDimColor, setNightDimColor, nightDimShowClock, setNightDimShowClock, nightDimShowDate: nightDimShowDatePref, setNightDimShowDate, nightDimShowSeconds, setNightDimShowSeconds, nightDimShowAmPm: nightDimShowAmPmPref, setNightDimShowAmPm, nightDimBrightness, setNightDimBrightness, clockDisplayEnabled, setClockDisplayEnabled, clockDisplayDelaySecs, setClockDisplayDelaySecs, clockDisplayColor, setClockDisplayColor, clockDisplayRandomColor, setClockDisplayRandomColor, clockDisplayCustomColors, setClockDisplayCustomColors, clockDisplayColorSchedules, setClockDisplayColorSchedules, clockDisplayCycleEnabled, setClockDisplayCycleEnabled, clockDisplayCycleColors, setClockDisplayCycleColors, clockDisplayFont, setClockDisplayFont, clockDisplayShowDate, setClockDisplayShowDate, clockDisplayShowSeconds, setClockDisplayShowSeconds, clockDisplayHour12, setClockDisplayHour12, clockDisplayShowAmPm: clockDisplayShowAmPmPref, setClockDisplayShowAmPm, onResetPrefs, alarmSoundName, alarmOnTimer, setAlarmOnTimer, alarmOnAlarm, setAlarmOnAlarm, alarmPulseOnTimer, setAlarmPulseOnTimer, alarmPulseOnAlarm, setAlarmPulseOnAlarm, alarmSnoozeMins, setAlarmSnoozeMins, alarmSnoozeSecs, setAlarmSnoozeSecs, alarmVolume, setAlarmVolume, alarmSnoozeResumeAudio, setAlarmSnoozeResumeAudio, alarmTesting, onTestAlarm, onStopTestAlarm, onPickAlarmSound, onClearAlarmSound }: { section: SettingsSection; setSection: (value: SettingsSection) => void; volume: number; setVolume: (value: number) => void; fileCount: number; groupCount: number; nightShowDate: boolean; setNightShowDate: (v: boolean) => void; nightShowSeconds: boolean; setNightShowSeconds: (v: boolean) => void; nightHour12: boolean; setNightHour12: (v: boolean) => void; nightShowAmPm: boolean; setNightShowAmPm: (v: boolean) => void; nightTextColor: string; setNightTextColor: (v: string) => void; nightClockFont: string; setNightClockFont: (v: string) => void; nightShowStopwatch: boolean; setNightShowStopwatch: (v: boolean) => void; nightDimEnabled: boolean; setNightDimEnabled: (v: boolean) => void; nightOsDimEnabled: boolean; setNightOsDimEnabled: (v: boolean) => void; nightOsSleepEnabled: boolean; setNightOsSleepEnabled: (v: boolean) => void; nightOsSleepDelaySecs: number; setNightOsSleepDelaySecs: (v: number) => void; nightDimDelaySecs: number; setNightDimDelaySecs: (v: number) => void; nightDimColor: string; setNightDimColor: (v: string) => void; nightDimShowClock: boolean; setNightDimShowClock: (v: boolean) => void; nightDimShowDate: boolean; setNightDimShowDate: (v: boolean) => void; nightDimShowSeconds: boolean; setNightDimShowSeconds: (v: boolean) => void; nightDimShowAmPm: boolean; setNightDimShowAmPm: (v: boolean) => void; nightDimBrightness: number; setNightDimBrightness: (v: number) => void; clockDisplayEnabled: boolean; setClockDisplayEnabled: (v: boolean) => void; clockDisplayDelaySecs: number; setClockDisplayDelaySecs: (v: number) => void; clockDisplayColor: string; setClockDisplayColor: (v: string) => void; clockDisplayRandomColor: boolean; setClockDisplayRandomColor: (v: boolean) => void; clockDisplayCustomColors: string[]; setClockDisplayCustomColors: React.Dispatch<React.SetStateAction<string[]>>; clockDisplayColorSchedules: ClockColorSchedule[]; setClockDisplayColorSchedules: React.Dispatch<React.SetStateAction<ClockColorSchedule[]>>; clockDisplayCycleEnabled: boolean; setClockDisplayCycleEnabled: (v: boolean) => void; clockDisplayCycleColors: string[]; setClockDisplayCycleColors: React.Dispatch<React.SetStateAction<string[]>>; clockDisplayFont: string; setClockDisplayFont: (v: string) => void; clockDisplayShowDate: boolean; setClockDisplayShowDate: (v: boolean) => void; clockDisplayShowSeconds: boolean; setClockDisplayShowSeconds: (v: boolean) => void; clockDisplayHour12: boolean; setClockDisplayHour12: (v: boolean) => void; clockDisplayShowAmPm: boolean; setClockDisplayShowAmPm: (v: boolean) => void; onResetPrefs: () => void; alarmSoundName: string; alarmOnTimer: boolean; setAlarmOnTimer: (v: boolean) => void; alarmOnAlarm: boolean; setAlarmOnAlarm: (v: boolean) => void; alarmPulseOnTimer: boolean; setAlarmPulseOnTimer: (v: boolean) => void; alarmPulseOnAlarm: boolean; setAlarmPulseOnAlarm: (v: boolean) => void; alarmSnoozeMins: number; setAlarmSnoozeMins: (v: number) => void; alarmSnoozeSecs: number; setAlarmSnoozeSecs: (v: number) => void; alarmVolume: number; setAlarmVolume: (v: number) => void; alarmSnoozeResumeAudio: boolean; setAlarmSnoozeResumeAudio: (v: boolean) => void; alarmTesting: boolean; onTestAlarm: () => void; onStopTestAlarm: () => void; onPickAlarmSound: () => void; onClearAlarmSound: () => void }) {
  const dimDelayMins = Math.floor(nightDimDelaySecs / 60);
  const dimDelaySecs = nightDimDelaySecs % 60;
  const osSleepDelayHours = Math.floor(nightOsSleepDelaySecs / 3600);
  const osSleepDelayMins = Math.floor((nightOsSleepDelaySecs % 3600) / 60);
  const osSleepDelaySecs = nightOsSleepDelaySecs % 60;
  const clockDisplayDelayHours = Math.floor(clockDisplayDelaySecs / 3600);
  const clockDisplayDelayMins = Math.floor((clockDisplayDelaySecs % 3600) / 60);
  const clockDisplayDelaySecsPart = clockDisplayDelaySecs % 60;
  const [confirmReset, setConfirmReset] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installHelpSection, setInstallHelpSection] = useState<'download' | 'pwa' | 'ubuntu' | 'about'>('download');
  const [customClockColorDraft, setCustomClockColorDraft] = useState('#7dd3fc');
  const availableClockColors = [...CLOCK_DISPLAY_COLORS, ...clockDisplayCustomColors];
  const sectionHeading = section === 'night-display' ? 'Night Display' : section === 'screensaver' ? 'ScreenSaver' : 'App Settings';
  const sectionDescription = section === 'night-display'
    ? 'Set the details that shape an overnight listening session.'
    : section === 'screensaver'
    ? 'Choose the clock display that appears when the app is resting.'
    : 'Manage your local library, privacy, and app defaults.';

  const handleConfirmReset = () => {
    onResetPrefs();
    setConfirmReset(false);
  };
  useEffect(() => {
    if (!showInstallHelp) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowInstallHelp(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showInstallHelp]);
  const addCustomClockColor = () => {
    const color = normalizeClockColor(customClockColorDraft);
    if (!color || clockDisplayCustomColors.includes(color) || clockDisplayCustomColors.length >= MAX_CUSTOM_CLOCK_COLORS) return;
    setClockDisplayCustomColors((current) => [...current, color]);
    setClockDisplayColor(color);
    setClockDisplayRandomColor(false);
  };
  const addClockColorSchedule = () => {
    setClockDisplayColorSchedules((current) => current.length < MAX_CLOCK_COLOR_SCHEDULES
      ? [...current, newClockColorSchedule(clockDisplayRandomColor ? RANDOM_CLOCK_COLOR : clockDisplayColor)]
      : current);
  };
  const selectDefaultClockColor = (color: string) => {
    if (color === RANDOM_CLOCK_COLOR) {
      setClockDisplayRandomColor(true);
      return;
    }
    setClockDisplayColor(color);
    setClockDisplayRandomColor(false);
  };
  const removeCustomClockColor = (color: string) => {
    const fallback = DEFAULT_PREFS.clockDisplayColor;
    setClockDisplayCustomColors((current) => current.filter((item) => item !== color));
    if (clockDisplayColor === color) setClockDisplayColor(fallback);
    setClockDisplayColorSchedules((current) => current.map((schedule) => ({
      ...schedule,
      color: schedule.color === color ? fallback : schedule.color,
      cycleColors: schedule.cycleColors.filter((item) => item !== color),
    })));
    setClockDisplayCycleColors((current) => current.filter((item) => item !== color));
  };
  const updateColorSchedule = (id: string, updates: Partial<ClockColorSchedule>) => {
    setClockDisplayColorSchedules((current) => current.map((schedule) => schedule.id === id ? { ...schedule, ...updates } : schedule));
  };
  const toggleScheduleDay = (id: string, day: number) => {
    setClockDisplayColorSchedules((current) => current.map((schedule) => {
      if (schedule.id !== id) return schedule;
      return { ...schedule, days: schedule.days.includes(day) ? schedule.days.filter((item) => item !== day) : [...schedule.days, day] };
    }));
  };
  const setScheduleCycleEnabled = (id: string, enabled: boolean) => {
    updateColorSchedule(id, {
      cycleEnabled: enabled,
      cycleColors: enabled
        ? clockDisplayColorSchedules.find((schedule) => schedule.id === id)?.cycleColors ?? []
        : [],
      ...(enabled ? {} : { color: RANDOM_CLOCK_COLOR }),
    });
  };
  const toggleScheduleCycleColor = (id: string, color: string) => {
    const schedule = clockDisplayColorSchedules.find((item) => item.id === id);
    if (!schedule?.cycleEnabled) return;
    updateColorSchedule(id, {
      cycleColors: schedule.cycleColors.includes(color)
        ? schedule.cycleColors.filter((item) => item !== color)
        : schedule.cycleColors.length < MAX_CLOCK_CYCLE_COLORS
          ? [...schedule.cycleColors, color]
          : schedule.cycleColors,
    });
  };

  return (
    <div className="settings-layout">
      {confirmReset && (
        <div className="prefs-reset-overlay" role="dialog" aria-modal="true" aria-label="Confirm reset preferences">
          <div className="prefs-reset-dialog">
            <p>Are you sure you would like to reset your preferences?</p>
            <div className="prefs-reset-actions">
              <button className="prefs-reset-yes" onClick={handleConfirmReset} data-testid="button-confirm-reset-prefs">Yes</button>
              <button className="prefs-reset-no" onClick={() => setConfirmReset(false)} data-testid="button-cancel-reset-prefs">No</button>
            </div>
          </div>
        </div>
      )}
      <div className="settings-heading">
        <div className="eyebrow">The quiet details</div>
        <h1>{sectionHeading}</h1>
        <p>{sectionDescription}</p>
      </div>
      <div>
         {section === 'app-settings' && <div className="settings-section"><div><h3>Default session volume</h3><p>Applied to the next sound you play.</p></div><div className="settings-value">{volume}% <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Default session volume" data-testid="input-default-volume" /></div></div>}
         {section === 'night-display' && <div className="settings-section settings-section-block"><div><h3>Night display</h3><p>Choose what the clock shows during a session.</p></div><div className="settings-toggles"><label className="settings-toggle"><input type="checkbox" checked={nightShowDate} onChange={(e) => setNightShowDate(e.target.checked)} data-testid="toggle-night-show-date" /><span>Show date</span></label><label className="settings-toggle"><input type="checkbox" checked={nightShowSeconds} onChange={(e) => setNightShowSeconds(e.target.checked)} data-testid="toggle-night-show-seconds" /><span>Show seconds</span></label><div className="clock-format-row"><span className="settings-toggle-label">Clock format</span><div className="clock-format-group" role="group" aria-label="Clock format"><label className={`clock-format-opt ${nightHour12 ? 'selected' : ''}`}><input type="radio" name="night-clock-format" checked={nightHour12} onChange={() => setNightHour12(true)} data-testid="radio-night-12h" /><span>12h</span></label><label className={`clock-format-opt ${!nightHour12 ? 'selected' : ''}`}><input type="radio" name="night-clock-format" checked={!nightHour12} onChange={() => setNightHour12(false)} data-testid="radio-night-24h" /><span>24h</span></label></div></div>{nightHour12 && <label className="settings-toggle settings-toggle-sub"><input type="checkbox" checked={nightShowAmPm} onChange={(e) => setNightShowAmPm(e.target.checked)} data-testid="toggle-night-show-ampm" /><span>Show AM / PM</span></label>}</div><div className="clock-format-row" style={{marginTop:8}}><span className="settings-toggle-label">Clock font</span><select className="night-font-select settings-font-select" value={nightClockFont} onChange={(e) => setNightClockFont(e.target.value)} aria-label="Clock font" data-testid="select-clock-font-settings">{CLOCK_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
           <div className="night-color-setting settings-night-text-color">
             <label>Night text color</label>
             <div className="text-color-options" role="group" aria-label="Night text color">
               {NIGHT_TEXT_COLORS.map((color) => <button key={color} className={`text-color-option ${nightTextColor === color ? 'selected' : ''}`} style={{ background: color }} onClick={() => setNightTextColor(color)} aria-label={`Use ${color} for night text`} aria-pressed={nightTextColor === color} data-testid={`button-settings-night-text-${color.replace('#', '')}`}>{nightTextColor === color && <Check size={12} color="#1b1823" />}</button>)}
             </div>
           </div>
            <label className="settings-toggle settings-night-stopwatch-toggle">
              <input type="checkbox" checked={nightShowStopwatch} onChange={(e) => setNightShowStopwatch(e.target.checked)} data-testid="toggle-night-show-stopwatch" />
              <span>Show session stopwatch</span>
            </label>
           <div className="dim-settings">
            <div className="dim-settings-head">
              <label className="settings-toggle"><input type="checkbox" checked={nightDimEnabled} onChange={(e) => setNightDimEnabled(e.target.checked)} data-testid="toggle-dim-enabled" /><span>Dim display after idle</span></label>
            </div>
             <div className="os-dim-setting">
                <label className="settings-toggle"><input type="checkbox" checked={nightOsDimEnabled} onChange={(e) => setNightOsDimEnabled(e.target.checked)} data-testid="toggle-os-dim-enabled" /><span>Allow the OS to dim after Night UI dims</span></label>
                <p>The app keeps the screen awake until the Night UI is dimmed and the flashlight is off. Then your Windows or Linux display timeout may dim the screen.</p>
             </div>
              <div className="os-dim-setting">
                <label className="settings-toggle"><input type="checkbox" checked={nightOsSleepEnabled} onChange={(e) => setNightOsSleepEnabled(e.target.checked)} data-testid="toggle-os-sleep-enabled" /><span>Request display sleep after dimming</span></label>
                {nightOsSleepEnabled && <div className="dim-delay-row prefs-spinner-row">
                  <span className="settings-toggle-label">After dimming</span>
                  <SpinnerField value={osSleepDelayHours} min={0} max={23} label="hr" onChange={(h) => setNightOsSleepDelaySecs(Math.max(1, h * 3600 + osSleepDelayMins * 60 + osSleepDelaySecs))} />
                  <SpinnerField value={osSleepDelayMins} min={0} max={59} label="min" onChange={(m) => setNightOsSleepDelaySecs(Math.max(1, osSleepDelayHours * 3600 + m * 60 + osSleepDelaySecs))} />
                  <SpinnerField value={osSleepDelaySecs} min={osSleepDelayHours === 0 && osSleepDelayMins === 0 ? 1 : 0} max={59} label="sec" onChange={(s) => setNightOsSleepDelaySecs(Math.max(1, osSleepDelayHours * 3600 + osSleepDelayMins * 60 + s))} />
                </div>}
                <p>Only runs after the Night UI is dimmed and the flashlight is off. For an installed desktop build or the optional localhost Linux helper; unsupported builds keep running normally.</p>
              </div>
            {nightDimEnabled && (<>
              <div className="dim-delay-row prefs-spinner-row">
                <span className="settings-toggle-label">Dim after</span>
                <SpinnerField value={dimDelayMins} min={0} max={59} label="min" onChange={(m) => setNightDimDelaySecs(Math.max(5, m * 60 + dimDelaySecs))} />
                <SpinnerField value={dimDelaySecs} min={dimDelayMins === 0 ? 5 : 0} max={59} label="sec" onChange={(s) => setNightDimDelaySecs(Math.max(5, dimDelayMins * 60 + s))} />
              </div>
               <div className="dim-color-row">
                <span className="settings-toggle-label">Dim text color</span>
                <div className="night-panel-colors">
                  {NIGHT_TEXT_COLORS.map((color) => (
                    <button key={color} className={`night-panel-swatch ${nightDimColor === color ? 'selected' : ''}`} style={{ background: color, border: `2px solid ${nightDimColor === color ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}` }} onClick={() => setNightDimColor(color)} aria-label={`Dim text color ${color}`} aria-pressed={nightDimColor === color} data-testid={`button-dim-color-${color.replace('#', '')}`}>
                      {nightDimColor === color && <Check size={11} color="#1b1823" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dim-display-row">
                <span className="settings-toggle-label">When dimmed</span>
                <div className="dim-color-row" style={{marginTop:2}}>
                <span className="settings-toggle-label">Dim brightness</span>
                <input type="range" min="0" max="100" value={nightDimBrightness} onChange={(e) => setNightDimBrightness(Number(e.target.value))} className="alarm-volume-slider" aria-label="Dim brightness" data-testid="input-dim-brightness" />
                <span className="alarm-snooze-unit">{nightDimBrightness}%</span>
              </div>
              <div className="dim-display-toggles">
                  <label className="settings-toggle"><input type="checkbox" checked={nightDimShowClock} onChange={(e) => setNightDimShowClock(e.target.checked)} data-testid="toggle-dim-show-clock" /><span>Show clock</span></label>
                  <label className="settings-toggle"><input type="checkbox" checked={nightDimShowDatePref} onChange={(e) => setNightDimShowDate(e.target.checked)} data-testid="toggle-dim-show-date" /><span>Show date</span></label>
                  <label className="settings-toggle"><input type="checkbox" checked={nightDimShowSeconds} onChange={(e) => setNightDimShowSeconds(e.target.checked)} data-testid="toggle-dim-show-seconds" /><span>Show seconds</span></label>
                  {nightHour12 && <label className="settings-toggle"><input type="checkbox" checked={nightDimShowAmPmPref} onChange={(e) => setNightDimShowAmPm(e.target.checked)} data-testid="toggle-dim-show-ampm" /><span>Show AM/PM</span></label>}
                </div>
              </div>
              <p className="dim-hint">Move the mouse, tap, or click to wake the display. An active alarm also wakes it.</p>
            </>)}
          </div>
        </div>
         }
         {section === 'screensaver' && <div className="settings-section settings-section-block">
          <div><h3>Clock display</h3><p>Shows a full-screen clock when idle on the home page. Tap the top half of the screen or press "Go to Home" to return. Music controls appear automatically when music is playing.</p></div>
          <div>
            <label className="settings-toggle"><input type="checkbox" checked={clockDisplayEnabled} onChange={(e) => setClockDisplayEnabled(e.target.checked)} data-testid="toggle-clock-display-enabled" /><span>Enable clock display</span></label>
             <>
              <div className="dim-delay-row prefs-spinner-row" style={{marginTop:10}}>
                <span className="settings-toggle-label">Show after</span>
                <SpinnerField value={clockDisplayDelayHours} min={0} max={23} label="hr" onChange={(h) => setClockDisplayDelaySecs(Math.max(20, h * 3600 + clockDisplayDelayMins * 60 + clockDisplayDelaySecsPart))} />
                <SpinnerField value={clockDisplayDelayMins} min={0} max={59} label="min" onChange={(m) => setClockDisplayDelaySecs(Math.max(20, clockDisplayDelayHours * 3600 + m * 60 + clockDisplayDelaySecsPart))} />
                <SpinnerField value={clockDisplayDelaySecsPart} min={clockDisplayDelayHours === 0 && clockDisplayDelayMins === 0 ? 20 : 0} max={59} label="sec" onChange={(s) => setClockDisplayDelaySecs(Math.max(20, clockDisplayDelayHours * 3600 + clockDisplayDelayMins * 60 + s))} />
              </div>
               <div className="clock-color-settings clock-display-color-row">
                <div className="clock-color-heading">
                  <span className="settings-toggle-label">Clock color</span>
                  <span className="clock-color-hint">Used when no day rule or color cycle is active.</span>
                </div>
                <div className="night-panel-colors" role="group" aria-label="Clock color">
                  {availableClockColors.map((color) => {
                    const isCustom = clockDisplayCustomColors.includes(color);
                    return (
                      <div className="clock-color-swatch-wrap" key={color}>
                        <button className={`night-panel-swatch ${!clockDisplayRandomColor && clockDisplayColor === color ? 'selected' : ''}`} style={{ background: color, border: `2px solid ${!clockDisplayRandomColor && clockDisplayColor === color ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}` }} onClick={() => selectDefaultClockColor(color)} aria-label={`Clock color ${color}`} aria-pressed={!clockDisplayRandomColor && clockDisplayColor === color} data-testid={`button-clock-color-${color.replace('#', '')}`}>
                          {!clockDisplayRandomColor && clockDisplayColor === color && <Check size={11} color="#1b1823" />}
                        </button>
                        {isCustom && <button type="button" className="clock-color-remove" onClick={() => removeCustomClockColor(color)} aria-label={`Remove custom clock color ${color}`} data-testid={`button-remove-custom-clock-color-${color.replace('#', '')}`}><X size={9} /></button>}
                      </div>
                    );
                  })}
                  <button type="button" className={`clock-random-swatch ${clockDisplayRandomColor ? 'selected' : ''}`} onClick={() => selectDefaultClockColor(RANDOM_CLOCK_COLOR)} aria-label="Use a random clock color" aria-pressed={clockDisplayRandomColor} data-testid="button-clock-color-random"><Shuffle size={12} /><span>Random</span></button>
                </div>
                <div className="custom-clock-color-add">
                  <input type="color" value={customClockColorDraft} onChange={(event) => setCustomClockColorDraft(event.target.value)} aria-label="Choose a custom clock color" data-testid="input-custom-clock-color" />
                  <button type="button" className="prefs-compact-button" onClick={addCustomClockColor} disabled={clockDisplayCustomColors.length >= MAX_CUSTOM_CLOCK_COLORS || clockDisplayCustomColors.includes(customClockColorDraft.toLowerCase())} data-testid="button-add-custom-clock-color">Add custom color</button>
                  <span className="clock-color-count">{clockDisplayCustomColors.length} / {MAX_CUSTOM_CLOCK_COLORS} custom</span>
                </div>
               </div>
               <div className="screen-color-rules">
                 <div className="screen-color-rules-head">
                    <div><span className="settings-toggle-label">Day color schedules</span><p>Choose a color, then check the days when it should appear. Each schedule can optionally cycle through multiple colors.</p></div>
                   <div className="screen-color-add-schedule"><span className="clock-color-count">{clockDisplayColorSchedules.length} / {MAX_CLOCK_COLOR_SCHEDULES} schedules</span><button type="button" className="prefs-compact-button" onClick={addClockColorSchedule} disabled={clockDisplayColorSchedules.length >= MAX_CLOCK_COLOR_SCHEDULES} data-testid="button-add-clock-color-schedule"><Plus size={13} /> Add schedule</button></div>
                 </div>
                 {clockDisplayColorSchedules.length === 0
                   ? <p className="screen-color-empty">No day schedules yet — the default Clock color will be used every day.</p>
                   : <div className="clock-color-schedule-list">
                     {clockDisplayColorSchedules.map((schedule, index) => (
                       <div className="clock-color-schedule" key={schedule.id}>
                         <div className="clock-color-schedule-top">
                           <span className="settings-toggle-label">Schedule {index + 1} color</span>
                           <button type="button" className="clock-schedule-remove" onClick={() => setClockDisplayColorSchedules((current) => current.filter((item) => item.id !== schedule.id))} aria-label={`Remove color schedule ${index + 1}`} data-testid={`button-remove-clock-color-schedule-${index}`}>Remove</button>
                         </div>
                         <div className="night-panel-colors clock-schedule-palette" role="group" aria-label={`Color for schedule ${index + 1}`}>
                           {availableClockColors.map((color) => <button key={color} type="button" className={`night-panel-swatch ${schedule.color === color ? 'selected' : ''}`} style={{ background: color, border: `2px solid ${schedule.color === color ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}` }} onClick={() => updateColorSchedule(schedule.id, { color })} aria-label={`Set schedule ${index + 1} color to ${color}`} aria-pressed={schedule.color === color} data-testid={`button-clock-schedule-${index}-color-${color.replace('#', '')}`}>{schedule.color === color && <Check size={11} color="#1b1823" />}</button>)}
                           <button type="button" className={`clock-random-swatch ${schedule.color === RANDOM_CLOCK_COLOR ? 'selected' : ''}`} onClick={() => updateColorSchedule(schedule.id, { color: RANDOM_CLOCK_COLOR })} aria-label={`Set schedule ${index + 1} color to random`} aria-pressed={schedule.color === RANDOM_CLOCK_COLOR} data-testid={`button-clock-schedule-${index}-random`}><Shuffle size={12} /><span>Random</span></button>
                         </div>
                         <div className="clock-day-picker" role="group" aria-label={`Days for color schedule ${index + 1}`}>
                           {CLOCK_COLOR_WEEKDAYS.map((day) => <label className={`clock-day-option ${schedule.days.includes(day.value) ? 'selected' : ''}`} key={day.value}><input type="checkbox" checked={schedule.days.includes(day.value)} onChange={() => toggleScheduleDay(schedule.id, day.value)} data-testid={`checkbox-clock-schedule-${index}-${day.label.toLowerCase()}`} /><span>{day.label}</span></label>)}
                         </div>
                          <label className="settings-toggle clock-schedule-cycle-toggle"><input type="checkbox" checked={schedule.cycleEnabled} onChange={(event) => setScheduleCycleEnabled(schedule.id, event.target.checked)} data-testid={`toggle-clock-schedule-cycle-${index}`} /><span>Cycle colors for this schedule</span></label>
                          {schedule.cycleEnabled && <div className="clock-cycle-picker">
                            <span className="clock-color-count">{schedule.cycleColors.length} / {MAX_CLOCK_CYCLE_COLORS} selected</span>
                            <div className="night-panel-colors" role="group" aria-label={`Colors to cycle for schedule ${index + 1}`}>
                              {availableClockColors.map((color) => {
                                const selected = schedule.cycleColors.includes(color);
                                return <button key={color} type="button" className={`night-panel-swatch ${selected ? 'selected' : ''}`} style={{ background: color, border: `2px solid ${selected ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}` }} onClick={() => toggleScheduleCycleColor(schedule.id, color)} disabled={!selected && schedule.cycleColors.length >= MAX_CLOCK_CYCLE_COLORS} aria-label={`${selected ? 'Remove' : 'Add'} ${color} from schedule ${index + 1} color cycle`} aria-pressed={selected} data-testid={`button-clock-schedule-${index}-cycle-${color.replace('#', '')}`}>{selected && <Check size={11} color="#1b1823" />}</button>;
                              })}
                            </div>
                            {!schedule.cycleColors.length && <span className="screen-color-empty">Select at least one color to start cycling.</span>}
                          </div>}
                       </div>
                     ))}
                   </div>}
                </div>
              <div className="dim-display-toggles" style={{marginTop:6}}>
                <label className="settings-toggle"><input type="checkbox" checked={clockDisplayShowDate} onChange={(e) => setClockDisplayShowDate(e.target.checked)} data-testid="toggle-clock-display-date" /><span>Show date</span></label>
                <label className="settings-toggle"><input type="checkbox" checked={clockDisplayShowSeconds} onChange={(e) => setClockDisplayShowSeconds(e.target.checked)} data-testid="toggle-clock-display-seconds" /><span>Show seconds</span></label>
                <div className="clock-format-row"><span className="settings-toggle-label">Clock format</span><div className="clock-format-group" role="group" aria-label="Clock format"><label className={`clock-format-opt ${clockDisplayHour12 ? 'selected' : ''}`}><input type="radio" name="clock-display-format" checked={clockDisplayHour12} onChange={() => setClockDisplayHour12(true)} data-testid="radio-clock-display-12h" /><span>12h</span></label><label className={`clock-format-opt ${!clockDisplayHour12 ? 'selected' : ''}`}><input type="radio" name="clock-display-format" checked={!clockDisplayHour12} onChange={() => setClockDisplayHour12(false)} data-testid="radio-clock-display-24h" /><span>24h</span></label></div></div>
                {clockDisplayHour12 && <label className="settings-toggle settings-toggle-sub"><input type="checkbox" checked={clockDisplayShowAmPmPref} onChange={(e) => setClockDisplayShowAmPm(e.target.checked)} data-testid="toggle-clock-display-ampm" /><span>Show AM / PM</span></label>}
                <div className="clock-format-row" style={{marginTop:4}}><span className="settings-toggle-label">Clock font</span><select className="night-font-select settings-font-select" value={clockDisplayFont} onChange={(e) => setClockDisplayFont(e.target.value)} aria-label="Clock display font" data-testid="select-clock-display-font">{CLOCK_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
              </div>
            </>
          </div>
         </div>}
         {section === 'night-display' && <div className="settings-section settings-section-block">
          <div><h3>Session end alarm</h3><p>Play a sound when the session ends automatically. Upload any audio file — a gentle chime, tone, or any sound you like.</p></div>
          <div className="alarm-sound-config">
            <div className="alarm-sound-file-row">
              {alarmSoundName
                ? <><span className="alarm-sound-name" title={alarmSoundName}>{alarmSoundName}</span><button className="alarm-sound-remove" onClick={onClearAlarmSound} aria-label="Remove alarm sound" data-testid="button-clear-alarm-sound">Remove</button></>
                : <span className="alarm-sound-none">No file chosen</span>}
              <button className="alarm-sound-pick" onClick={onPickAlarmSound} data-testid="button-pick-alarm-sound">{alarmSoundName ? 'Change' : 'Choose file'}</button>
            </div>
            {alarmSoundName && (
              <div className="alarm-volume-row">
                <span className="alarm-snooze-label">Alarm volume</span>
                <input type="range" min="0" max="100" value={alarmVolume} onChange={(e) => setAlarmVolume(Number(e.target.value))} className="alarm-volume-slider" aria-label="Alarm volume" data-testid="input-alarm-volume" />
                <span className="alarm-snooze-unit">{alarmVolume}%</span>
                <button
                  className={`alarm-test-btn ${alarmTesting ? 'testing' : ''}`}
                  onClick={alarmTesting ? onStopTestAlarm : onTestAlarm}
                  aria-label={alarmTesting ? 'Stop alarm test' : 'Test alarm sound'}
                  data-testid="button-test-alarm"
                >{alarmTesting ? 'Stop test' : 'Test'}</button>
              </div>
            )}
            <label className="settings-toggle alarm-toggle">
              <input type="checkbox" checked={alarmOnTimer} onChange={(e) => setAlarmOnTimer(e.target.checked)} data-testid="toggle-alarm-on-timer" />
              <span>Play when timer ends</span>
            </label>
            <label className="settings-toggle alarm-toggle alarm-toggle-sub">
              <input type="checkbox" checked={alarmPulseOnTimer} onChange={(e) => setAlarmPulseOnTimer(e.target.checked)} data-testid="toggle-alarm-pulse-on-timer" />
              <span>Pulse background when timer ends</span>
            </label>
            <label className="settings-toggle alarm-toggle">
              <input type="checkbox" checked={alarmOnAlarm} onChange={(e) => setAlarmOnAlarm(e.target.checked)} data-testid="toggle-alarm-on-alarm" />
              <span>Play when alarm clock fires</span>
            </label>
            <label className="settings-toggle alarm-toggle alarm-toggle-sub">
              <input type="checkbox" checked={alarmPulseOnAlarm} onChange={(e) => setAlarmPulseOnAlarm(e.target.checked)} data-testid="toggle-alarm-pulse-on-alarm" />
              <span>Pulse background when alarm fires</span>
            </label>
            <label className="settings-toggle alarm-toggle">
              <input type="checkbox" checked={alarmSnoozeResumeAudio} onChange={(e) => setAlarmSnoozeResumeAudio(e.target.checked)} data-testid="toggle-alarm-snooze-resume" />
              <span>Resume sounds during snooze</span>
            </label>
            <div className="alarm-snooze-row">
              <span className="alarm-snooze-label">Snooze duration</span>
              <SpinnerField value={alarmSnoozeMins} min={1} max={999} label="min" onChange={setAlarmSnoozeMins} />
              <SpinnerField value={alarmSnoozeSecs} min={0} max={59} label="sec" onChange={setAlarmSnoozeSecs} />
            </div>
          </div>
         </div>}
         {section === 'app-settings' && <>
         <div className="settings-section"><div><h3>Local library</h3><p>Audio metadata currently held in the app.</p></div><div className="settings-value">{fileCount} sounds · {groupCount} groups</div></div>
        <div className="settings-section"><div><h3>Storage &amp; privacy</h3><p>No account, server, or cloud sync. Audio files stay on your device.</p></div><LockKeyhole size={18} color="hsl(var(--primary))" /></div>
         <div className="settings-section settings-section-about"><div className="about-app-copy"><h3>About this app</h3><p>Night Sound Machine is a small local-first room for the sounds that help you soften into sleep.</p><button type="button" className="prefs-compact-button about-app-help-toggle" onClick={() => { setInstallHelpSection('download'); setShowInstallHelp(true); }} aria-haspopup="dialog" data-testid="button-app-install-help"><CircleHelp size={14} /> Help with downloading the app</button></div><Moon size={19} color="hsl(var(--accent))" /></div>
        <div className="settings-section"><div><h3>Version</h3><p>What's currently running in the app.</p></div><div className="settings-value settings-version">v{__APP_VERSION__}<a href="https://github.com/malpal1350-cyber/Night-Machine/releases" target="_blank" rel="noopener noreferrer" className="settings-version-link" aria-label="View releases on GitHub" title="Check for updates on GitHub"><ExternalLink size={13} /></a></div></div>
        <div className="settings-section settings-section-reset">
          <div><h3>Reset to defaults</h3><p>Restores clock, display, and volume settings. Your audio files and groups are not affected.</p></div>
          <button className="prefs-reset-btn" onClick={() => setConfirmReset(true)} data-testid="button-open-reset-prefs">Reset to defaults</button>
        </div>
         {showInstallHelp && <div className="app-help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstallHelp(false); }}><div className="app-help-dialog" role="dialog" aria-modal="true" aria-labelledby="app-help-title" data-testid="app-install-help"><div className="app-help-header"><div><span className="app-help-eyebrow">Need a hand?</span><h2 id="app-help-title">Using Night Sound Machine</h2></div><button type="button" className="app-help-close" onClick={() => setShowInstallHelp(false)} aria-label="Close installation help" data-testid="button-close-app-help"><X size={18} /></button></div><div className="app-help-layout"><nav className="app-help-nav" aria-label="Help topics">{[{ id: 'download', label: 'Download the app' }, { id: 'pwa', label: 'Install the PWA' }, { id: 'ubuntu', label: 'Ubuntu display helper' }, { id: 'about', label: 'About this app' }].map((item) => <button type="button" key={item.id} className={`app-help-nav-item ${installHelpSection === item.id ? 'active' : ''}`} onClick={() => setInstallHelpSection(item.id as typeof installHelpSection)} aria-current={installHelpSection === item.id ? 'page' : undefined} data-testid={`help-topic-${item.id}`}>{item.label}</button>)}</nav><div className="app-help-content">
           {installHelpSection === 'download' && <><span className="app-help-kicker">Desktop version</span><h3>Download the app</h3><p>If a desktop version has been published, it will be listed on the app releases page.</p><ol><li>Open the downloads page below.</li><li>Choose the file for your computer.</li><li>Open the downloaded file from your Downloads folder.</li></ol><a className="secondary-button about-app-download" href="https://github.com/malpal1350-cyber/Night-Machine/releases" target="_blank" rel="noopener noreferrer" data-testid="link-app-downloads">Open app downloads <ExternalLink size={13} /></a><p className="app-help-muted">If you only see source code or an “Install” button in your browser, a separate desktop download is not published yet.</p></>}
           {installHelpSection === 'pwa' && <><span className="app-help-kicker">Easiest option</span><h3>Install from your browser</h3><p>The PWA version is the simplest way to use Night Sound Machine like an app.</p><ol><li>Open your browser’s menu.</li><li>Choose <strong>Install Night Sound Machine</strong> or <strong>Add to Home screen</strong>.</li><li>Open it from your app list or desktop shortcut.</li></ol><p className="app-help-muted">Your sounds and preferences stay on this device. The PWA does not need a terminal or a separate download.</p></>}
           {installHelpSection === 'ubuntu' && <><span className="app-help-kicker">Optional display feature</span><h3>Ubuntu display helper</h3><p>Use this only if Ubuntu keeps the display awake while a sound session is playing.</p><ol><li>The helper must run on the same Ubuntu computer as the app.</li><li>Start it before your session and leave it running.</li><li>In Night Display, enable <strong>Request display sleep after dimming</strong>.</li></ol><p className="app-help-muted">The helper is currently a technical download and may require someone comfortable with the project folder and terminal. The app and audio still work without it; it only adds the display-sleep action.</p><a className="secondary-button about-app-download" href="https://github.com/malpal1350-cyber/Night-Machine/releases" target="_blank" rel="noopener noreferrer" data-testid="link-helper-downloads">Check downloads for helper <ExternalLink size={13} /></a></>}
           {installHelpSection === 'about' && <><span className="app-help-kicker">Good to know</span><h3>About this app</h3><p>Night Sound Machine is local-first: your audio files, groups, presets, and preferences stay on this device.</p><p>No account or cloud library is required. The app can be used as a browser tab, an installed PWA, or—when published—an optional desktop download.</p></>}
          </div></div></div></div>}
         </>}
      </div>
    </div>
  );
}

export default App;

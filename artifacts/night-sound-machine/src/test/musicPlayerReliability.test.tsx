import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  static deferNextPlay = false;
  static resolveDeferredPlay: (() => void) | null = null;

  src: string;
  currentTime = 0;
  duration = 8;
  volume = 1;
  loop = false;
  paused = true;
  ended = false;
  onended: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src = '') {
    super();
    this.src = src;
    MockAudio.instances.push(this);
  }

  play = vi.fn(() => {
    if (!MockAudio.deferNextPlay) {
      this.paused = false;
      return Promise.resolve();
    }
    MockAudio.deferNextPlay = false;
    return new Promise<void>((resolve) => {
      MockAudio.resolveDeferredPlay = () => {
        this.paused = false;
        resolve();
      };
    });
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  load = vi.fn();

  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
}

type GainEvent = { kind: 'set' | 'ramp' | 'cancel'; value?: number; time: number };

class MockAudioParam {
  value = 1;
  readonly events: GainEvent[] = [];

  cancelScheduledValues = vi.fn((time: number) => {
    this.events.push({ kind: 'cancel', time });
  });

  setValueAtTime = vi.fn((value: number, time: number) => {
    this.events.push({ kind: 'set', value, time });
  });

  linearRampToValueAtTime = vi.fn((value: number, time: number) => {
    this.events.push({ kind: 'ramp', value, time });
  });
}

class MockGainNode {
  readonly gain = new MockAudioParam();
  connect = vi.fn();
}

class MockBufferSourceNode {
  static instances: MockBufferSourceNode[] = [];
  buffer = {} as AudioBuffer;
  loop = false;
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly connect = vi.fn();

  constructor() {
    MockBufferSourceNode.instances.push(this);
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  readonly destination = {} as AudioDestinationNode;
  readonly gains: MockGainNode[] = [];
  state: AudioContextState = 'running';
  private readonly startedAt = Date.now();

  constructor() {
    MockAudioContext.instances.push(this);
  }

  get currentTime() {
    return (Date.now() - this.startedAt) / 1000;
  }

  createGain = vi.fn(() => {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain;
  });

  createBufferSource = vi.fn(() => new MockBufferSourceNode());
  decodeAudioData = vi.fn(async () => ({ } as AudioBuffer));
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
}

async function addTwoTracks() {
  fireEvent.click(screen.getByTestId('nav-music'));
  fireEvent.click(screen.getByTestId('button-new-playlist'));
  const addTracksButtons = await screen.findAllByRole('button', { name: /Add tracks/i });
  fireEvent.click(addTracksButtons[0]);
  const files = [
    new File(['a'], 'track-a.wav', { type: 'audio/wav' }),
    new File(['b'], 'track-b.wav', { type: 'audio/wav' }),
  ];
  fireEvent.change(screen.getByTestId('input-music-files'), { target: { files } });
  await screen.findByRole('button', { name: 'Play track-a.wav' });
}

beforeEach(() => {
  localStorage.clear();
  MockAudio.instances = [];
  MockAudioContext.instances = [];
  MockBufferSourceNode.instances = [];
  MockAudio.deferNextPlay = false;
  MockAudio.resolveDeferredPlay = null;
  let blobIndex = 0;
  vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:track-${blobIndex++}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('music player reliability', () => {
  it('invalidates a pending resume when play is clicked again to pause', async () => {
    render(<App />);
    await addTwoTracks();

    fireEvent.click(screen.getByRole('button', { name: 'Play track-a.wav' }));
    await screen.findByTestId('button-pause-music');
    const audio = MockAudio.instances.at(-1)!;

    fireEvent.click(screen.getByTestId('button-pause-music'));
    expect(audio.paused).toBe(true);

    MockAudio.deferNextPlay = true;
    fireEvent.click(screen.getByTestId('button-play-music'));
    fireEvent.click(screen.getByTestId('button-play-music'));
    expect(audio.paused).toBe(true);

    await act(async () => {
      MockAudio.resolveDeferredPlay?.();
      await Promise.resolve();
    });

    expect(audio.paused).toBe(true);
    expect(screen.getByTestId('button-play-music')).toBeInTheDocument();
  });

  it('pauses a replaced track whose pending play request resolves late', async () => {
    render(<App />);
    await addTwoTracks();

    MockAudio.deferNextPlay = true;
    fireEvent.click(screen.getByRole('button', { name: 'Play track-a.wav' }));
    const firstAudio = MockAudio.instances.at(-1)!;

    fireEvent.click(screen.getByRole('button', { name: 'Play track-b.wav' }));
    const secondAudio = MockAudio.instances.at(-1)!;
    await act(async () => { await Promise.resolve(); });
    expect(secondAudio.paused).toBe(false);

    await act(async () => {
      MockAudio.resolveDeferredPlay?.();
      await Promise.resolve();
    });

    expect(firstAudio.paused).toBe(true);
    expect(firstAudio.src).toBe('');
    expect(MockAudio.instances.filter((audio) => !audio.paused && audio.src)).toEqual([secondAudio]);
  });

  it('restarts once, then selects the prior track without leaving duplicate audio active', async () => {
    const { container } = render(<App />);
    await addTwoTracks();

    fireEvent.click(screen.getByRole('button', { name: 'Play track-a.wav' }));
    await screen.findByTestId('button-pause-music');
    const firstAudio = MockAudio.instances.at(-1)!;
    firstAudio.currentTime = 4;

    fireEvent.click(screen.getByRole('button', { name: 'Previous / restart' }));
    expect(firstAudio.currentTime).toBe(0);
    expect(MockAudio.instances).toHaveLength(1);

    // Even if UI latency lets playback pass the normal restart threshold again,
    // the next Previous action must select the prior track.
    firstAudio.currentTime = 4;
    fireEvent.click(screen.getByRole('button', { name: 'Previous / restart' }));

    await waitFor(() => expect(screen.getAllByText('track-b').length).toBeGreaterThan(0));
    expect(MockAudio.instances).toHaveLength(2);
    expect(firstAudio.paused).toBe(true);
    expect(firstAudio.src).toBe('');
    expect(MockAudio.instances.filter((audio) => !audio.paused && audio.src)).toHaveLength(1);

    const secondAudio = MockAudio.instances.at(-1)!;
    secondAudio.currentTime = 4;
    fireEvent.click(screen.getByTestId('nav-home'));
    const homePrevious = container.querySelector<HTMLButtonElement>('.home-music-strip button[aria-label="Previous track"]');
    expect(homePrevious).not.toBeNull();

    fireEvent.click(homePrevious!);
    expect(secondAudio.currentTime).toBe(0);
    secondAudio.currentTime = 4;
    fireEvent.click(homePrevious!);

    await waitFor(() => expect(screen.getAllByText('track-a').length).toBeGreaterThan(0));
    expect(MockAudio.instances.filter((audio) => !audio.paused && audio.src)).toHaveLength(1);
  });

  it('shows only hour and minute timer fields', async () => {
    render(<App />);
    await addTwoTracks();

    expect(screen.getByRole('spinbutton', { name: 'hr value' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'min value' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'sec value' })).not.toBeInTheDocument();
  });

  it('keeps Main fades alive for three seconds across starts, limits, and stops', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext);
    vi.mocked(fetch).mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    localStorage.setItem('night-sound-machine-library-v2', JSON.stringify([
      {
        id: 'main-a',
        name: 'Main A',
        kind: 'main',
        color: '#f5b873',
        enabled: true,
        volume: 100,
        limitEnabled: false,
        limitKind: 'count',
        limit: 5,
        timeLimit: 60000,
        plays: 0,
        autoStopEnabled: true,
        autoStopMode: 'fixed',
        minDuration: 1000,
        maxDuration: 1000,
        files: [{ id: 'main-a-file', name: 'main-a.wav', size: 8, role: 'main', url: 'blob:main-a' }],
      },
      {
        id: 'main-b',
        name: 'Main B',
        kind: 'main',
        color: '#8db3b8',
        enabled: true,
        volume: 100,
        limitEnabled: false,
        limitKind: 'count',
        limit: 5,
        timeLimit: 60000,
        plays: 0,
        autoStopEnabled: false,
        files: [{ id: 'main-b-file', name: 'main-b.wav', size: 8, role: 'main', url: 'blob:main-b' }],
      },
    ]));

    render(<App />);
    fireEvent.click(screen.getByTestId('button-start-session'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(MockAudioContext.instances[0]?.gains).toHaveLength(2);
    expect(MockBufferSourceNode.instances).toHaveLength(2);

    const context = MockAudioContext.instances[0];
    const [firstGain, secondGain] = context.gains;
    const [firstSource, secondSource] = MockBufferSourceNode.instances;
    const initialRamps = [firstGain, secondGain].map((gain) => gain.gain.events.find((event) => event.kind === 'ramp'));

    initialRamps.forEach((ramp) => {
      expect(ramp?.value).toBeCloseTo(0.62, 5);
      expect(ramp?.time).toBeCloseTo(3, 5);
    });
    [firstGain, secondGain].forEach((gain) => {
      const rampIndex = gain.gain.events.findIndex((event) => event.kind === 'ramp');
      expect(gain.gain.events[rampIndex - 1]?.value).toBe(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const firstLimitRamp = firstGain.gain.events.filter((event) => event.kind === 'ramp')[1];
    expect(firstLimitRamp?.value).toBe(0);
    expect(firstLimitRamp?.time).toBeCloseTo(context.currentTime + 3, 5);
    expect(secondGain.gain.events.filter((event) => event.kind === 'ramp')).toHaveLength(1);
    expect(firstSource.stop).not.toHaveBeenCalled();
    expect(secondSource.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('button-stop-session'));
    await act(async () => { await Promise.resolve(); });

    const secondStopRamp = secondGain.gain.events.filter((event) => event.kind === 'ramp')[1];
    expect(secondStopRamp?.value).toBe(0);
    expect(secondStopRamp?.time).toBeCloseTo(context.currentTime + 3, 5);
    expect(firstSource.stop).not.toHaveBeenCalled();
    expect(secondSource.stop).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(firstSource.stop).not.toHaveBeenCalled();
    expect(secondSource.stop).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(firstSource.stop).toHaveBeenCalledTimes(1);
    expect(secondSource.stop).toHaveBeenCalledTimes(1);
  });
});
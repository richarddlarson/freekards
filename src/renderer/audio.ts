/**
 * Audio engine (spec 13): Web Audio with three channels (music, sfx, voice), cue playback with
 * small random variation, and a shuffled, crossfading music playlist. Every failure is silent:
 * audio problems must never interrupt the game.
 */
const audioFiles = import.meta.glob<string>('../../assets/audio/**/*.{ogg,mp3,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const manifestFiles = import.meta.glob<AudioManifest>('../../spec/content/audio.json', { eager: true, import: 'default' });

export type Channel = 'music' | 'sfx' | 'voice';

interface AudioManifest {
  schemaVersion: 1;
  defaults: Record<Channel, number>;
  cues: Record<string, string[]>;
  music: { id: string; title: string; composer: string; file: string }[];
}

export interface Volumes {
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

const manifest: AudioManifest = Object.values(manifestFiles)[0] ?? {
  schemaVersion: 1,
  defaults: { music: 0.45, sfx: 0.8, voice: 1 },
  cues: {},
  music: [],
};

export const DEFAULT_VOLUMES: Volumes = { ...manifest.defaults, muted: false };

const TUNING = {
  pitchMin: 0.96,
  pitchMax: 1.04,
  gainMin: 0.9,
  dealMinGapMs: 70,
  crossfadeS: 3,
  firstFadeInS: 2,
};

/** Repo-relative path ("assets/…") → bundled URL. */
function urlFor(path: string): string | undefined {
  return audioFiles[`../../${path}`];
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Channel, GainNode>;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private lastPick = new Map<string, string>();
  private lastDeal = 0;
  private volumes: Volumes = { ...DEFAULT_VOLUMES };

  private playlist: AudioManifest['music'] = [];
  private current: { source: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
  private musicTimer = 0;
  /** Audio-clock time at which the next crossfade starts (the clock stops while the app is hidden). */
  private crossfadeAt = Infinity;
  private musicStarted = false;

  /** Create the audio graph lazily (also resumes after a user gesture if the browser suspended it). */
  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        for (const ch of ['music', 'sfx', 'voice'] as const) {
          const g = this.ctx.createGain();
          g.connect(this.master);
          this.buses[ch] = g;
        }
        this.applyVolumes();
        document.addEventListener('visibilitychange', () => this.onVisibility());
        const resume = () => void this.ctx?.resume();
        window.addEventListener('pointerdown', resume, { once: true });
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  setVolumes(v: Volumes): void {
    this.volumes = { ...v };
    if (this.ctx) this.applyVolumes();
  }

  getVolumes(): Volumes {
    return { ...this.volumes };
  }

  private applyVolumes(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : 1, t, 0.05);
    for (const ch of ['music', 'sfx', 'voice'] as const) {
      const p = Math.max(0, Math.min(1, this.volumes[ch]));
      this.buses[ch].gain.setTargetAtTime(p * p, t, 0.05);
    }
  }

  private load(path: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(path);
    if (!p) {
      const url = urlFor(path);
      const ctx = this.ensure();
      p = !url || !ctx
        ? Promise.resolve(null)
        : fetch(url)
            .then((r) => r.arrayBuffer())
            .then((b) => ctx.decodeAudioData(b))
            .catch(() => null);
      this.buffers.set(path, p);
    }
    return p;
  }

  /** Decode every effect up front so the first play of each cue has no delay. */
  preloadCues(): Promise<unknown> {
    return Promise.all(Object.values(manifest.cues).flat().map((p) => this.load(p)));
  }

  hasCue(cue: string): boolean {
    return (manifest.cues[cue] ?? []).some((p) => urlFor(p));
  }

  /** Play a sound cue (spec 13 §2). Fire-and-forget. */
  play(cue: string): void {
    const files = manifest.cues[cue];
    if (!files || files.length === 0) return;
    if (cue === 'card.deal') {
      const now = performance.now();
      if (now - this.lastDeal < TUNING.dealMinGapMs) return;
      this.lastDeal = now;
    }
    const last = this.lastPick.get(cue);
    const choices = files.length > 1 ? files.filter((f) => f !== last) : files;
    const file = choices[Math.floor(Math.random() * choices.length)]!;
    this.lastPick.set(cue, file);
    void this.load(file).then((buffer) => {
      const ctx = this.ctx;
      if (!buffer || !ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = TUNING.pitchMin + Math.random() * (TUNING.pitchMax - TUNING.pitchMin);
      const g = ctx.createGain();
      g.gain.value = TUNING.gainMin + Math.random() * (1 - TUNING.gainMin);
      src.connect(g).connect(this.buses.sfx);
      src.start();
    });
  }

  // ---------------------------------------------------------------- music

  /** Start the background playlist (idempotent). */
  startMusic(): void {
    if (this.musicStarted || manifest.music.length === 0 || !this.ensure()) return;
    this.musicStarted = true;
    void this.nextTrack(TUNING.firstFadeInS);
    this.musicTimer = window.setInterval(() => {
      if (this.ctx && this.ctx.currentTime >= this.crossfadeAt) {
        this.crossfadeAt = Infinity;
        void this.nextTrack(TUNING.crossfadeS);
      }
    }, 250);
  }

  private reshuffle(): void {
    const tracks = [...manifest.music];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j]!, tracks[i]!];
    }
    if (tracks.length > 1 && tracks[0]!.id === this.current?.id) tracks.push(tracks.shift()!);
    this.playlist = tracks;
  }

  private async nextTrack(fadeIn: number): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.playlist.length === 0) this.reshuffle();
    const track = this.playlist.shift();
    if (!track) return;
    const buffer = await this.load(track.file);
    if (!buffer) {
      this.crossfadeAt = ctx.currentTime + 1; // skip an unreadable track
      return;
    }
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + fadeIn);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(this.buses.music);
    source.start();

    const old = this.current;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + TUNING.crossfadeS);
      old.source.stop(t + TUNING.crossfadeS + 0.1);
    }
    this.current = { source, gain, id: track.id };
    this.crossfadeAt = t + Math.max(1, buffer.duration - TUNING.crossfadeS);
  }

  private onVisibility(): void {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}

export const audio = new AudioEngine();

/** Credits data for the About screen (later). */
export const MUSIC_TRACKS = manifest.music;

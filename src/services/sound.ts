import { getTrackFromDB } from './musicStorage';

export const DEFAULT_BGM_URL =
  '/assets/aistudio/Nay_tui_ch_i_th__game_geometry_dash_nha_391866df.mp4';
export const DEFAULT_BGM_MP3_URL = '/assets/aistudio/default_bg_music.mp3';
export const DEFAULT_BGM_FILE_NAME = 'Nay_tui_ch_i_th__game_geometry_dash_nha_391866df.mp4';
export const DEFAULT_BGM_NAME = 'Geometry Dash - Nhạc Mặc Định Đã Tích Hợp';

/**
 * Pure Web Audio API Sound Synthesizer + Built-in Default Audio Track + Large Custom Audio/Video File Support
 */
class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgTimer: number | null = null;
  private isMusicPlaying: boolean = false;

  private musicSource: 'default_track' | 'synth' | 'custom' = 'default_track';
  private customTrackName: string = '';
  private defaultAudio: HTMLAudioElement | null = null;
  private customAudio: HTMLAudioElement | null = null;
  private customAudioUrl: string | null = null;
  private musicVolume: number = 0.85;

  // Web Audio API Buffer playback for 100% reliable playback even after countdown setTimeouts
  private defaultRawBuffer: ArrayBuffer | null = null;
  private defaultAudioBuffer: AudioBuffer | null = null;
  private customAudioBuffer: AudioBuffer | null = null;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private activeBufferGain: GainNode | null = null;

  private trackLoadPromise: Promise<void> | null = null;

  constructor() {
    try {
      const savedMute = localStorage.getItem('classroom_sound_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }

      const savedSource = localStorage.getItem('classroom_music_source_v3');
      if (
        savedSource === 'default_track' ||
        savedSource === 'custom' ||
        savedSource === 'synth'
      ) {
        this.musicSource = savedSource;
      } else {
        this.musicSource = 'default_track';
        localStorage.setItem('classroom_music_source_v3', 'default_track');
      }

      const savedVol = localStorage.getItem('classroom_music_volume');
      if (savedVol !== null) {
        this.musicVolume = parseFloat(savedVol) || 0.85;
      }
    } catch {}

    if (typeof window !== 'undefined') {
      // 1. Initialize HTMLAudioElement with MP3 primary and MP4 fallback
      const defAudio = new Audio(DEFAULT_BGM_MP3_URL);
      defAudio.preload = 'auto';
      defAudio.loop = true;
      defAudio.volume = this.musicVolume;
      defAudio.onerror = () => {
        if (defAudio.src.indexOf(DEFAULT_BGM_URL) === -1) {
          defAudio.src = DEFAULT_BGM_URL;
        }
      };
      this.defaultAudio = defAudio;

      // 2. Pre-fetch built-in default track into ArrayBuffer so Web Audio API can play it anywhere
      this.preloadDefaultTrackBuffer();

      // 3. Unlock AudioContext on first user interaction anywhere in the document
      const unlockAudio = () => {
        const ctx = this.initCtx();
        if (ctx && this.defaultRawBuffer && !this.defaultAudioBuffer) {
          ctx
            .decodeAudioData(this.defaultRawBuffer.slice(0))
            .then((decoded) => {
              this.defaultAudioBuffer = decoded;
            })
            .catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }

    // Load custom track from IndexedDB asynchronously if available
    this.trackLoadPromise = getTrackFromDB('bg_music')
      .then((track) => {
        if (track) {
          if (track.blob) {
            return this.loadCustomTrackFromBlob(track.blob, track.name);
          } else if (track.data) {
            return this.loadCustomTrackFromBuffer(track.data, track.name, track.type);
          }
        }
      })
      .catch(() => {});
  }

  private async preloadDefaultTrackBuffer(): Promise<void> {
    try {
      let res = await fetch(DEFAULT_BGM_MP3_URL);
      if (!res.ok) {
        res = await fetch(DEFAULT_BGM_URL);
      }
      if (res.ok) {
        const buf = await res.arrayBuffer();
        this.defaultRawBuffer = buf;
        if (this.ctx) {
          this.ctx
            .decodeAudioData(buf.slice(0))
            .then((decoded) => {
              this.defaultAudioBuffer = decoded;
            })
            .catch(() => {});
        }
      }
    } catch {}
  }

  public async ensureTrackLoaded(): Promise<{ source: string; trackName: string; volume: number }> {
    if (this.trackLoadPromise) {
      await this.trackLoadPromise;
    }
    if (!this.customTrackName) {
      const track = await getTrackFromDB('bg_music');
      if (track) {
        if (track.blob) {
          await this.loadCustomTrackFromBlob(track.blob, track.name);
        } else if (track.data) {
          await this.loadCustomTrackFromBuffer(track.data, track.name, track.type);
        }
      }
    }
    if (this.musicSource === 'custom' && !this.customTrackName) {
      this.musicSource = 'default_track';
    }
    return {
      source: this.musicSource,
      trackName: this.customTrackName,
      volume: this.musicVolume,
    };
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('classroom_sound_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopBgMusic();
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    localStorage.setItem('classroom_sound_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopBgMusic();
    }
  }

  /**
   * Crisp mechanical click/tick for wheel pegs or card sliding
   */
  public playTick(pitchMultiplier: number = 1): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const baseFreq = 700 * pitchMultiplier;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  /**
   * Countdown beep for racing (low pitch for 3-2-1, high pitch for GO)
   */
  public playCountdown(isGo: boolean = false): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isGo ? 'sawtooth' : 'sine';
      const freq = isGo ? 880 : 440;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (isGo) {
        osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.3);
      }

      const duration = isGo ? 0.45 : 0.22;
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  /**
   * Sports starter whistle
   */
  public playWhistle(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(2600, ctx.currentTime);
      osc2.frequency.setValueAtTime(2850, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.22, ctx.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.55);
      osc2.stop(ctx.currentTime + 0.55);
    } catch {}
  }

  /**
   * Grand fanfare victory chords when student is selected
   */
  public playFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.stopBgMusic();

    try {
      const notes = [
        { f: 523.25, t: 0, d: 0.18 }, // C5
        { f: 659.25, t: 0.18, d: 0.18 }, // E5
        { f: 783.99, t: 0.36, d: 0.22 }, // G5
        { f: 1046.5, t: 0.58, d: 0.8 }, // C6 long
        { f: 1318.51, t: 0.65, d: 0.75 }, // E6 harmony
      ];

      notes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime + t);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.03);
        gain.gain.setValueAtTime(0.22, ctx.currentTime + t + d * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + d);
      });

      this.playApplause();
    } catch {}
  }

  /**
   * Crowd cheering / applause sound synthesized with white noise
   */
  public playApplause(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * 2.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const clapMod = 0.5 + 0.5 * Math.sin((i / ctx.sampleRate) * 45 * Math.PI);
        data[i] = white * clapMod;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, ctx.currentTime);
      filter.Q.setValueAtTime(1.2, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + 1.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {}
  }

  public getMusicSource(): string {
    return this.musicSource;
  }

  public setMusicSource(source: string): void {
    if (source === 'custom') {
      this.musicSource = 'custom';
    } else if (source === 'synth') {
      this.musicSource = 'synth';
    } else {
      this.musicSource = 'default_track';
    }
    try {
      localStorage.setItem('classroom_music_source_v3', this.musicSource);
    } catch {}
    if (this.isMusicPlaying) {
      this.stopBgMusic();
      this.startBgMusic();
    }
  }

  public getCustomTrackName(): string {
    return this.customTrackName;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('classroom_music_volume', String(this.musicVolume));
    } catch {}
    if (this.defaultAudio) {
      this.defaultAudio.volume = this.musicVolume;
    }
    if (this.customAudio) {
      this.customAudio.volume = this.musicVolume;
    }
    if (this.activeBufferGain && this.ctx) {
      this.activeBufferGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  /**
   * Load custom track from a File or Blob of ANY size (supports 100MB - 1GB+ files with zero RAM spike)
   */
  public async loadCustomTrackFromBlob(blob: Blob, name: string): Promise<void> {
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
    }
    this.customAudioUrl = URL.createObjectURL(blob);
    this.customTrackName = name;
    this.customAudioBuffer = null;

    const audio = new Audio(this.customAudioUrl);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = this.musicVolume;
    this.customAudio = audio;

    // For files <= 45MB, also decode into Web Audio buffer so countdown setTimeouts never block playback
    if (blob.size <= 45 * 1024 * 1024) {
      try {
        const ab = await blob.arrayBuffer();
        const ctx = this.initCtx();
        if (ctx) {
          ctx
            .decodeAudioData(ab.slice(0))
            .then((decoded) => {
              this.customAudioBuffer = decoded;
            })
            .catch(() => {});
        }
      } catch {}
    }

    if (this.isMusicPlaying && this.musicSource === 'custom') {
      this.playCustomAudio();
    }
  }

  public async loadCustomTrackFromBuffer(
    buffer: ArrayBuffer,
    name: string,
    type: string
  ): Promise<void> {
    const blob = new Blob([buffer], { type: type || 'audio/mp3' });
    return this.loadCustomTrackFromBlob(blob, name);
  }

  private playWebAudioBuffer(buffer: AudioBuffer): boolean {
    const ctx = this.initCtx();
    if (!ctx) return false;
    try {
      this.stopActiveBufferSource();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.musicVolume, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      this.activeBufferSource = source;
      this.activeBufferGain = gain;
      return true;
    } catch {
      return false;
    }
  }

  private stopActiveBufferSource(): void {
    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {}
      this.activeBufferSource = null;
    }
    if (this.activeBufferGain) {
      try {
        this.activeBufferGain.disconnect();
      } catch {}
      this.activeBufferGain = null;
    }
  }

  private playDefaultAudio(): void {
    if (this.isMuted) return;

    // 1. Prefer Web Audio API AudioBuffer if decoded (never blocked by setTimeout autoplay restrictions)
    if (this.defaultAudioBuffer) {
      if (this.playWebAudioBuffer(this.defaultAudioBuffer)) {
        return;
      }
    }

    // If raw buffer is loaded but not decoded yet, decode now and start immediately
    const ctx = this.initCtx();
    if (ctx && this.defaultRawBuffer && !this.defaultAudioBuffer) {
      ctx
        .decodeAudioData(this.defaultRawBuffer.slice(0))
        .then((decoded) => {
          this.defaultAudioBuffer = decoded;
          if (this.isMusicPlaying && this.musicSource === 'default_track' && !this.isMuted) {
            if (this.defaultAudio) {
              try {
                this.defaultAudio.pause();
              } catch {}
            }
            this.playWebAudioBuffer(decoded);
          }
        })
        .catch(() => {});
    }

    // 2. HTMLAudioElement playback
    if (!this.defaultAudio && typeof window !== 'undefined') {
      const defAudio = new Audio(DEFAULT_BGM_MP3_URL);
      defAudio.loop = true;
      defAudio.volume = this.musicVolume;
      defAudio.onerror = () => {
        if (defAudio.src.indexOf(DEFAULT_BGM_URL) === -1) {
          defAudio.src = DEFAULT_BGM_URL;
          if (this.isMusicPlaying && !this.isMuted) {
            defAudio.play().catch(() => {});
          }
        }
      };
      this.defaultAudio = defAudio;
    }
    if (!this.defaultAudio) return;

    this.defaultAudio.volume = this.musicVolume;
    this.defaultAudio.loop = true;
    if (this.defaultAudio.ended || isNaN(this.defaultAudio.currentTime)) {
      this.defaultAudio.currentTime = 0;
    }
    const playPromise = this.defaultAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const unlock = () => {
          if (
            this.defaultAudio &&
            this.musicSource === 'default_track' &&
            !this.isMuted &&
            this.isMusicPlaying &&
            !this.activeBufferSource
          ) {
            this.defaultAudio.play().catch(() => {});
          }
          window.removeEventListener('click', unlock);
          window.removeEventListener('pointerdown', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('pointerdown', unlock, { once: true });
      });
    }
  }

  private playCustomAudio(): void {
    if (this.isMuted) return;

    // 1. If decoded into Web Audio buffer, play via Web Audio API for zero setTimeout blocking
    if (this.customAudioBuffer) {
      if (this.playWebAudioBuffer(this.customAudioBuffer)) {
        return;
      }
    }

    // 2. Otherwise play via HTMLAudioElement (supports huge 100MB-1GB files via streaming Blob URL)
    if (!this.customAudio) return;

    this.customAudio.volume = this.musicVolume;
    this.customAudio.loop = true;
    if (this.customAudio.ended || isNaN(this.customAudio.currentTime)) {
      this.customAudio.currentTime = 0;
    }
    const playPromise = this.customAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Custom audio play prevented by browser:', err);
        const unlock = () => {
          if (
            this.customAudio &&
            this.musicSource === 'custom' &&
            !this.isMuted &&
            this.isMusicPlaying &&
            !this.activeBufferSource
          ) {
            this.customAudio.play().catch(() => {});
          }
          window.removeEventListener('click', unlock);
          window.removeEventListener('pointerdown', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('pointerdown', unlock, { once: true });
      });
    }
  }

  public removeCustomTrack(): void {
    this.stopActiveBufferSource();
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio = null;
    }
    if (this.customAudioUrl) {
      URL.revokeObjectURL(this.customAudioUrl);
      this.customAudioUrl = null;
    }
    this.customTrackName = '';
    this.customAudioBuffer = null;
    this.musicSource = 'default_track';
    try {
      localStorage.setItem('classroom_music_source_v3', 'default_track');
    } catch {}
  }

  public startPreview(): void {
    this.stopBgMusic();
    this.startBgMusic();
  }

  public stopPreview(): void {
    this.stopBgMusic();
  }

  /**
   * Joyful, high-energy, upbeat game music while spinning/playing
   * Supports Built-in Default Track (Geometry Dash), Custom Audio/Video files, or Web Audio Synthesizer
   */
  public startBgMusic(): void {
    if (this.isMuted) return;

    this.initCtx(); // Resume AudioContext on user interaction

    // 1. Default Built-in Track (Geometry Dash)
    if (this.musicSource === 'default_track') {
      this.stopBgMusic();
      this.isMusicPlaying = true;
      this.playDefaultAudio();
      return;
    }

    // 2. Check if user selected custom uploaded track
    if (this.musicSource === 'custom') {
      this.stopBgMusic();
      this.isMusicPlaying = true;
      if (this.customAudio || this.customAudioBuffer) {
        this.playCustomAudio();
      } else if (this.trackLoadPromise) {
        this.trackLoadPromise.then(() => {
          if (this.musicSource === 'custom' && (this.customAudio || this.customAudioBuffer)) {
            this.playCustomAudio();
          } else {
            this.playDefaultAudio();
          }
        });
      } else {
        this.playDefaultAudio();
      }
      return;
    }

    // 3. Web Audio Synthesizer Loop
    if (this.isMusicPlaying && this.bgTimer !== null) return;
    this.stopBgMusic();
    this.isMusicPlaying = true;

    const ctx = this.initCtx();
    if (!ctx) return;

    const bpm = 146;
    const beatTime = 60 / bpm;
    const stepTime = beatTime / 2;

    const chordRoots = [
      { name: 'C', base: 261.63, notes: [261.63, 329.63, 392.0, 523.25, 659.25] },
      { name: 'G', base: 196.0, notes: [196.0, 246.94, 293.66, 392.0, 493.88] },
      { name: 'Am', base: 220.0, notes: [220.0, 261.63, 329.63, 440.0, 523.25] },
      { name: 'F', base: 174.61, notes: [174.61, 220.0, 261.63, 349.23, 440.0] },
      { name: 'C', base: 261.63, notes: [261.63, 329.63, 392.0, 523.25, 659.25] },
      { name: 'Em', base: 164.81, notes: [164.81, 196.0, 246.94, 329.63, 392.0] },
      { name: 'F', base: 174.61, notes: [174.61, 220.0, 261.63, 349.23, 523.25] },
      { name: 'G', base: 196.0, notes: [196.0, 246.94, 293.66, 392.0, 587.33] },
    ];

    const melodyPattern = [0, 2, 4, 3, 1, 3, 2, 4];
    let chordIdx = 0;
    let step = 0;

    const playStep = () => {
      if (!this.isMusicPlaying || this.isMuted || !this.ctx) return;

      const chord = chordRoots[chordIdx % chordRoots.length];
      const noteIdx = melodyPattern[step % melodyPattern.length];
      const freq = chord.notes[noteIdx % chord.notes.length];

      try {
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = step % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq * 1.5, now);

        const vol = 0.06 * this.musicVolume;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.75);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + stepTime * 0.75);

        if (step % 2 === 0) {
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();

          bassOsc.type = 'triangle';
          const bassFreq = step === 0 ? chord.base * 0.5 : chord.notes[2] * 0.5;
          bassOsc.frequency.setValueAtTime(bassFreq, now);

          const bassVol = 0.09 * this.musicVolume;
          bassGain.gain.setValueAtTime(0.001, now);
          bassGain.gain.linearRampToValueAtTime(bassVol, now + 0.02);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 1.4);

          bassOsc.connect(bassGain);
          bassGain.connect(this.ctx.destination);

          bassOsc.start(now);
          bassOsc.stop(now + stepTime * 1.4);
        }

        if (step % 2 === 1) {
          const hatOsc = this.ctx.createOscillator();
          const hatGain = this.ctx.createGain();
          hatOsc.type = 'square';
          hatOsc.frequency.setValueAtTime(1400 + Math.random() * 600, now);

          const hatVol = 0.02 * this.musicVolume;
          hatGain.gain.setValueAtTime(hatVol, now);
          hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

          hatOsc.connect(hatGain);
          hatGain.connect(this.ctx.destination);

          hatOsc.start(now);
          hatOsc.stop(now + 0.04);
        }
      } catch {}

      step++;
      if (step >= 8) {
        step = 0;
        chordIdx++;
      }

      this.bgTimer = window.setTimeout(playStep, stepTime * 1000);
    };

    playStep();
  }

  public stopBgMusic(): void {
    this.isMusicPlaying = false;
    this.stopActiveBufferSource();
    if (this.bgTimer !== null) {
      clearTimeout(this.bgTimer);
      this.bgTimer = null;
    }
    if (this.defaultAudio) {
      try {
        this.defaultAudio.pause();
      } catch {}
    }
    if (this.customAudio) {
      try {
        this.customAudio.pause();
      } catch {}
    }
  }

  public playCosmicSweep(rate: number = 1): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const startF = 350 * rate;
      const endF = 720 * rate;
      osc.frequency.setValueAtTime(startF, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endF, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  public playSciFiLock(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  }

  public playFlyWhoosh(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.35);
      osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.7);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.75);
    } catch {}
  }

  public playChimeReveal(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      [784, 988, 1175, 1568].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.08);

        gain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.5);
      });
    } catch {}
  }

  public playBuzzer(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.setValueAtTime(130, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  public playSelect(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  public playPull(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }
}

export const sound = new SoundService();

import { Howl, Howler } from 'howler'

export interface AudioCallbacks {
  onPlay?: () => void
  onPause?: () => void
  onEnd?: () => void
  onLoad?: (duration: number) => void
  onError?: (error: unknown) => void
  onProgress?: (seek: number, duration: number) => void
}

class AudioEngine {
  private howl: Howl | null = null
  private callbacks: AudioCallbacks = {}
  private progressRaf: number | null = null
  private _volume = 0.8

  constructor() {
    Howler.volume(this._volume)
  }

  load(src: string, fallbackSrcs: string[] = []): void {
    this.destroy()

    const sources = [src, ...fallbackSrcs]

    this.howl = new Howl({
      src: sources,
      html5: true,
      preload: true,
      volume: this._volume,
      format: ['mp3', 'ogg', 'aac', 'webm'],
      onplay: () => {
        this.startProgressLoop()
        this.callbacks.onPlay?.()
      },
      onpause: () => {
        this.stopProgressLoop()
        this.callbacks.onPause?.()
      },
      onend: () => {
        this.stopProgressLoop()
        this.callbacks.onEnd?.()
      },
      onload: () => {
        const dur = this.howl?.duration() ?? 0
        this.callbacks.onLoad?.(dur)
      },
      onloaderror: (_id: number, err: unknown) => {
        console.error('[AudioEngine] load error:', err)
        this.callbacks.onError?.(err)
      },
      onplayerror: (_id: number, err: unknown) => {
        console.error('[AudioEngine] play error:', err)
        this.howl?.once('unlock', () => this.howl?.play())
        this.callbacks.onError?.(err)
      },
    })
  }

  play(): void {
    this.howl?.play()
  }

  pause(): void {
    this.howl?.pause()
  }

  stop(): void {
    this.howl?.stop()
    this.stopProgressLoop()
  }

  seek(pos: number): void {
    if (this.howl) {
      this.howl.seek(pos)
    }
  }

  volume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    Howler.volume(this._volume)
  }

  getVolume(): number {
    return this._volume
  }

  duration(): number {
    return this.howl?.duration() ?? 0
  }

  position(): number {
    if (!this.howl) return 0
    const pos = this.howl.seek()
    return typeof pos === 'number' ? pos : 0
  }

  isPlaying(): boolean {
    return this.howl?.playing() ?? false
  }

  setCallbacks(cb: AudioCallbacks): void {
    this.callbacks = cb
  }

  private startProgressLoop(): void {
    this.stopProgressLoop()
    const tick = () => {
      if (this.howl?.playing()) {
        const pos = this.position()
        const dur = this.duration()
        this.callbacks.onProgress?.(pos, dur)
        this.progressRaf = requestAnimationFrame(tick)
      }
    }
    this.progressRaf = requestAnimationFrame(tick)
  }

  private stopProgressLoop(): void {
    if (this.progressRaf !== null) {
      cancelAnimationFrame(this.progressRaf)
      this.progressRaf = null
    }
  }

  destroy(): void {
    this.stopProgressLoop()
    if (this.howl) {
      this.howl.unload()
      this.howl = null
    }
  }
}

// Singleton instance
let engine: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine()
  }
  return engine
}

export type { AudioEngine }

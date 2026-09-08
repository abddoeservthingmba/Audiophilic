export interface AudioCallbacks {
  onPlay?: () => void
  onPause?: () => void
  onEnd?: () => void
  onLoad?: (duration: number) => void
  onError?: (error: unknown) => void
  onProgress?: (seek: number, duration: number) => void
}

class AudioEngine {
  private audio: HTMLAudioElement | null = null
  private callbacks: AudioCallbacks = {}
  private _volume = 0.8
  private isLoaded = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio()
      this.audio.preload = 'auto'
      this.audio.volume = this._volume

      this.audio.addEventListener('play', () => {
        this.callbacks.onPlay?.()
      })

      this.audio.addEventListener('pause', () => {
        this.callbacks.onPause?.()
      })

      this.audio.addEventListener('ended', () => {
        this.callbacks.onEnd?.()
      })

      this.audio.addEventListener('loadedmetadata', () => {
        this.isLoaded = true
        if (this.audio) {
          const dur = isFinite(this.audio.duration) ? this.audio.duration : 0
          this.callbacks.onLoad?.(dur)
        }
      })

      this.audio.addEventListener('durationchange', () => {
        if (this.audio) {
          const dur = isFinite(this.audio.duration) ? this.audio.duration : 0
          this.callbacks.onLoad?.(dur)
        }
      })

      this.audio.addEventListener('timeupdate', () => {
        if (this.audio && isFinite(this.audio.currentTime)) {
          const dur = isFinite(this.audio.duration) ? this.audio.duration : 0
          this.callbacks.onProgress?.(this.audio.currentTime, dur)
        }
      })

      this.audio.addEventListener('error', (e) => {
        this.callbacks.onError?.(e)
      })
    }
  }

  load(src: string): void {
    if (!this.audio) return
    this.isLoaded = false
    this.audio.src = src
    this.audio.load()
  }

  play(): Promise<void> | void {
    if (!this.audio) return
    return this.audio.play().catch((err) => {
      this.callbacks.onError?.(err)
    })
  }

  pause(): void {
    this.audio?.pause()
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
    }
  }

  seek(pos: number): void {
    if (this.audio && isFinite(pos)) {
      this.audio.currentTime = pos
    }
  }

  volume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.audio) {
      this.audio.volume = this._volume
    }
  }

  getVolume(): number {
    return this._volume
  }

  duration(): number {
    if (this.audio && isFinite(this.audio.duration)) {
      return this.audio.duration
    }
    return 0
  }

  position(): number {
    if (this.audio && isFinite(this.audio.currentTime)) {
      return this.audio.currentTime
    }
    return 0
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false
  }

  setCallbacks(cb: AudioCallbacks): void {
    this.callbacks = cb
  }

  destroy(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
    }
  }
}

let engineInstance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine()
  }
  return engineInstance
}

export type { AudioEngine }

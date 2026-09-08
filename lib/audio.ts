export interface AudioCallbacks {
  onPlay?: () => void
  onPause?: () => void
  onEnd?: () => void
  onLoad?: (duration: number) => void
  onError?: (error: unknown) => void
  onProgress?: (seek: number, duration: number) => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

class AudioEngine {
  private audio: HTMLAudioElement | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ytPlayer: any = null
  private callbacks: AudioCallbacks = {}
  private _volume = 0.8
  private currentYtId: string | null = null
  private currentStreamUrl: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private progressInterval: any = null
  private useYtIframe = true

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio()
      this.audio.preload = 'auto'
      this.audio.volume = this._volume

      this.audio.addEventListener('play', () => {
        if (!this.useYtIframe) this.callbacks.onPlay?.()
      })

      this.audio.addEventListener('pause', () => {
        if (!this.useYtIframe) this.callbacks.onPause?.()
      })

      this.audio.addEventListener('ended', () => {
        if (!this.useYtIframe) this.callbacks.onEnd?.()
      })

      this.audio.addEventListener('loadedmetadata', () => {
        if (!this.useYtIframe && this.audio) {
          const dur = isFinite(this.audio.duration) ? this.audio.duration : 0
          this.callbacks.onLoad?.(dur)
        }
      })

      this.audio.addEventListener('timeupdate', () => {
        if (!this.useYtIframe && this.audio && isFinite(this.audio.currentTime)) {
          const dur = isFinite(this.audio.duration) ? this.audio.duration : 0
          this.callbacks.onProgress?.(this.audio.currentTime, dur)
        }
      })

      this.audio.addEventListener('error', (e) => {
        if (!this.useYtIframe) this.callbacks.onError?.(e)
      })

      this.initYouTubeIframe()
    }
  }

  private initYouTubeIframe() {
    if (typeof window === 'undefined') return

    let container = document.getElementById('audiophilic-yt-container') as HTMLDivElement
    if (!container) {
      container = document.createElement('div')
      container.id = 'audiophilic-yt-container'
      container.style.position = 'fixed'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.width = '1px'
      container.style.height = '1px'
      container.style.opacity = '0'
      container.style.pointerEvents = 'none'
      document.body.appendChild(container)
    }

    let playerDiv = document.getElementById('audiophilic-yt-player')
    if (!playerDiv) {
      playerDiv = document.createElement('div')
      playerDiv.id = 'audiophilic-yt-player'
      container.appendChild(playerDiv)
    }

    const createPlayer = () => {
      if (this.ytPlayer) return
      try {
        this.ytPlayer = new window.YT.Player('audiophilic-yt-player', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
                this.ytPlayer.setVolume(this._volume * 100)
              }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onStateChange: (event: any) => {
              if (event.data === 1) { // PLAYING
                this.callbacks.onPlay?.()
                this.startProgressTimer()
              } else if (event.data === 2) { // PAUSED
                this.callbacks.onPause?.()
                this.stopProgressTimer()
              } else if (event.data === 0) { // ENDED
                this.stopProgressTimer()
                this.callbacks.onEnd?.()
              }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onError: (err: any) => {
              console.warn('YT Iframe error, falling back to stream endpoint:', err)
              this.useYtIframe = false
              if (this.currentStreamUrl) {
                this.loadHtml5(this.currentStreamUrl)
              }
            },
          },
        })
      } catch (e) {
        console.warn('Failed to initialize YT Iframe Player:', e)
      }
    }

    if (window.YT && window.YT.Player) {
      createPlayer()
    } else {
      if (!document.getElementById('yt-iframe-script')) {
        const tag = document.createElement('script')
        tag.id = 'yt-iframe-script'
        tag.src = 'https://www.youtube.com/iframe_api'
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
      }
      const prevFn = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (prevFn) prevFn()
        createPlayer()
      }
    }
  }

  private startProgressTimer() {
    this.stopProgressTimer()
    this.progressInterval = setInterval(() => {
      if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        const pos = this.ytPlayer.getCurrentTime() || 0
        const dur = this.ytPlayer.getDuration() || 0
        this.callbacks.onProgress?.(pos, dur)
      }
    }, 250)
  }

  private stopProgressTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }

  load(ytIdOrUrl: string, ytId?: string): void {
    let targetYtId = ytId || null
    if (!targetYtId) {
      if (ytIdOrUrl.startsWith('yt-')) {
        targetYtId = ytIdOrUrl.replace('yt-', '')
      } else if (ytIdOrUrl.includes('ytId=')) {
        try {
          const urlObj = new URL(ytIdOrUrl, 'http://dummy.local')
          targetYtId = urlObj.searchParams.get('ytId')
        } catch {
          targetYtId = null
        }
      }
    }

    this.currentStreamUrl = ytIdOrUrl
    this.currentYtId = targetYtId

    if (this.useYtIframe && targetYtId && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
      try {
        this.ytPlayer.loadVideoById(targetYtId)
        if (typeof this.ytPlayer.setVolume === 'function') {
          this.ytPlayer.setVolume(this._volume * 100)
        }
        return
      } catch (e) {
        console.warn('ytPlayer.loadVideoById failed, falling back:', e)
      }
    }

    this.loadHtml5(ytIdOrUrl)
  }

  private loadHtml5(src: string) {
    if (!this.audio) return
    this.useYtIframe = false
    this.audio.src = src
    this.audio.load()
  }

  play(): Promise<void> | void {
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo()
        return
      } catch (e) {
        console.warn('ytPlayer.playVideo failed:', e)
      }
    }

    if (this.audio) {
      return this.audio.play().catch((err) => {
        this.callbacks.onError?.(err)
      })
    }
  }

  pause(): void {
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo()
        return
      } catch {
        // fallback
      }
    }
    this.audio?.pause()
  }

  stop(): void {
    this.stopProgressTimer()
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      try {
        this.ytPlayer.stopVideo()
        return
      } catch {}
    }
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
    }
  }

  seek(pos: number): void {
    if (isFinite(pos)) {
      if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
        try {
          this.ytPlayer.seekTo(pos, true)
          return
        } catch {}
      }
      if (this.audio) {
        this.audio.currentTime = pos
      }
    }
  }

  volume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(this._volume * 100)
      } catch {}
    }
    if (this.audio) {
      this.audio.volume = this._volume
    }
  }

  getVolume(): number {
    return this._volume
  }

  duration(): number {
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      try {
        const d = this.ytPlayer.getDuration()
        if (d > 0) return d
      } catch {}
    }
    if (this.audio && isFinite(this.audio.duration)) {
      return this.audio.duration
    }
    return 0
  }

  position(): number {
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        return this.ytPlayer.getCurrentTime() || 0
      } catch {}
    }
    if (this.audio && isFinite(this.audio.currentTime)) {
      return this.audio.currentTime
    }
    return 0
  }

  isPlaying(): boolean {
    if (this.useYtIframe && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
      try {
        return this.ytPlayer.getPlayerState() === 1 // 1 = PLAYING
      } catch {}
    }
    return this.audio ? !this.audio.paused : false
  }

  setCallbacks(cb: AudioCallbacks): void {
    this.callbacks = cb
  }

  destroy(): void {
    this.stopProgressTimer()
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy()
      } catch {}
    }
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


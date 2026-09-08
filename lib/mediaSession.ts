import type { Track } from './api'

export interface MediaSessionHandlers {
  onPlay?: () => void
  onPause?: () => void
  onPreviousTrack?: () => void
  onNextTrack?: () => void
  onSeekTo?: (time: number) => void
  onSeekBackward?: (offset: number) => void
  onSeekForward?: (offset: number) => void
}

export function updateMediaSession(track: Track): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.title,
    artwork: [
      { src: track.artwork['150x150'], sizes: '150x150', type: 'image/jpeg' },
      { src: track.artwork['480x480'], sizes: '480x480', type: 'image/jpeg' },
      { src: track.artwork['1000x1000'], sizes: '1000x1000', type: 'image/jpeg' },
    ],
  })
}

export function setMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

  const ms = navigator.mediaSession

  ms.setActionHandler('play', () => handlers.onPlay?.())
  ms.setActionHandler('pause', () => handlers.onPause?.())
  ms.setActionHandler('previoustrack', () => handlers.onPreviousTrack?.())
  ms.setActionHandler('nexttrack', () => handlers.onNextTrack?.())

  ms.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) {
      handlers.onSeekTo?.(details.seekTime)
    }
  })

  ms.setActionHandler('seekbackward', (details) => {
    handlers.onSeekBackward?.(details.seekOffset ?? 10)
  })

  ms.setActionHandler('seekforward', (details) => {
    handlers.onSeekForward?.(details.seekOffset ?? 10)
  })
}

export function updatePositionState(duration: number, position: number, playbackRate = 1): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  if (!navigator.mediaSession.setPositionState) return
  if (!isFinite(duration) || duration <= 0) return

  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(position, duration),
      playbackRate,
    })
  } catch {
    // Silently ignore if position is out of range during seek
  }
}

export function setMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = state
}

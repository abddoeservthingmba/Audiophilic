'use client'

import { useEffect, useRef } from 'react'
import { getAudioEngine } from '@/lib/audio'
import {
  updateMediaSession,
  setMediaSessionHandlers,
  updatePositionState,
  setMediaSessionPlaybackState,
} from '@/lib/mediaSession'
import { usePlayerStore } from '@/store/usePlayerStore'

export default function AudioController() {
  const {
    queue,
    currentIndex,
    isPlaying,
    volume,
    progress,
    setProgress,
    setDuration,
    setIsPlaying,
    playNext,
    playPrev,
    setQueue,
  } = usePlayerStore()

  const engine = useRef(getAudioEngine())
  const lastTrackId = useRef<string | null>(null)
  const seekPendingRef = useRef<number | null>(null)

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  // Load track when currentIndex changes
  useEffect(() => {
    if (!currentTrack) return
    if (currentTrack.id === lastTrackId.current) return
    lastTrackId.current = currentTrack.id

    engine.current.setCallbacks({
      onLoad: (duration) => {
        setDuration(duration)
        if (seekPendingRef.current !== null) {
          engine.current.seek(seekPendingRef.current)
          seekPendingRef.current = null
        }
      },
      onEnd: () => {
        playNext()
      },
      onError: () => {
        // Auto-advance on unrecoverable error
        setTimeout(() => playNext(), 1500)
      },
      onProgress: (pos, dur) => {
        setProgress(pos)
        updatePositionState(dur, pos)
      },
    })

    engine.current.load(currentTrack.streamUrl)
    updateMediaSession(currentTrack)
  }, [currentTrack, playNext, setDuration, setProgress])

  // Play / pause
  useEffect(() => {
    if (!currentTrack) return
    if (isPlaying) {
      engine.current.play()
      setMediaSessionPlaybackState('playing')
    } else {
      engine.current.pause()
      setMediaSessionPlaybackState('paused')
    }
  }, [isPlaying, currentTrack])

  // Seek when user scrubs
  const storeProgress = usePlayerStore((s) => s.progress)
  const enginePos = engine.current.position()
  const scrubDelta = Math.abs(storeProgress - enginePos)

  useEffect(() => {
    // Only seek if user explicitly changed progress (delta > 1.5s and engine is loaded)
    if (scrubDelta > 1.5 && engine.current.duration() > 0) {
      engine.current.seek(storeProgress)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeProgress])

  // Volume sync
  useEffect(() => {
    engine.current.volume(volume)
  }, [volume])

  // Media session handlers
  useEffect(() => {
    setMediaSessionHandlers({
      onPlay: () => usePlayerStore.getState().setIsPlaying(true),
      onPause: () => usePlayerStore.getState().setIsPlaying(false),
      onNextTrack: () => usePlayerStore.getState().playNext(),
      onPreviousTrack: () => usePlayerStore.getState().playPrev(),
      onSeekTo: (time) => {
        usePlayerStore.getState().setProgress(time)
        engine.current.seek(time)
      },
      onSeekBackward: (offset) => {
        const pos = engine.current.position()
        const newPos = Math.max(0, pos - offset)
        usePlayerStore.getState().setProgress(newPos)
        engine.current.seek(newPos)
      },
      onSeekForward: (offset) => {
        const pos = engine.current.position()
        const dur = engine.current.duration()
        const newPos = Math.min(dur, pos + offset)
        usePlayerStore.getState().setProgress(newPos)
        engine.current.seek(newPos)
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup
  useEffect(() => {
    const eng = engine.current
    return () => {
      eng.destroy()
    }
  }, [])

  // Suppress unused var warning — setQueue used by page
  void setQueue

  return null
}

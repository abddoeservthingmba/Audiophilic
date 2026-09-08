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
  } = usePlayerStore()

  const engine = useRef(getAudioEngine())
  const lastTrackId = useRef<string | null>(null)

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  // ── Load / switch track ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return
    if (currentTrack.id === lastTrackId.current) return
    lastTrackId.current = currentTrack.id

    // Set initial duration from metadata immediately (never blank or 0:00)
    if (currentTrack.duration > 0) {
      setDuration(currentTrack.duration)
    }

    updateMediaSession(currentTrack)

    engine.current.setCallbacks({
      onLoad: (dur) => {
        if (dur > 0) setDuration(dur)
      },
      onEnd: () => playNext(),
      onError: () => {
        // Stop infinite skip loop: pause and do not auto-skip repeatedly
        setIsPlaying(false)
      },
      onProgress: (pos, dur) => {
        setProgress(pos)
        if (dur > 0) setDuration(dur)
        updatePositionState(dur > 0 ? dur : currentTrack.duration, pos)
      },
    })

    engine.current.load(currentTrack.streamUrl)

    if (isPlaying) {
      engine.current.play()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack])

  // ── Play / pause ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return

    if (isPlaying) {
      engine.current.play()
      setMediaSessionPlaybackState('playing')
    } else {
      engine.current.pause()
      setMediaSessionPlaybackState('paused')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // ── Seek ───────────────────────────────────────────────────────────────────
  const storeProgress = usePlayerStore((s) => s.progress)
  const enginePos = engine.current.position()

  useEffect(() => {
    if (currentTrack) {
      if (Math.abs(storeProgress - enginePos) > 1.5 && engine.current.duration() > 0) {
        engine.current.seek(storeProgress)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeProgress])

  // ── Volume ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    engine.current.volume(volume)
  }, [volume])

  // ── Media session handlers ─────────────────────────────────────────────────
  useEffect(() => {
    setMediaSessionHandlers({
      onPlay: () => usePlayerStore.getState().setIsPlaying(true),
      onPause: () => usePlayerStore.getState().setIsPlaying(false),
      onNextTrack: () => usePlayerStore.getState().playNext(),
      onPreviousTrack: () => usePlayerStore.getState().playPrev(),
      onSeekTo: (time) => {
        if (currentTrack) {
          usePlayerStore.getState().setProgress(time)
          engine.current.seek(time)
        }
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
  }, [currentTrack])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const eng = engine.current
    return () => { eng.destroy() }
  }, [])

  void progress

  return null
}

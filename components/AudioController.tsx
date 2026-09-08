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
import { useSpotify } from '@/components/SpotifyProvider'

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

  const spotify = useSpotify()
  const engine = useRef(getAudioEngine())
  const lastTrackId = useRef<string | null>(null)
  const isSpotifyTrack = (id: string) => id.startsWith('spotify-')

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  // ── Load / switch track ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return
    if (currentTrack.id === lastTrackId.current) return
    lastTrackId.current = currentTrack.id

    updateMediaSession(currentTrack)

    if (isSpotifyTrack(currentTrack.id)) {
      // Stop Howler, hand off to Spotify SDK
      engine.current.stop()
      if (isPlaying && spotify.isReady) {
        spotify.playTrack(currentTrack.streamUrl)
      }
    } else {
      // Stop any Spotify playback, use Howler
      if (spotify.isLoggedIn) spotify.pause()

      engine.current.setCallbacks({
        onLoad: (dur) => setDuration(dur),
        onEnd: () => playNext(),
        onError: () => setTimeout(() => playNext(), 1500),
        onProgress: (pos, dur) => {
          setProgress(pos)
          updatePositionState(dur, pos)
        },
      })
      engine.current.load(currentTrack.streamUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack])

  // ── Play / pause ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return

    if (isSpotifyTrack(currentTrack.id)) {
      if (isPlaying) {
        if (spotify.isReady) spotify.resume()
        setMediaSessionPlaybackState('playing')
      } else {
        spotify.pause()
        setMediaSessionPlaybackState('paused')
      }
    } else {
      if (isPlaying) {
        engine.current.play()
        setMediaSessionPlaybackState('playing')
      } else {
        engine.current.pause()
        setMediaSessionPlaybackState('paused')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTrack])

  // ── Seek (non-Spotify only) ────────────────────────────────────────────────
  const storeProgress = usePlayerStore((s) => s.progress)
  const enginePos = engine.current.position()

  useEffect(() => {
    if (currentTrack && !isSpotifyTrack(currentTrack.id)) {
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
        if (currentTrack && !isSpotifyTrack(currentTrack.id)) {
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

  // suppress unused
  void setIsPlaying

  return null
}

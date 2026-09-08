import { create } from 'zustand'
import type { Track } from '@/lib/api'

export type RepeatMode = 'none' | 'one' | 'all'
export type AudioQuality = 'Low' | 'Medium' | 'High' | 'Hi-Res'

interface PlayerState {
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  isBuffering: boolean
  audioQuality: AudioQuality
  volume: number
  progress: number
  duration: number
  buffered: number
  shuffle: boolean
  repeatMode: RepeatMode
  isFullPlayerOpen: boolean
  shuffledOrder: number[]
  shuffleIndex: number
}

interface PlayerActions {
  setQueue: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  playTrack: (index: number) => void
  playNext: () => void
  playPrev: () => void
  togglePlay: () => void
  setVolume: (v: number) => void
  setProgress: (p: number) => void
  setDuration: (d: number) => void
  setBuffered: (b: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  openFullPlayer: () => void
  closeFullPlayer: () => void
  setIsPlaying: (playing: boolean) => void
  setIsBuffering: (buffering: boolean) => void
  setAudioQuality: (quality: AudioQuality) => void
}

function buildShuffleOrder(length: number, currentIndex: number): number[] {
  const order = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIndex)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return [currentIndex, ...order]
}

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  isBuffering: false,
  audioQuality: 'Hi-Res',
  volume: 0.8,
  progress: 0,
  duration: 0,
  buffered: 0,
  shuffle: false,
  repeatMode: 'none',
  isFullPlayerOpen: false,
  shuffledOrder: [],
  shuffleIndex: 0,

  setQueue: (tracks, startIndex = 0) => {
    const order = buildShuffleOrder(tracks.length, startIndex)
    set({
      queue: tracks,
      currentIndex: startIndex,
      shuffledOrder: order,
      shuffleIndex: 0,
      progress: 0,
      duration: 0,
      buffered: 0,
    })
  },

  addToQueue: (track) => {
    set((s) => ({ queue: [...s.queue, track] }))
  },

  playTrack: (index) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return
    const order = buildShuffleOrder(queue.length, index)
    set({
      currentIndex: index,
      isPlaying: true,
      progress: 0,
      duration: 0,
      buffered: 0,
      shuffledOrder: order,
      shuffleIndex: 0,
    })
  },

  playNext: () => {
    const { queue, currentIndex, shuffle, shuffledOrder, shuffleIndex, repeatMode } = get()
    if (queue.length === 0) return

    if (repeatMode === 'one') {
      set({ progress: 0, isPlaying: true })
      return
    }

    if (shuffle) {
      const nextShuffleIdx = shuffleIndex + 1
      if (nextShuffleIdx >= shuffledOrder.length) {
        if (repeatMode === 'all') {
          const newOrder = buildShuffleOrder(queue.length, shuffledOrder[0])
          set({ shuffledOrder: newOrder, shuffleIndex: 0, currentIndex: newOrder[0], isPlaying: true, progress: 0 })
        } else {
          set({ isPlaying: false })
        }
      } else {
        set({ shuffleIndex: nextShuffleIdx, currentIndex: shuffledOrder[nextShuffleIdx], isPlaying: true, progress: 0 })
      }
      return
    }

    const nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        set({ currentIndex: 0, isPlaying: true, progress: 0 })
      } else {
        set({ isPlaying: false })
      }
    } else {
      set({ currentIndex: nextIndex, isPlaying: true, progress: 0 })
    }
  },

  playPrev: () => {
    const { queue, currentIndex, progress, shuffle, shuffledOrder, shuffleIndex } = get()
    if (queue.length === 0) return

    if (progress > 3) {
      set({ progress: 0, isPlaying: true })
      return
    }

    if (shuffle) {
      const prevShuffleIdx = Math.max(0, shuffleIndex - 1)
      set({ shuffleIndex: prevShuffleIdx, currentIndex: shuffledOrder[prevShuffleIdx], isPlaying: true, progress: 0 })
      return
    }

    const prevIndex = Math.max(0, currentIndex - 1)
    set({ currentIndex: prevIndex, isPlaying: true, progress: 0 })
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: d }),
  setBuffered: (b) => set({ buffered: b }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  setAudioQuality: (quality) => set({ audioQuality: quality }),

  toggleShuffle: () => {
    const { queue, currentIndex } = get()
    set((s) => {
      const newShuffle = !s.shuffle
      const newOrder = buildShuffleOrder(queue.length, currentIndex)
      return { shuffle: newShuffle, shuffledOrder: newOrder, shuffleIndex: 0 }
    })
  },

  cycleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ['none', 'one', 'all']
      const nextIdx = (modes.indexOf(s.repeatMode) + 1) % modes.length
      return { repeatMode: modes[nextIdx] }
    }),

  openFullPlayer: () => set({ isFullPlayerOpen: true }),
  closeFullPlayer: () => set({ isFullPlayerOpen: false }),
}))

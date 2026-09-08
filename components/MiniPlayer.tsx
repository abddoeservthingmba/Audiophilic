'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, ChevronUp,
} from 'lucide-react'
import { usePlayerStore } from '@/store/usePlayerStore'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function MiniPlayer() {
  const {
    queue,
    currentIndex,
    isPlaying,
    isBuffering,
    audioQuality,
    setAudioQuality,
    progress,
    duration,
    buffered,
    togglePlay,
    playNext,
    playPrev,
    openFullPlayer,
  } = usePlayerStore()

  const track = currentIndex >= 0 ? queue[currentIndex] : null
  const totalDuration = duration > 0 ? duration : (track?.duration ?? 0)
  const progressPct = totalDuration > 0 ? (progress / totalDuration) * 100 : 0
  const bufferedPct = totalDuration > 0 ? (buffered / totalDuration) * 100 : 0

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          key="mini-player"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 select-none"
        >
          {/* Progress bar at top */}
          <div className="relative h-1 bg-white/10 overflow-hidden">
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 bg-red-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Player body */}
          <div className="flex items-center gap-3 px-4 py-3 backdrop-blur-xl bg-black/80 border-t border-white/10">
            {/* Artwork — clicking opens full player */}
            <button
              onClick={openFullPlayer}
              className="flex-shrink-0 rounded-lg overflow-hidden w-11 h-11 focus:outline-none focus:ring-2 focus:ring-red-500 relative"
              aria-label="Open full player"
            >
              <Image
                src={track.artwork['150x150']}
                alt={track.title}
                width={44}
                height={44}
                className="object-cover w-11 h-11"
                unoptimized
              />
            </button>

            {/* Track info */}
            <button
              onClick={openFullPlayer}
              className="flex-1 min-w-0 text-left focus:outline-none"
              aria-label="Open full player"
            >
              <p className="text-sm font-semibold text-white truncate leading-tight">{track.title}</p>
              <p className="text-xs text-white/50 truncate leading-tight mt-0.5">{track.artist}</p>
            </button>

            {/* Quality Badge */}
            <button
              onClick={() => {
                const qualities: ('Low' | 'Medium' | 'High' | 'Hi-Res')[] = ['Low', 'Medium', 'High', 'Hi-Res']
                const nextIdx = (qualities.indexOf(audioQuality) + 1) % qualities.length
                setAudioQuality(qualities[nextIdx])
              }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors uppercase tracking-wider hidden sm:block"
            >
              {audioQuality}
            </button>

            {/* Elapsed / Total Time */}
            <span className="text-xs text-white/50 tabular-nums hidden sm:block font-medium">
              {formatTime(progress)} / {formatTime(totalDuration)}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={playPrev}
                className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
                aria-label="Previous track"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                className="p-2.5 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors shadow-lg shadow-red-600/30 flex items-center justify-center w-10 h-10 overflow-hidden"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/icon.png" alt="Loading" className="w-5 h-5 object-contain animate-spin" />
                ) : isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={playNext}
                className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
                aria-label="Next track"
              >
                <SkipForward size={18} />
              </button>
            </div>

            {/* Expand button */}
            <button
              onClick={openFullPlayer}
              className="p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
              aria-label="Expand player"
            >
              <ChevronUp size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

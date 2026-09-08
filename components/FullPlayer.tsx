'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Repeat1,
  Volume2, VolumeX,
} from 'lucide-react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { getAudioEngine } from '@/lib/audio'
import type { RepeatMode } from '@/store/usePlayerStore'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  if (mode === 'one') return <Repeat1 size={20} />
  return <Repeat size={20} />
}

export default function FullPlayer() {
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
    volume,
    shuffle,
    repeatMode,
    isFullPlayerOpen,
    togglePlay,
    playNext,
    playPrev,
    toggleShuffle,
    cycleRepeat,
    setVolume,
    setProgress,
    closeFullPlayer,
  } = usePlayerStore()

  const track = currentIndex >= 0 ? queue[currentIndex] : null
  const totalDuration = duration > 0 ? duration : (track?.duration ?? 0)

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const newPos = parseFloat(e.target.value)
    setProgress(newPos)
    getAudioEngine().seek(newPos)
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    setVolume(parseFloat(e.target.value))
  }

  const progressPct = totalDuration > 0 ? (progress / totalDuration) * 100 : 0
  const qualities: ('Low' | 'Medium' | 'High' | 'Hi-Res')[] = ['Low', 'Medium', 'High', 'Hi-Res']

  return (
    <AnimatePresence>
      {isFullPlayerOpen && track && (
        <motion.div
          key="full-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          className="fixed inset-0 z-[100] flex flex-col items-center overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,10,15,0.97), rgba(5,5,8,0.99))',
          }}
        >
          {/* Backdrop blur layer */}
          <div className="absolute inset-0 backdrop-blur-3xl -z-10" aria-hidden="true" />

          {/* Header */}
          <div className="w-full flex items-center justify-between px-5 pt-safe pt-10 pb-4 max-w-md">
            <button
              onClick={closeFullPlayer}
              className="p-2 text-white/60 hover:text-white transition-colors"
              aria-label="Close player"
            >
              <ChevronDown size={28} />
            </button>
            <span className="text-xs font-extrabold tracking-widest text-red-500 uppercase">Now Playing</span>
            <div className="w-10" aria-hidden="true" />
          </div>

          {/* Artwork */}
          <motion.div
            className="relative rounded-2xl overflow-hidden shadow-2xl mt-4 border border-white/10"
            animate={{ scale: isPlaying ? 1 : 0.92 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <Image
              src={track.artwork['480x480']}
              alt={track.title}
              width={320}
              height={320}
              className="w-64 h-64 sm:w-80 sm:h-80 object-cover"
              priority
              unoptimized
            />
          </motion.div>

          {/* Track info */}
          <div className="mt-6 px-8 w-full max-w-md text-center">
            <h1 className="text-2xl font-bold text-white truncate">{track.title}</h1>
            <p className="text-base text-white/50 mt-1 truncate">{track.artist}</p>

            {/* Audio Quality Selector Pills */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {qualities.map((q) => (
                <button
                  key={q}
                  onClick={() => setAudioQuality(q)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all ${
                    audioQuality === q
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30 border border-red-500'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Progress scrubber */}
          <div className="mt-6 px-8 w-full max-w-md">
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 bg-white/20 rounded-full transition-all duration-300"
                style={{ width: `${totalDuration > 0 ? (buffered / totalDuration) * 100 : 0}%` }}
              />
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              step={0.1}
              value={progress}
              onChange={handleScrub}
              className="w-full h-2 opacity-0 absolute cursor-pointer"
              style={{ marginTop: '-0.5rem' }}
              aria-label="Seek"
            />
            <div className="flex justify-between text-xs text-white/50 mt-1.5 tabular-nums font-medium">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 px-8 w-full max-w-md flex items-center justify-between">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-colors ${shuffle ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
              aria-label="Toggle shuffle"
            >
              <Shuffle size={20} />
            </button>

            <button
              onClick={playPrev}
              className="p-3 text-white/80 hover:text-white transition-colors"
              aria-label="Previous track"
            >
              <SkipBack size={28} fill="currentColor" />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors shadow-lg shadow-red-600/40 overflow-hidden p-2"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/icon.png" alt="Loading" className="w-8 h-8 object-contain animate-spin" />
              ) : isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-3 text-white/80 hover:text-white transition-colors"
              aria-label="Next track"
            >
              <SkipForward size={28} fill="currentColor" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2 rounded-full transition-colors ${repeatMode !== 'none' ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
              aria-label="Toggle repeat"
            >
              <RepeatIcon mode={repeatMode} />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-6 px-8 w-full max-w-md flex items-center gap-3">
            <VolumeX size={16} className="text-white/40 flex-shrink-0" />
            <div className="relative flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-white/70 rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolume}
              className="absolute opacity-0 h-2 cursor-pointer"
              style={{ width: 'calc(100% - 5rem)' }}
              aria-label="Volume"
            />
            <Volume2 size={16} className="text-white/40 flex-shrink-0" />
          </div>

          {/* Queue preview */}
          {queue.length > 1 && (
            <div className="mt-6 px-8 w-full max-w-md overflow-y-auto flex-1 pb-8">
              <p className="text-xs font-semibold tracking-widest text-white/30 uppercase mb-3">Up Next</p>
              {queue.slice(currentIndex + 1, currentIndex + 6).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => usePlayerStore.getState().playTrack(currentIndex + 1 + i)}
                  className="flex items-center gap-3 w-full py-2 hover:bg-white/5 rounded-lg px-2 transition-colors text-left"
                >
                  <Image
                    src={t.artwork['150x150']}
                    alt={t.title}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                    unoptimized
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.title}</p>
                    <p className="text-xs text-white/40 truncate">{t.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

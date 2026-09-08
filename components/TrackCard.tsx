'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play, Music2 } from 'lucide-react'
import { usePlayerStore } from '@/store/usePlayerStore'
import type { Track } from '@/lib/api'

interface TrackCardProps {
  track: Track
  index: number
  allTracks: Track[]
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n > 0 ? n.toString() : ''
}

function formatDuration(s: number): string {
  if (!isFinite(s) || s <= 0) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function TrackCard({ track, index, allTracks }: TrackCardProps) {
  const { setQueue, playTrack, currentIndex, queue, isPlaying, isBuffering } = usePlayerStore()
  const [imageError, setImageError] = useState(false)
  const isCurrentTrack = queue[currentIndex]?.id === track.id

  function handlePlay() {
    setQueue(allTracks, index)
    playTrack(index)
  }

  return (
    <button
      onClick={handlePlay}
      className={`group relative flex flex-col rounded-xl overflow-hidden text-left w-full
        transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/60
        focus:outline-none focus:ring-2 focus:ring-red-500
        ${isCurrentTrack ? 'ring-2 ring-red-500 shadow-xl shadow-red-500/20' : ''}`}
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      {/* Artwork */}
      <div className="relative aspect-square w-full bg-gradient-to-br from-zinc-900 via-neutral-900 to-red-950/40 flex items-center justify-center">
        {!imageError ? (
          <Image
            src={track.artwork['480x480']}
            alt={track.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={() => setImageError(true)}
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <Music2 size={32} className="text-red-500/70 mb-1" />
            <span className="text-[10px] text-white/40 line-clamp-1">{track.title}</span>
          </div>
        )}

        {/* Play / Buffering Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40
          transition-opacity duration-200
          ${isCurrentTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform overflow-hidden p-1">
            {isCurrentTrack && isBuffering ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/icon.png" alt="Loading" className="w-full h-full object-contain animate-spin" />
            ) : (
              <Play size={20} fill="white" className="text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Now playing animated bars */}
        {isCurrentTrack && isPlaying && !isBuffering && (
          <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-red-400 rounded-full"
                style={{
                  height: `${40 + i * 20}%`,
                  animation: 'pulse 0.8s ease-in-out infinite alternate',
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 bg-white/5 flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate leading-tight group-hover:text-red-300 transition-colors">{track.title}</p>
        <p className="text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
        <div className="flex items-center justify-between mt-1.5 text-xs text-white/25">
          {track.playCount > 0 ? <span>{formatCount(track.playCount)} views</span> : <span />}
          {track.duration > 0 && <span>{formatDuration(track.duration)}</span>}
        </div>
      </div>
    </button>
  )
}

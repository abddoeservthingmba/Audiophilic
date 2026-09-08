'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'
import { usePlayerStore } from '@/store/usePlayerStore'
import type { Track } from '@/lib/api'

interface TrackCardProps {
  track: Track
  index: number
  allTracks: Track[]
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function formatDuration(s: number): string {
  if (!isFinite(s) || s <= 0) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function TrackCard({ track, index, allTracks }: TrackCardProps) {
  const { setQueue, playTrack, currentIndex, queue, isPlaying } = usePlayerStore()

  const isCurrentTrack = queue[currentIndex]?.id === track.id

  function handlePlay() {
    setQueue(allTracks, index)
    playTrack(index)
  }

  return (
    <button
      onClick={handlePlay}
      className={`group relative flex flex-col rounded-xl overflow-hidden text-left
        transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/50
        focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${isCurrentTrack ? 'ring-2 ring-indigo-500' : ''}`}
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      {/* Artwork */}
      <div className="relative aspect-square w-full bg-white/5">
        <Image
          src={track.artwork['480x480']}
          alt={track.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized
        />
        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40
          transition-opacity duration-200
          ${isCurrentTrack && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play size={20} fill="black" className="text-black ml-0.5" />
          </div>
        </div>
        {/* Now playing indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-indigo-400 rounded-full animate-pulse"
                style={{
                  height: `${40 + i * 20}%`,
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '800ms',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 bg-white/5 flex-1">
        <p className="text-sm font-semibold text-white truncate leading-tight">{track.title}</p>
        <p className="text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
        <div className="flex items-center justify-between mt-1.5 text-xs text-white/30">
          {track.playCount > 0 && <span>{formatCount(track.playCount)} plays</span>}
          {track.duration > 0 && <span>{formatDuration(track.duration)}</span>}
        </div>
      </div>
    </button>
  )
}

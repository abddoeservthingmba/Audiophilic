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

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  itunes:  { label: '🍎', color: 'bg-pink-500/80' },
  audius:  { label: '🎵', color: 'bg-purple-500/80' },
  jamendo: { label: '🎸', color: 'bg-green-500/80' },
  fallback:{ label: '♪',  color: 'bg-zinc-500/80' },
}

function formatCount(n: number): string {
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
  const { setQueue, playTrack, currentIndex, queue, isPlaying } = usePlayerStore()
  const isCurrentTrack = queue[currentIndex]?.id === track.id
  const badge = SOURCE_BADGE[track.source] ?? SOURCE_BADGE.fallback

  function handlePlay() {
    setQueue(allTracks, index)
    playTrack(index)
  }

  return (
    <button
      onClick={handlePlay}
      className={`group relative flex flex-col rounded-xl overflow-hidden text-left w-full
        transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/60
        focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${isCurrentTrack ? 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/20' : ''}`}
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      {/* Artwork */}
      <div className="relative aspect-square w-full bg-white/5">
        <Image
          src={track.artwork['480x480']}
          alt={track.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          unoptimized
        />

        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40
          transition-opacity duration-200
          ${isCurrentTrack && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play size={20} fill="black" className="text-black ml-0.5" />
          </div>
        </div>

        {/* Source badge */}
        <div className={`absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded-md font-bold backdrop-blur-sm ${badge.color}`}>
          {badge.label}
        </div>

        {/* Preview pill */}
        {track.isPreview && (
          <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/70 text-white/70 backdrop-blur-sm">
            Preview
          </div>
        )}

        {/* Now playing bars */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-indigo-400 rounded-full"
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
        <p className="text-sm font-semibold text-white truncate leading-tight">{track.title}</p>
        <p className="text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
        {track.album && (
          <p className="text-xs text-white/25 truncate mt-0.5">{track.album}</p>
        )}
        <div className="flex items-center justify-between mt-1.5 text-xs text-white/25">
          {track.playCount > 0 && <span>{formatCount(track.playCount)}</span>}
          {track.duration > 0 && <span>{formatDuration(track.duration)}</span>}
        </div>
      </div>
    </button>
  )
}

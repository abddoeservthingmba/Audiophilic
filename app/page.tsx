'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Music2 } from 'lucide-react'
import { getTrendingTracks, searchTracks, FALLBACK_TRACKS } from '@/lib/api'
import type { Track } from '@/lib/api'
import { usePlayerStore } from '@/store/usePlayerStore'
import AmbientBackdrop from '@/components/AmbientBackdrop'
import TrackCard from '@/components/TrackCard'

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-white/10" />
      <div className="px-3 py-2.5 bg-white/5 space-y-2">
        <div className="h-3 bg-white/10 rounded w-4/5" />
        <div className="h-2.5 bg-white/10 rounded w-3/5" />
      </div>
    </div>
  )
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)

  const { queue, currentIndex, setQueue, playTrack } = usePlayerStore()
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  const loadTrending = useCallback(async () => {
    setLoading(true)
    setSearchMode(false)
    try {
      const t = await getTrendingTracks(24)
      setTracks(t.length > 0 ? t : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrending()
  }, [loadTrending])

  // Auto-play first track when tracks load and nothing is playing
  useEffect(() => {
    if (tracks.length > 0 && currentIndex === -1) {
      setQueue(tracks, 0)
      // Delay play to let AudioController mount
      setTimeout(() => playTrack(0), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) {
      loadTrending()
      return
    }
    setLoading(true)
    setSearchMode(true)
    try {
      const results = await searchTracks(query, 24)
      setTracks(results.length > 0 ? results : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }

  function handleClearSearch() {
    setQuery('')
    loadTrending()
  }

  return (
    <>
      <AmbientBackdrop artworkUrl={currentTrack?.artwork['480x480'] ?? ''} />

      <main className="min-h-screen pb-28">
        {/* Header */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-black/50 border-b border-white/5 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Music2 size={22} className="text-indigo-400" />
              <span className="text-lg font-bold text-white tracking-tight">Audiophilic</span>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search tracks, artists…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white/8 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-transparent transition-all"
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Section title */}
        <div className="max-w-6xl mx-auto px-4 mt-8 mb-4">
          <h2 className="text-xl font-bold text-white">
            {searchMode ? `Results for "${query}"` : '🔥 Trending Now'}
          </h2>
          {searchMode && (
            <button onClick={handleClearSearch} className="text-sm text-indigo-400 hover:text-indigo-300 mt-1 transition-colors">
              ← Back to trending
            </button>
          )}
        </div>

        {/* Track grid */}
        <div className="max-w-6xl mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-24 text-white/40">
              <Music2 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">No tracks found</p>
              <button onClick={handleClearSearch} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300">
                Browse trending
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tracks.map((track, i) => (
                <TrackCard key={track.id} track={track} index={i} allTracks={tracks} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

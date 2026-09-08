'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Music2, X } from 'lucide-react'
import { getTrendingTracks, searchTracks, FALLBACK_TRACKS, GENRES } from '@/lib/api'
import type { Track, Genre } from '@/lib/api'
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
        <div className="h-2 bg-white/5 rounded w-2/5" />
      </div>
    </div>
  )
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [activeGenre, setActiveGenre] = useState<Genre>('All')
  const inputRef = useRef<HTMLInputElement>(null)

  const { queue, currentIndex, setQueue, playTrack } = usePlayerStore()
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  const loadTrending = useCallback(async (genre: Genre) => {
    setLoading(true)
    setSearchMode(false)
    try {
      const t = await getTrendingTracks(genre, 60)
      setTracks(t.length > 0 ? t : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrending(activeGenre)
  }, [loadTrending, activeGenre])

  // Auto-play first track on initial load
  const hasAutoPlayed = useRef(false)
  useEffect(() => {
    if (tracks.length > 0 && currentIndex === -1 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true
      setQueue(tracks, 0)
      setTimeout(() => playTrack(0), 400)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) {
      loadTrending(activeGenre)
      return
    }
    setLoading(true)
    setSearchMode(true)
    try {
      const results = await searchTracks(query, 60)
      setTracks(results.length > 0 ? results : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }

  function handleClearSearch() {
    setQuery('')
    setSearchMode(false)
    loadTrending(activeGenre)
    inputRef.current?.focus()
  }

  function handleGenre(genre: Genre) {
    setActiveGenre(genre)
    setSearchMode(false)
    setQuery('')
  }

  // Stats
  const itunesCount = tracks.filter(t => t.source === 'itunes').length
  const audiusCount = tracks.filter(t => t.source === 'audius').length
  const jamendoCount = tracks.filter(t => t.source === 'jamendo').length

  return (
    <>
      <AmbientBackdrop artworkUrl={currentTrack?.artwork['480x480'] ?? ''} />

      <main className="min-h-screen pb-28">
        {/* Sticky header */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-white/8">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Music2 size={16} className="text-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight hidden sm:block">Audiophilic</span>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search songs, artists, albums…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-full pl-9 pr-9 py-2 text-sm text-white
                    placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/70
                    focus:border-transparent transition-all focus:bg-white/15"
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    aria-label="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </form>

            {/* Source count badges */}
            {!loading && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs flex-shrink-0">
                {itunesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-medium">
                    🍎 {itunesCount}
                  </span>
                )}
                {audiusCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                    🎵 {audiusCount}
                  </span>
                )}
                {jamendoCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">
                    🎸 {jamendoCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Genre tabs */}
          {!searchMode && (
            <div className="max-w-7xl mx-auto px-4 pb-2 overflow-x-auto no-scrollbar flex gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => handleGenre(g)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                    ${activeGenre === g
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section title */}
        <div className="max-w-7xl mx-auto px-4 mt-6 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {searchMode
                ? `Results for "${query}"`
                : activeGenre === 'All'
                  ? '🔥 Trending Across All Sources'
                  : `🎵 ${activeGenre} Charts`}
            </h2>
            {!searchMode && !loading && (
              <p className="text-xs text-white/30 mt-0.5">
                iTunes Charts · Audius · Jamendo — {tracks.length} tracks
              </p>
            )}
          </div>
          {searchMode && (
            <button
              onClick={handleClearSearch}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-24 text-white/40">
              <Music2 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No tracks found</p>
              <p className="text-sm mt-1">Try a different search or genre</p>
              <button
                onClick={handleClearSearch}
                className="mt-4 px-5 py-2 rounded-full bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors"
              >
                Browse trending
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {tracks.map((track, i) => (
                <TrackCard key={track.id} track={track} index={i} allTracks={tracks} />
              ))}
            </div>
          )}
        </div>

        {/* Preview notice */}
        {!loading && itunesCount > 0 && (
          <p className="text-center text-xs text-white/20 mt-8 px-4">
            🍎 Apple Music previews are 30 seconds · 🎵 Audius & 🎸 Jamendo tracks are full length
          </p>
        )}
      </main>
    </>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Music2, X } from 'lucide-react'
import { getTrendingTracks, searchTracks, FALLBACK_TRACKS, GENRES } from '@/lib/api'
import { searchSpotify, getSpotifyTrending, getSavedTracks } from '@/lib/spotify'
import type { Track, Genre } from '@/lib/api'
import { usePlayerStore } from '@/store/usePlayerStore'
import { useSpotify } from '@/components/SpotifyProvider'
import AmbientBackdrop from '@/components/AmbientBackdrop'
import TrackCard from '@/components/TrackCard'

type Tab = 'trending' | 'spotify-featured' | 'spotify-library'

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
  const [activeTab, setActiveTab] = useState<Tab>('trending')
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoPlayed = useRef(false)

  const { queue, currentIndex, setQueue, playTrack } = usePlayerStore()
  const spotify = useSpotify()
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  // ── Load trending (multi-source or Spotify) ────────────────────────────────
  const loadTrending = useCallback(async (genre: Genre, tab: Tab) => {
    setLoading(true)
    setSearchMode(false)
    try {
      let t: Track[] = []
      if (tab === 'spotify-featured' && spotify.isLoggedIn && spotify.accessToken) {
        t = await getSpotifyTrending(spotify.accessToken, 50)
      } else if (tab === 'spotify-library' && spotify.isLoggedIn && spotify.accessToken) {
        t = await getSavedTracks(spotify.accessToken, 50)
      } else {
        t = await getTrendingTracks(genre, 60)
      }
      setTracks(t.length > 0 ? t : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }, [spotify.isLoggedIn, spotify.accessToken])

  useEffect(() => {
    loadTrending(activeGenre, activeTab)
  }, [loadTrending, activeGenre, activeTab])

  // Auto-play first track on initial load
  useEffect(() => {
    if (tracks.length > 0 && currentIndex === -1 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true
      setQueue(tracks, 0)
      setTimeout(() => playTrack(0), 400)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks])

  // ── Search ─────────────────────────────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) { loadTrending(activeGenre, activeTab); return }
    setLoading(true)
    setSearchMode(true)
    try {
      const [general, sp] = await Promise.allSettled([
        searchTracks(query, 40),
        spotify.isLoggedIn && spotify.accessToken
          ? searchSpotify(query, spotify.accessToken, 20)
          : Promise.resolve([]),
      ])
      const results = [
        ...(sp.status === 'fulfilled' ? sp.value : []),
        ...(general.status === 'fulfilled' ? general.value : []),
      ]
      const seen = new Set<string>()
      const deduped = results.filter(t => {
        const k = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`
        if (seen.has(k)) return false
        seen.add(k); return true
      })
      setTracks(deduped.length > 0 ? deduped : FALLBACK_TRACKS)
    } catch {
      setTracks(FALLBACK_TRACKS)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setQuery(''); setSearchMode(false)
    loadTrending(activeGenre, activeTab)
    inputRef.current?.focus()
  }

  function handleGenre(g: Genre) {
    setActiveGenre(g); setSearchMode(false); setQuery('')
    if (activeTab !== 'trending') setActiveTab('trending')
  }

  function handleTab(tab: Tab) {
    setActiveTab(tab); setSearchMode(false); setQuery('')
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const spotifyCount = tracks.filter(t => t.source === 'spotify').length
  const itunesCount  = tracks.filter(t => t.source === 'itunes').length
  const audiusCount  = tracks.filter(t => t.source === 'audius').length
  const jamendoCount = tracks.filter(t => t.source === 'jamendo').length

  return (
    <>
      <AmbientBackdrop artworkUrl={currentTrack?.artwork['480x480'] ?? ''} />

      <main className="min-h-screen pb-28">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-white/8">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Music2 size={16} className="text-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight hidden sm:block">Audiophilic</span>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search songs, artists, albums…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-full pl-9 pr-9 py-2 text-sm text-white
                    placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/70
                    focus:border-transparent transition-all focus:bg-white/15"
                />
                {query && (
                  <button type="button" onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            </form>

            {/* Source badges */}
            {!loading && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs flex-shrink-0">
                {spotifyCount > 0 && <span className="px-2 py-0.5 rounded-full bg-[#1db954]/20 text-[#1db954] font-medium">💚 {spotifyCount}</span>}
                {itunesCount > 0  && <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-medium">🍎 {itunesCount}</span>}
                {audiusCount > 0  && <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">🎵 {audiusCount}</span>}
                {jamendoCount > 0 && <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">🎸 {jamendoCount}</span>}
              </div>
            )}

            {/* Spotify login / logout */}
            {!spotify.isLoggedIn ? (
              <button
                onClick={spotify.login}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1db954] text-black text-xs font-bold hover:bg-[#1ed760] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Connect Spotify
              </button>
            ) : (
              <button
                onClick={spotify.logout}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs hover:bg-white/20 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* ── Tabs (Trending / Spotify Featured / Spotify Library) ──── */}
          <div className="max-w-7xl mx-auto px-4 pt-1 pb-2 flex gap-2 border-b border-white/5 overflow-x-auto no-scrollbar">
            <button onClick={() => handleTab('trending')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeTab === 'trending' ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
              🌐 Discover
            </button>
            {spotify.isLoggedIn && (
              <>
                <button onClick={() => handleTab('spotify-featured')}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                    ${activeTab === 'spotify-featured' ? 'bg-[#1db954] text-black' : 'bg-[#1db954]/20 text-[#1db954] hover:bg-[#1db954]/40'}`}>
                  💚 Featured
                </button>
                <button onClick={() => handleTab('spotify-library')}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                    ${activeTab === 'spotify-library' ? 'bg-[#1db954] text-black' : 'bg-[#1db954]/20 text-[#1db954] hover:bg-[#1db954]/40'}`}>
                  ❤️ Your Library
                </button>
              </>
            )}
          </div>

          {/* ── Genre tabs (only on Discover tab) ──────────────────────── */}
          {activeTab === 'trending' && !searchMode && (
            <div className="max-w-7xl mx-auto px-4 pb-2 overflow-x-auto no-scrollbar flex gap-2 pt-2">
              {GENRES.map(g => (
                <button key={g} onClick={() => handleGenre(g)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                    ${activeGenre === g ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Section title ──────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 mt-6 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {searchMode ? `Results for "${query}"` :
                activeTab === 'spotify-featured' ? '💚 Spotify Featured' :
                activeTab === 'spotify-library' ? '❤️ Your Library' :
                activeGenre === 'All' ? '🔥 Trending Everywhere' : `🎵 ${activeGenre} Charts`}
            </h2>
            {!searchMode && !loading && (
              <p className="text-xs text-white/30 mt-0.5">
                {activeTab === 'trending'
                  ? `iTunes · Audius · Jamendo — ${tracks.length} tracks`
                  : `Spotify — ${tracks.length} tracks`}
              </p>
            )}
          </div>
          {searchMode && (
            <button onClick={handleClear} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* ── Track grid ─────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-24 text-white/40">
              <Music2 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No tracks found</p>
              <button onClick={handleClear} className="mt-4 px-5 py-2 rounded-full bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors">
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

        {/* Footer note */}
        {!loading && tracks.length > 0 && (
          <p className="text-center text-xs text-white/15 mt-8 px-4 pb-2">
            {activeTab === 'trending'
              ? '🍎 iTunes previews are 30s · 🎵 Audius & 🎸 Jamendo are full length'
              : '💚 Full tracks via Spotify Premium · SDK powered'}
          </p>
        )}
      </main>
    </>
  )
}

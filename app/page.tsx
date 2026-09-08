'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Music2, X, Library, Sparkles } from 'lucide-react'
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

// ── Spotify Login Splash ──────────────────────────────────────────────────────
function SpotifyLoginSplash({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-[#1db954]/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-purple-600/20 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <Music2 size={28} className="text-white" />
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">Audiophilic</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
          Your music.<br />No ads. Ever.
        </h1>
        <p className="text-white/50 text-base mb-10 leading-relaxed">
          Stream your entire Spotify library — full tracks, curated playlists, new releases — powered by your Premium account.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {['Full tracks', 'Your library', 'Featured playlists', 'Instant search', 'Ambient visuals'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-sm">
              ✓ {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full
            bg-[#1db954] text-black font-bold text-lg hover:bg-[#1ed760] active:scale-95
            transition-all shadow-2xl shadow-[#1db954]/40"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Continue with Spotify
        </button>

        <p className="mt-4 text-xs text-white/25">
          One-time login. Your credentials stay with Spotify.
        </p>

        {/* Or browse free */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <p className="text-white/30 text-sm mb-3">Or browse without Spotify</p>
          <BrowseWithoutSpotify />
        </div>
      </div>
    </div>
  )
}

// Inline mini discover section for non-Spotify browsing
function BrowseWithoutSpotify() {
  const { setQueue, playTrack } = usePlayerStore()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTrendingTracks('All', 12).then(t => { setTracks(t.length > 0 ? t : FALLBACK_TRACKS); setLoading(false) })
  }, [])

  function handlePlay(i: number) {
    setQueue(tracks, i); playTrack(i)
  }

  if (loading) return <p className="text-white/20 text-sm">Loading…</p>

  return (
    <div className="grid grid-cols-3 gap-2 text-left">
      {tracks.slice(0, 6).map((t, i) => (
        <button key={t.id} onClick={() => handlePlay(i)}
          className="rounded-lg overflow-hidden hover:scale-105 transition-transform group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.artwork['150x150']} alt={t.title} className="w-full aspect-square object-cover" />
          <div className="p-1.5 bg-white/5">
            <p className="text-xs text-white/70 truncate">{t.title}</p>
            <p className="text-xs text-white/30 truncate">{t.artist}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [activeGenre, setActiveGenre] = useState<Genre>('All')
  const [activeTab, setActiveTab] = useState<Tab>('spotify-featured')
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoPlayed = useRef(false)

  const { queue, currentIndex, setQueue, playTrack } = usePlayerStore()
  const spotify = useSpotify()
  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  const loadTracks = useCallback(async (genre: Genre, tab: Tab) => {
    if (!spotify.isLoggedIn && tab !== 'trending') return
    setLoading(true)
    setSearchMode(false)
    try {
      let t: Track[] = []
      if (tab === 'spotify-featured' && spotify.accessToken) {
        t = await getSpotifyTrending(spotify.accessToken, 60)
      } else if (tab === 'spotify-library' && spotify.accessToken) {
        t = await getSavedTracks(spotify.accessToken, 60)
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

  // Load Spotify featured automatically when logged in
  useEffect(() => {
    if (spotify.isLoggedIn && spotify.accessToken) {
      setActiveTab('spotify-featured')
      loadTracks(activeGenre, 'spotify-featured')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotify.isLoggedIn, spotify.accessToken])

  // Auto-play on first load
  useEffect(() => {
    if (tracks.length > 0 && currentIndex === -1 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true
      setQueue(tracks, 0)
      setTimeout(() => playTrack(0), 500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) { loadTracks(activeGenre, activeTab); return }
    setLoading(true)
    setSearchMode(true)
    try {
      const [general, sp] = await Promise.allSettled([
        searchTracks(query, 30),
        spotify.isLoggedIn && spotify.accessToken
          ? searchSpotify(query, spotify.accessToken, 25)
          : Promise.resolve([]),
      ])
      const all: Track[] = [
        ...(sp.status === 'fulfilled' ? sp.value : []),
        ...(general.status === 'fulfilled' ? general.value : []),
      ]
      const seen = new Set<string>()
      const deduped = all.filter(t => {
        const k = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`
        if (seen.has(k)) return false; seen.add(k); return true
      })
      setTracks(deduped.length > 0 ? deduped : FALLBACK_TRACKS)
    } catch { setTracks(FALLBACK_TRACKS) }
    finally { setLoading(false) }
  }

  function handleClear() {
    setQuery(''); setSearchMode(false)
    loadTracks(activeGenre, activeTab)
    inputRef.current?.focus()
  }

  function handleGenre(g: Genre) {
    setActiveGenre(g); setSearchMode(false); setQuery('')
    setActiveTab('trending')
    loadTracks(g, 'trending')
  }

  function handleTab(tab: Tab) {
    setActiveTab(tab); setSearchMode(false); setQuery('')
    loadTracks(activeGenre, tab)
  }

  // ── Show login splash if not connected ────────────────────────────────────
  if (!spotify.isLoggedIn) {
    return (
      <>
        <AmbientBackdrop artworkUrl={currentTrack?.artwork['480x480'] ?? ''} />
        <SpotifyLoginSplash onLogin={spotify.login} />
        {/* MiniPlayer still works for the "Browse without Spotify" mini-grid */}
      </>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const spotifyCount = tracks.filter(t => t.source === 'spotify').length
  const itunesCount  = tracks.filter(t => t.source === 'itunes').length
  const audiusCount  = tracks.filter(t => t.source === 'audius').length

  return (
    <>
      <AmbientBackdrop artworkUrl={currentTrack?.artwork['480x480'] ?? ''} />

      <main className="min-h-screen pb-28">
        {/* ── Sticky header ──────────────────────────────────────────── */}
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
                  ref={inputRef} type="text"
                  placeholder="Search Spotify, iTunes, Audius…"
                  value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-full pl-9 pr-9 py-2 text-sm
                    text-white placeholder:text-white/30 focus:outline-none focus:ring-2
                    focus:ring-[#1db954]/60 focus:border-transparent transition-all focus:bg-white/15"
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
              </div>
            )}

            {/* Disconnect */}
            <button onClick={spotify.logout}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/10 text-white/50 text-xs hover:bg-white/20 transition-colors hidden sm:block">
              Disconnect
            </button>
          </div>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <div className="max-w-7xl mx-auto px-4 pt-1 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => handleTab('spotify-featured')}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeTab === 'spotify-featured' ? 'bg-[#1db954] text-black' : 'bg-[#1db954]/15 text-[#1db954] hover:bg-[#1db954]/30'}`}>
              <Sparkles size={13} /> Featured
            </button>
            <button onClick={() => handleTab('spotify-library')}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeTab === 'spotify-library' ? 'bg-[#1db954] text-black' : 'bg-[#1db954]/15 text-[#1db954] hover:bg-[#1db954]/30'}`}>
              <Library size={13} /> Your Library
            </button>
            <div className="w-px bg-white/10 mx-1" />
            <button onClick={() => handleTab('trending')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${activeTab === 'trending' ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
              🌐 Discover
            </button>
          </div>

          {/* Genre tabs — only on Discover */}
          {activeTab === 'trending' && !searchMode && (
            <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {GENRES.map(g => (
                <button key={g} onClick={() => handleGenre(g)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                    ${activeGenre === g ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Section title ─────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 mt-6 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {searchMode ? `Results for "${query}"` :
                activeTab === 'spotify-featured' ? '💚 Spotify Featured' :
                activeTab === 'spotify-library' ? '❤️ Your Library' :
                activeGenre === 'All' ? '🔥 Trending Everywhere' : `🎵 ${activeGenre}`}
            </h2>
            {!loading && (
              <p className="text-xs text-white/30 mt-0.5">{tracks.length} tracks</p>
            )}
          </div>
          {searchMode && (
            <button onClick={handleClear} className="text-sm text-[#1db954] hover:text-[#1ed760] transition-colors flex items-center gap-1">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* ── Track grid ───────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-24 text-white/40">
              <Music2 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No tracks found</p>
              <button onClick={handleClear} className="mt-4 px-5 py-2 rounded-full bg-[#1db954] text-black text-sm font-medium hover:bg-[#1ed760] transition-colors">
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
      </main>
    </>
  )
}

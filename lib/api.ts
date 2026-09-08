export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  artwork: {
    '150x150': string
    '480x480': string
    '1000x1000': string
  }
  streamUrl: string
  duration: number
  playCount: number
  source: 'deezer' | 'itunes' | 'audius' | 'jamendo' | 'fallback'
  isPreview?: boolean
  genre?: string
}

export type Genre = 'All' | 'Pop' | 'Hip-Hop/Rap' | 'Electronic' | 'R&B/Soul' | 'Rock' | 'Country' | 'Latin' | 'Dance'

export const GENRES: Genre[] = ['All', 'Pop', 'Hip-Hop/Rap', 'Electronic', 'R&B/Soul', 'Rock', 'Country', 'Latin', 'Dance']

// ─────────────────────────────────────────────────────────────────────────────
// Deezer Charts & Search (Metadata + Piped full stream with direct fallback)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeezerTrack(t: any): Track | null {
  if (!t.title || !t.artist?.name) return null
  const cover = t.album?.cover_medium ?? t.album?.cover_big ?? `https://placehold.co/480x480/1a1a2e/ffffff?text=${encodeURIComponent((t.title ?? 'D').charAt(0))}`
  const directFallback = t.preview ? encodeURIComponent(t.preview) : ''
  return {
    id: `deezer-${t.id}`,
    title: t.title,
    artist: t.artist.name,
    album: t.album?.title,
    artwork: {
      '150x150': t.album?.cover_small ?? cover,
      '480x480': t.album?.cover_big ?? cover,
      '1000x1000': t.album?.cover_xl ?? cover,
    },
    // Fast parallel full stream lookup + safe fallback
    streamUrl: `/api/stream?q=${encodeURIComponent(`${t.title} ${t.artist.name}`)}&fallback=${directFallback}`,
    duration: t.duration ?? 210,
    playCount: t.rank ?? 0,
    source: 'deezer',
    isPreview: false,
  }
}

async function getDeezerCharts(limit = 30): Promise<Track[]> {
  try {
    const res = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map(mapDeezerTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

async function searchDeezer(query: string, limit = 25): Promise<Track[]> {
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map(mapDeezerTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// iTunes / Apple Music (Top Charts & Search + Piped full stream with fallback)
// ─────────────────────────────────────────────────────────────────────────────

const ITUNES_GENRE_IDS: Record<Genre, number | null> = {
  'All': null,
  'Pop': 14,
  'Hip-Hop/Rap': 18,
  'Electronic': 7,
  'R&B/Soul': 15,
  'Rock': 21,
  'Country': 6,
  'Latin': 12,
  'Dance': 17,
}

const ITUNES_COUNTRIES = ['us', 'gb', 'in', 'au']

function itunesArtworkUrl(raw: string, size: number): string {
  return raw.replace('100x100bb', `${size}x${size}bb`).replace('100x100', `${size}x${size}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItunesTrack(t: any): Track | null {
  if (!t.trackName || !t.artistName) return null
  const raw = t.artworkUrl100 ?? ''
  const directFallback = t.previewUrl ? encodeURIComponent(t.previewUrl) : ''
  return {
    id: `itunes-${t.trackId}`,
    title: t.trackName,
    artist: t.artistName,
    album: t.collectionName,
    artwork: {
      '150x150': itunesArtworkUrl(raw, 150),
      '480x480': itunesArtworkUrl(raw, 600),
      '1000x1000': itunesArtworkUrl(raw, 1000),
    },
    // Fast parallel full stream lookup + safe fallback
    streamUrl: `/api/stream?q=${encodeURIComponent(`${t.trackName} ${t.artistName}`)}&fallback=${directFallback}`,
    duration: Math.round((t.trackTimeMillis ?? 210000) / 1000),
    playCount: 0,
    source: 'itunes',
    isPreview: false,
    genre: t.primaryGenreName,
  }
}

async function getItunesCharts(genre: Genre = 'All', limit = 40): Promise<Track[]> {
  const genreId = ITUNES_GENRE_IDS[genre]
  const genrePath = genreId ? `/genre-id=${genreId}/` : '/'

  for (const country of ITUNES_COUNTRIES) {
    try {
      const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}${genrePath}json`
      const res = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) continue
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any[] = json?.feed?.entry ?? []
      const ids = entries.map((e: any) => e?.id?.attributes?.['im:id']).filter(Boolean).slice(0, limit)
      if (ids.length === 0) continue

      const lookupRes = await fetch(
        `https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=song`,
        { next: { revalidate: 3600 } }
      )
      if (!lookupRes.ok) continue
      const lookupJson = await lookupRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tracks = (lookupJson.results ?? []).filter((r: any) => r.kind === 'song')
      const mapped = tracks.map(mapItunesTrack).filter((t: Track | null): t is Track => t !== null)
      if (mapped.length > 0) return mapped
    } catch {
      // try next
    }
  }
  return []
}

async function searchItunes(query: string, limit = 25): Promise<Track[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=us`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? [])
      .map(mapItunesTrack)
      .filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audius (Full-length streams)
// ─────────────────────────────────────────────────────────────────────────────

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAudiusTrack(t: any): Track {
  const artwork = t.artwork ?? {}
  const placeholder = `https://placehold.co/480x480/1a1a2e/ffffff?text=${encodeURIComponent((t.title ?? 'A').charAt(0))}`
  return {
    id: `audius-${t.id}`,
    title: t.title ?? 'Unknown Title',
    artist: t.user?.name ?? 'Unknown Artist',
    artwork: {
      '150x150': artwork['150x150'] ?? placeholder,
      '480x480': artwork['480x480'] ?? placeholder,
      '1000x1000': artwork['1000x1000'] ?? placeholder,
    },
    streamUrl: `/api/stream?id=${encodeURIComponent(t.id)}`,
    duration: t.duration ?? 0,
    playCount: t.play_count ?? 0,
    source: 'audius',
    isPreview: false,
  }
}

async function getAudiusTrending(genre = 'All', limit = 25): Promise<Track[]> {
  for (const node of AUDIUS_NODES) {
    try {
      const g = genre === 'All' ? 'All' : genre
      const url = `${node}/v1/tracks/trending?limit=${limit}&genre=${encodeURIComponent(g)}&time=week&app_name=Audiophilic`
      const res = await fetch(url, { next: { revalidate: 300 }, headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = await res.json()
      if (!Array.isArray(json.data) || json.data.length === 0) continue
      return json.data.map(mapAudiusTrack)
    } catch {
      // try next
    }
  }
  return []
}

async function searchAudius(query: string, limit = 20): Promise<Track[]> {
  for (const node of AUDIUS_NODES) {
    try {
      const url = `${node}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=Audiophilic`
      const res = await fetch(url, { next: { revalidate: 120 }, headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const json = await res.json()
      if (!Array.isArray(json.data)) continue
      return json.data.map(mapAudiusTrack)
    } catch {
      // try next
    }
  }
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Jamendo (Full-length streams)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJamendoTrack(t: any): Track {
  const art = t.album_image ?? `https://placehold.co/480x480/1a1a2e/ffffff?text=${encodeURIComponent((t.name ?? 'J').charAt(0))}`
  return {
    id: `jamendo-${t.id}`,
    title: t.name ?? 'Unknown',
    artist: t.artist_name ?? 'Unknown',
    album: t.album_name,
    artwork: {
      '150x150': art,
      '480x480': art,
      '1000x1000': art,
    },
    streamUrl: t.audio ?? t.audiodownload ?? '',
    duration: t.duration ?? 0,
    playCount: t.listens ?? 0,
    source: 'jamendo',
    isPreview: false,
    genre: t.musicinfo?.tags?.genres?.[0],
  }
}

async function getJamendoTrending(limit = 20): Promise<Track[]> {
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=b6747d04&format=json&limit=${limit}&order=popularity_total&include=musicinfo&imagesize=500`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? [])
      .filter((t: any) => t.audio) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map(mapJamendoTrack)
  } catch {
    return []
  }
}

async function searchJamendo(query: string, limit = 15): Promise<Track[]> {
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=b6747d04&format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo&imagesize=500`
    const res = await fetch(url, { next: { revalidate: 120 } })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? [])
      .filter((t: any) => t.audio) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map(mapJamendoTrack)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback tracks
// ─────────────────────────────────────────────────────────────────────────────

export const FALLBACK_TRACKS: Track[] = [
  {
    id: 'fallback-1', title: 'Acoustic Breeze', artist: 'Bensound', source: 'fallback', isPreview: false, playCount: 0, duration: 222,
    artwork: { '150x150': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg', '480x480': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg', '1000x1000': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg' },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
  },
  {
    id: 'fallback-2', title: 'Creative Minds', artist: 'Bensound', source: 'fallback', isPreview: false, playCount: 0, duration: 116,
    artwork: { '150x150': 'https://www.bensound.com/bensound-img/creativeminds.jpg', '480x480': 'https://www.bensound.com/bensound-img/creativeminds.jpg', '1000x1000': 'https://www.bensound.com/bensound-img/creativeminds.jpg' },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3',
  },
  {
    id: 'fallback-3', title: 'Sunny', artist: 'Bensound', source: 'fallback', isPreview: false, playCount: 0, duration: 206,
    artwork: { '150x150': 'https://www.bensound.com/bensound-img/sunny.jpg', '480x480': 'https://www.bensound.com/bensound-img/sunny.jpg', '1000x1000': 'https://www.bensound.com/bensound-img/sunny.jpg' },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-sunny.mp3',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrendingTracks(genre: Genre = 'All', limit = 50): Promise<Track[]> {
  const [deezer, itunes, audius, jamendo] = await Promise.allSettled([
    getDeezerCharts(25),
    getItunesCharts(genre, 25),
    getAudiusTrending(genre, 20),
    genre === 'All' ? getJamendoTrending(15) : Promise.resolve([]),
  ])

  const all: Track[] = [
    ...(deezer.status === 'fulfilled' ? deezer.value : []),
    ...(itunes.status === 'fulfilled' ? itunes.value : []),
    ...(audius.status === 'fulfilled' ? audius.value : []),
    ...(jamendo.status === 'fulfilled' ? jamendo.value : []),
  ]

  if (all.length === 0) return FALLBACK_TRACKS

  const seen = new Set<string>()
  return all.filter((t) => {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchTracks(query: string, limit = 50): Promise<Track[]> {
  if (!query.trim()) return getTrendingTracks('All', limit)

  const [deezer, itunes, audius, jamendo] = await Promise.allSettled([
    searchDeezer(query, 20),
    searchItunes(query, 20),
    searchAudius(query, 15),
    searchJamendo(query, 15),
  ])

  const all: Track[] = [
    ...(deezer.status === 'fulfilled' ? deezer.value : []),
    ...(itunes.status === 'fulfilled' ? itunes.value : []),
    ...(audius.status === 'fulfilled' ? audius.value : []),
    ...(jamendo.status === 'fulfilled' ? jamendo.value : []),
  ]

  if (all.length === 0) return FALLBACK_TRACKS

  const seen = new Set<string>()
  return all.filter((t) => {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getStreamUrl(trackId: string): string {
  return `/api/stream?id=${encodeURIComponent(trackId)}`
}

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
  source: 'deezer' | 'itunes' | 'audius' | 'fallback'
  isPreview: false
  genre?: string
  ytId?: string
}

export type Genre = 'All' | 'Pop' | 'Hip-Hop/Rap' | 'Electronic' | 'R&B/Soul' | 'Rock' | 'Country' | 'Latin' | 'Dance'

export const GENRES: Genre[] = ['All', 'Pop', 'Hip-Hop/Rap', 'Electronic', 'R&B/Soul', 'Rock', 'Country', 'Latin', 'Dance']

// Safe YouTube thumbnail fallback
function getYtThumbnail(videoId: string): { '150x150': string; '480x480': string; '1000x1000': string } {
  const url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  return { '150x150': url, '480x480': url, '1000x1000': url }
}

export const FALLBACK_TRACKS: Track[] = [
  {
    id: 'yt-kJQP7kiw5Fk',
    ytId: 'kJQP7kiw5Fk',
    title: 'Despacito',
    artist: 'Luis Fonsi ft. Daddy Yankee',
    artwork: getYtThumbnail('kJQP7kiw5Fk'),
    streamUrl: '/api/stream?ytId=kJQP7kiw5Fk',
    duration: 228,
    playCount: 8000000000,
    source: 'fallback',
    isPreview: false,
  },
  {
    id: 'yt-JGwWNGJdvx8',
    ytId: 'JGwWNGJdvx8',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artwork: getYtThumbnail('JGwWNGJdvx8'),
    streamUrl: '/api/stream?ytId=JGwWNGJdvx8',
    duration: 233,
    playCount: 6000000000,
    source: 'fallback',
    isPreview: false,
  },
  {
    id: 'yt-4NRXx6U8ABQ',
    ytId: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artwork: getYtThumbnail('4NRXx6U8ABQ'),
    streamUrl: '/api/stream?ytId=4NRXx6U8ABQ',
    duration: 200,
    playCount: 4000000000,
    source: 'fallback',
    isPreview: false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CORS-Free Server API Calls (Routes via /api/search Route Handler)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrendingTracks(genre: Genre = 'All', limit = 50): Promise<Track[]> {
  try {
    const res = await fetch(`/api/search?type=trending&genre=${encodeURIComponent(genre)}&limit=${limit}`)
    if (!res.ok) return FALLBACK_TRACKS
    const json = await res.json()
    return Array.isArray(json) && json.length > 0 ? json : FALLBACK_TRACKS
  } catch {
    return FALLBACK_TRACKS
  }
}

export async function searchTracks(query: string, limit = 50): Promise<Track[]> {
  if (!query.trim()) return getTrendingTracks('All', limit)
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`)
    if (!res.ok) return FALLBACK_TRACKS
    const json = await res.json()
    return Array.isArray(json) && json.length > 0 ? json : FALLBACK_TRACKS
  } catch {
    return FALLBACK_TRACKS
  }
}

export function getStreamUrl(trackId: string): string {
  return `/api/stream?ytId=${encodeURIComponent(trackId)}`
}

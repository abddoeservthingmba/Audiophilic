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
  source: 'ytmusic'
  isPreview: false
  genre?: string
  ytId: string
}

export type Genre = 'All' | 'Pop' | 'Hip-Hop/Rap' | 'Electronic' | 'R&B/Soul' | 'Rock' | 'Country' | 'Latin' | 'Dance'

export const GENRES: Genre[] = ['All', 'Pop', 'Hip-Hop/Rap', 'Electronic', 'R&B/Soul', 'Rock', 'Country', 'Latin', 'Dance']

const PIPED_NODES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.video',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.mha.fi',
  'https://pipedapi.drgns.space',
]

const INVIDIOUS_NODES = [
  'https://yewtu.be',
  'https://inv.tux.pizza',
  'https://vid.puffyan.us',
]

function getHighResThumbnail(thumbnailUrl?: string, videoId?: string): { '150x150': string; '480x480': string; '1000x1000': string } {
  if (videoId) {
    const hq = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    const max = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    return {
      '150x150': hq,
      '480x480': max,
      '1000x1000': max,
    }
  }
  const fallback = thumbnailUrl ?? 'https://placehold.co/480x480/1a1a2e/ffffff?text=YTM'
  return {
    '150x150': fallback,
    '480x480': fallback,
    '1000x1000': fallback,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapYtTrack(item: any): Track | null {
  if (!item) return null
  const videoId = item.url ? item.url.replace('/watch?v=', '') : item.videoId
  if (!videoId) return null

  const title = item.title ?? item.name ?? 'Unknown Title'
  const artist = item.uploaderName ?? item.author ?? item.artist ?? 'YouTube Music'
  const thumbs = getHighResThumbnail(item.thumbnail ?? item.thumbnailUrl, videoId)

  return {
    id: `yt-${videoId}`,
    ytId: videoId,
    title,
    artist,
    album: item.album ?? 'YouTube Music',
    artwork: thumbs,
    streamUrl: `/api/stream?ytId=${encodeURIComponent(videoId)}`,
    duration: item.duration ?? 210,
    playCount: item.views ?? 0,
    source: 'ytmusic',
    isPreview: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube Music Search & Trending via Piped / Invidious API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchYtMusic(query: string, limit = 40): Promise<Track[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  // 1. Try Piped Nodes
  for (const node of PIPED_NODES) {
    try {
      const res = await fetch(`${node}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Audiophilic/1.0' },
        next: { revalidate: 300 },
      })
      if (!res.ok) continue
      const json = await res.json()
      const items = json.items ?? []
      if (Array.isArray(items) && items.length > 0) {
        clearTimeout(timeoutId)
        const mapped = items.map(mapYtTrack).filter((t: Track | null): t is Track => t !== null)
        if (mapped.length > 0) return mapped.slice(0, limit)
      }
    } catch {
      // try next
    }
  }

  // 2. Try Invidious Nodes
  for (const node of INVIDIOUS_NODES) {
    try {
      const res = await fetch(`${node}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Audiophilic/1.0' },
        next: { revalidate: 300 },
      })
      if (!res.ok) continue
      const json = await res.json()
      if (Array.isArray(json) && json.length > 0) {
        clearTimeout(timeoutId)
        const mapped = json.map(mapYtTrack).filter((t: Track | null): t is Track => t !== null)
        if (mapped.length > 0) return mapped.slice(0, limit)
      }
    } catch {
      // try next
    }
  }

  clearTimeout(timeoutId)
  return FALLBACK_TRACKS
}

export async function getTrendingTracks(genre: Genre = 'All', limit = 40): Promise<Track[]> {
  const query = genre === 'All' ? 'Top Music Hits 2026 Trending' : `${genre} Top Music Hits Trending`
  return fetchYtMusic(query, limit)
}

export async function searchTracks(query: string, limit = 40): Promise<Track[]> {
  if (!query.trim()) return getTrendingTracks('All', limit)
  return fetchYtMusic(query, limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback tracks (YouTube Music IDs)
// ─────────────────────────────────────────────────────────────────────────────

export const FALLBACK_TRACKS: Track[] = [
  {
    id: 'yt-kJQP7kiw5Fk',
    ytId: 'kJQP7kiw5Fk',
    title: 'Despacito',
    artist: 'Luis Fonsi ft. Daddy Yankee',
    artwork: getHighResThumbnail(undefined, 'kJQP7kiw5Fk'),
    streamUrl: '/api/stream?ytId=kJQP7kiw5Fk',
    duration: 228,
    playCount: 8000000000,
    source: 'ytmusic',
    isPreview: false,
  },
  {
    id: 'yt-JGwWNGJdvx8',
    ytId: 'JGwWNGJdvx8',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artwork: getHighResThumbnail(undefined, 'JGwWNGJdvx8'),
    streamUrl: '/api/stream?ytId=JGwWNGJdvx8',
    duration: 233,
    playCount: 6000000000,
    source: 'ytmusic',
    isPreview: false,
  },
  {
    id: 'yt-4NRXx6U8ABQ',
    ytId: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artwork: getHighResThumbnail(undefined, '4NRXx6U8ABQ'),
    streamUrl: '/api/stream?ytId=4NRXx6U8ABQ',
    duration: 200,
    playCount: 4000000000,
    source: 'ytmusic',
    isPreview: false,
  },
]

export function getStreamUrl(trackId: string): string {
  return `/api/stream?ytId=${encodeURIComponent(trackId)}`
}

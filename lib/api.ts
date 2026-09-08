export interface Track {
  id: string
  title: string
  artist: string
  artwork: {
    '150x150': string
    '480x480': string
    '1000x1000': string
  }
  streamUrl: string
  duration: number
  playCount: number
}

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

const APP_NAME = 'Audiophilic'

// Royalty-free fallback tracks from Free Music Archive / Internet Archive
export const FALLBACK_TRACKS: Track[] = [
  {
    id: 'fallback-1',
    title: 'Acoustic Breeze',
    artist: 'Bensound',
    artwork: {
      '150x150': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg',
      '480x480': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg',
      '1000x1000': 'https://www.bensound.com/bensound-img/acousticbreeze.jpg',
    },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3',
    duration: 222,
    playCount: 0,
  },
  {
    id: 'fallback-2',
    title: 'Creative Minds',
    artist: 'Bensound',
    artwork: {
      '150x150': 'https://www.bensound.com/bensound-img/creativeminds.jpg',
      '480x480': 'https://www.bensound.com/bensound-img/creativeminds.jpg',
      '1000x1000': 'https://www.bensound.com/bensound-img/creativeminds.jpg',
    },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-creativeminds.mp3',
    duration: 116,
    playCount: 0,
  },
  {
    id: 'fallback-3',
    title: 'Ukulele',
    artist: 'Bensound',
    artwork: {
      '150x150': 'https://www.bensound.com/bensound-img/ukulele.jpg',
      '480x480': 'https://www.bensound.com/bensound-img/ukulele.jpg',
      '1000x1000': 'https://www.bensound.com/bensound-img/ukulele.jpg',
    },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-ukulele.mp3',
    duration: 182,
    playCount: 0,
  },
  {
    id: 'fallback-4',
    title: 'Sunny',
    artist: 'Bensound',
    artwork: {
      '150x150': 'https://www.bensound.com/bensound-img/sunny.jpg',
      '480x480': 'https://www.bensound.com/bensound-img/sunny.jpg',
      '1000x1000': 'https://www.bensound.com/bensound-img/sunny.jpg',
    },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-sunny.mp3',
    duration: 206,
    playCount: 0,
  },
  {
    id: 'fallback-5',
    title: 'Relaxing',
    artist: 'Bensound',
    artwork: {
      '150x150': 'https://www.bensound.com/bensound-img/relaxing.jpg',
      '480x480': 'https://www.bensound.com/bensound-img/relaxing.jpg',
      '1000x1000': 'https://www.bensound.com/bensound-img/relaxing.jpg',
    },
    streamUrl: 'https://www.bensound.com/bensound-music/bensound-relaxing.mp3',
    duration: 291,
    playCount: 0,
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAudiusTrack(t: any): Track {
  const artwork = t.artwork ?? {}
  const placeholder = `https://placehold.co/480x480/1a1a2e/white?text=${encodeURIComponent(t.title?.charAt(0) ?? 'A')}`
  return {
    id: t.id,
    title: t.title ?? 'Unknown Title',
    artist: t.user?.name ?? 'Unknown Artist',
    artwork: {
      '150x150': artwork['150x150'] ?? placeholder,
      '480x480': artwork['480x480'] ?? placeholder,
      '1000x1000': artwork['1000x1000'] ?? placeholder,
    },
    streamUrl: getStreamUrl(t.id),
    duration: t.duration ?? 0,
    playCount: t.play_count ?? 0,
  }
}

async function fetchFromAudius<T>(path: string): Promise<T> {
  const errors: unknown[] = []
  for (const node of AUDIUS_NODES) {
    try {
      const url = `${node}${path}&app_name=${APP_NAME}`
      const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return json.data as T
    } catch (e) {
      errors.push(e)
    }
  }
  throw new AggregateError(errors, 'All Audius nodes failed')
}

export function getStreamUrl(trackId: string): string {
  return `/api/stream?id=${encodeURIComponent(trackId)}`
}

export async function getTrendingTracks(limit = 20): Promise<Track[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchFromAudius<any[]>(`/v1/tracks/trending?limit=${limit}&genre=All&time=week`)
    return Array.isArray(data) ? data.map(mapAudiusTrack) : FALLBACK_TRACKS
  } catch {
    return FALLBACK_TRACKS
  }
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  if (!query.trim()) return getTrendingTracks(limit)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchFromAudius<any[]>(`/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`)
    return Array.isArray(data) ? data.map(mapAudiusTrack) : FALLBACK_TRACKS
  } catch {
    return FALLBACK_TRACKS
  }
}

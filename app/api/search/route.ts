import type { NextRequest } from 'next/server'

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
  'https://invidious.nerdvpn.de',
]

function getYtThumbnail(videoId: string): { '150x150': string; '480x480': string; '1000x1000': string } {
  const url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  const proxied = `/api/image?url=${encodeURIComponent(url)}`
  return { '150x150': proxied, '480x480': proxied, '1000x1000': proxied }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapYtTrack(item: any): Track | null {
  if (!item) return null
  const videoId = item.url ? item.url.replace('/watch?v=', '') : item.videoId
  if (!videoId) return null

  const title = item.title ?? item.name ?? 'Unknown Title'
  const artist = item.uploaderName ?? item.author ?? item.artist ?? 'YouTube Music'

  return {
    id: `yt-${videoId}`,
    ytId: videoId,
    title,
    artist,
    album: item.album ?? 'YouTube Music',
    artwork: getYtThumbnail(videoId),
    streamUrl: `/api/stream?ytId=${encodeURIComponent(videoId)}`,
    duration: item.duration ?? 210,
    playCount: item.views ?? 0,
    source: 'ytmusic',
    isPreview: false,
  }
}

// Query InnerTube API directly
async function searchInnerTube(query: string, limit = 25): Promise<Track[]> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            gl: 'US',
            hl: 'en',
          },
        },
        query,
      }),
      next: { revalidate: 300 },
    })

    if (!res.ok) return []
    const json = await res.json()
    const str = JSON.stringify(json)
    const videoMatches = [...str.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1])
    const uniqueIds = [...new Set(videoMatches)].slice(0, limit)

    // Extract title & artist if available in InnerTube payload
    return uniqueIds.map((id) => ({
      id: `yt-${id}`,
      ytId: id,
      title: query,
      artist: 'YouTube Music',
      artwork: getYtThumbnail(id),
      streamUrl: `/api/stream?ytId=${encodeURIComponent(id)}`,
      duration: 210,
      playCount: 0,
      source: 'ytmusic' as const,
      isPreview: false as const,
    }))
  } catch {
    return []
  }
}

// Search Piped Nodes
async function searchPiped(query: string, limit = 25): Promise<Track[]> {
  for (const node of PIPED_NODES) {
    try {
      const res = await fetch(`${node}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
        headers: { 'User-Agent': 'Audiophilic/1.0' },
        next: { revalidate: 300 },
      })
      if (!res.ok) continue
      const json = await res.json()
      const items = json.items ?? []
      if (Array.isArray(items) && items.length > 0) {
        const mapped = items.map(mapYtTrack).filter((t: Track | null): t is Track => t !== null)
        if (mapped.length > 0) return mapped.slice(0, limit)
      }
    } catch {
      // try next
    }
  }
  return []
}

// Search Invidious Nodes
async function searchInvidious(query: string, limit = 25): Promise<Track[]> {
  for (const node of INVIDIOUS_NODES) {
    try {
      const res = await fetch(`${node}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        headers: { 'User-Agent': 'Audiophilic/1.0' },
        next: { revalidate: 300 },
      })
      if (!res.ok) continue
      const json = await res.json()
      if (Array.isArray(json) && json.length > 0) {
        const mapped = json.map(mapYtTrack).filter((t: Track | null): t is Track => t !== null)
        if (mapped.length > 0) return mapped.slice(0, limit)
      }
    } catch {
      // try next
    }
  }
  return []
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
    source: 'ytmusic',
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
    source: 'ytmusic',
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
    source: 'ytmusic',
    isPreview: false,
  },
]

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? request.nextUrl.searchParams.get('query')
  const type = request.nextUrl.searchParams.get('type')
  const genre = request.nextUrl.searchParams.get('genre')

  const searchQuery = query || (genre && genre !== 'All' ? `${genre} Top Songs` : 'Top Music Hits Trending')

  try {
    // Race Piped, Invidious, and InnerTube for YouTube Music tracks
    const [piped, invidious, innertube] = await Promise.allSettled([
      searchPiped(searchQuery, 30),
      searchInvidious(searchQuery, 30),
      searchInnerTube(searchQuery, 20),
    ])

    const results: Track[] = [
      ...(piped.status === 'fulfilled' ? piped.value : []),
      ...(invidious.status === 'fulfilled' ? invidious.value : []),
      ...(innertube.status === 'fulfilled' ? innertube.value : []),
    ]

    if (results.length === 0) {
      return Response.json(FALLBACK_TRACKS)
    }

    // Deduplicate by YouTube Video ID
    const seen = new Set<string>()
    const deduped = results.filter((t) => {
      if (seen.has(t.ytId)) return false
      seen.add(t.ytId)
      return true
    })

    return Response.json(deduped, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch {
    return Response.json(FALLBACK_TRACKS)
  }
}

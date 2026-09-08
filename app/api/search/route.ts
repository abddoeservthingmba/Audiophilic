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
  source: 'ytmusic' | 'itunes'
  isPreview: false
  genre?: string
  ytId?: string
}

function proxyImage(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return url
  return `/api/image?url=${encodeURIComponent(url)}`
}

function itunesArtworkUrl(raw: string, size: number): string {
  const url = raw.replace('100x100bb', `${size}x${size}bb`).replace('100x100', `${size}x${size}`)
  return proxyImage(url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItunesTrack(t: any): Track | null {
  if (!t.trackName || !t.artistName) return null
  const raw = t.artworkUrl100 ?? ''
  const directFallback = t.previewUrl ? encodeURIComponent(t.previewUrl) : ''
  const queryParam = encodeURIComponent(`${t.trackName} ${t.artistName}`)

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
    // Stream full audio via query with direct unique song fallback
    streamUrl: `/api/stream?q=${queryParam}&fallback=${directFallback}`,
    duration: Math.round((t.trackTimeMillis ?? 210000) / 1000),
    playCount: 0,
    source: 'itunes',
    isPreview: false,
    genre: t.primaryGenreName,
  }
}

async function searchItunes(query: string, limit = 40): Promise<Track[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=us`, {
      headers: { 'User-Agent': 'Audiophilic/1.0' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.results ?? []).map(mapItunesTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

async function getItunesCharts(limit = 40): Promise<Track[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`, {
      headers: { 'User-Agent': 'Audiophilic/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = json?.feed?.entry ?? []
    const ids = entries.map((e: any) => e?.id?.attributes?.['im:id']).filter(Boolean).slice(0, limit)
    if (ids.length === 0) return []

    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=song`,
      { next: { revalidate: 3600 } }
    )
    if (!lookupRes.ok) return []
    const lookupJson = await lookupRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks = (lookupJson.results ?? []).filter((r: any) => r.kind === 'song')
    return tracks.map(mapItunesTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

export const FALLBACK_TRACKS: Track[] = [
  {
    id: 'itunes-1217008644',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Deluxe)',
    artwork: {
      '150x150': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a7/67/7f/a7677f50-6a9c-0975-d1fb-5e28a50bc78d/825646708761.jpg/150x150bb.jpg'),
      '480x480': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a7/67/7f/a7677f50-6a9c-0975-d1fb-5e28a50bc78d/825646708761.jpg/600x600bb.jpg'),
      '1000x1000': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a7/67/7f/a7677f50-6a9c-0975-d1fb-5e28a50bc78d/825646708761.jpg/1000x1000bb.jpg'),
    },
    streamUrl: '/api/stream?q=Shape%20of%20You%20Ed%20Sheeran',
    duration: 233,
    playCount: 0,
    source: 'itunes',
    isPreview: false,
  },
  {
    id: 'itunes-1440871141',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    artwork: {
      '150x150': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/3c/6f/8e3c6f66-1c80-60f3-8b43-41c6e174092b/20UMGIM10667.rgb.jpg/150x150bb.jpg'),
      '480x480': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/3c/6f/8e3c6f66-1c80-60f3-8b43-41c6e174092b/20UMGIM10667.rgb.jpg/600x600bb.jpg'),
      '1000x1000': proxyImage('https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/3c/6f/8e3c6f66-1c80-60f3-8b43-41c6e174092b/20UMGIM10667.rgb.jpg/1000x1000bb.jpg'),
    },
    streamUrl: '/api/stream?q=Blinding%20Lights%20The%20Weeknd',
    duration: 200,
    playCount: 0,
    source: 'itunes',
    isPreview: false,
  },
]

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? request.nextUrl.searchParams.get('query')
  const type = request.nextUrl.searchParams.get('type')
  const genre = request.nextUrl.searchParams.get('genre')

  try {
    let tracks: Track[] = []

    if (type === 'trending' || !query) {
      tracks = await getItunesCharts(40)
    } else {
      tracks = await searchItunes(query, 40)
    }

    if (tracks.length === 0) {
      tracks = await getItunesCharts(30)
    }

    if (tracks.length === 0) {
      return Response.json(FALLBACK_TRACKS)
    }

    // Deduplicate by title + artist
    const seen = new Set<string>()
    const deduped = tracks.filter((t) => {
      const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
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

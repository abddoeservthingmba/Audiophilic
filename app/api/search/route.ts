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
  source: 'deezer' | 'itunes' | 'audius' | 'fallback'
  isPreview: false
  genre?: string
}

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

function proxyImage(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return url
  return `/api/image?url=${encodeURIComponent(url)}`
}

function itunesArtworkUrl(raw: string, size: number): string {
  const url = raw.replace('100x100bb', `${size}x${size}bb`).replace('100x100', `${size}x${size}`)
  return proxyImage(url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeezerTrack(t: any): Track | null {
  if (!t.title || !t.artist?.name) return null
  const rawCover = t.album?.cover_medium ?? t.album?.cover_big ?? `https://placehold.co/480x480/1a1a2e/ffffff?text=${encodeURIComponent(t.title.charAt(0))}`
  const cover = proxyImage(rawCover)

  return {
    id: `dz-${t.id}`,
    title: t.title,
    artist: t.artist.name,
    album: t.album?.title,
    artwork: {
      '150x150': t.album?.cover_small ? proxyImage(t.album.cover_small) : cover,
      '480x480': t.album?.cover_big ? proxyImage(t.album.cover_big) : cover,
      '1000x1000': t.album?.cover_xl ? proxyImage(t.album.cover_xl) : cover,
    },
    streamUrl: `/api/stream?q=${encodeURIComponent(`${t.title} ${t.artist.name}`)}`,
    duration: t.duration ?? 210,
    playCount: t.rank ?? 0,
    source: 'deezer',
    isPreview: false,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItunesTrack(t: any): Track | null {
  if (!t.trackName || !t.artistName) return null
  const raw = t.artworkUrl100 ?? ''
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
    streamUrl: `/api/stream?q=${encodeURIComponent(`${t.trackName} ${t.artistName}`)}`,
    duration: Math.round((t.trackTimeMillis ?? 210000) / 1000),
    playCount: 0,
    source: 'itunes',
    isPreview: false,
    genre: t.primaryGenreName,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAudiusTrack(t: any): Track {
  const artwork = t.artwork ?? {}
  const placeholder = `https://placehold.co/480x480/1a1a2e/ffffff?text=${encodeURIComponent((t.title ?? 'A').charAt(0))}`
  const raw150 = artwork['150x150'] ?? placeholder
  const raw480 = artwork['480x480'] ?? placeholder
  const raw1000 = artwork['1000x1000'] ?? placeholder

  return {
    id: `audius-${t.id}`,
    title: t.title ?? 'Unknown Title',
    artist: t.user?.name ?? 'Unknown Artist',
    artwork: {
      '150x150': proxyImage(raw150),
      '480x480': proxyImage(raw480),
      '1000x1000': proxyImage(raw1000),
    },
    streamUrl: `/api/stream?id=${encodeURIComponent(t.id)}`,
    duration: t.duration ?? 0,
    playCount: t.play_count ?? 0,
    source: 'audius',
    isPreview: false,
  }
}

async function searchDeezer(query: string, limit = 25): Promise<Track[]> {
  try {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { 'User-Agent': 'Audiophilic/1.0' },
      next: { revalidate: 120 },
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map(mapDeezerTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

async function searchItunes(query: string, limit = 25): Promise<Track[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=us`, {
      headers: { 'User-Agent': 'Audiophilic/1.0' },
      next: { revalidate: 120 },
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.results ?? []).map(mapItunesTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

async function searchAudius(query: string, limit = 15): Promise<Track[]> {
  for (const node of AUDIUS_NODES) {
    try {
      const res = await fetch(`${node}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=Audiophilic`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 120 },
      })
      if (!res.ok) continue
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map(mapAudiusTrack)
      }
    } catch {
      // try next
    }
  }
  return []
}

async function getDeezerCharts(limit = 30): Promise<Track[]> {
  try {
    const res = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`, {
      headers: { 'User-Agent': 'Audiophilic/1.0' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data ?? []).map(mapDeezerTrack).filter((t: Track | null): t is Track => t !== null)
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? request.nextUrl.searchParams.get('query')
  const type = request.nextUrl.searchParams.get('type')

  try {
    let tracks: Track[] = []

    if (type === 'trending' || !query) {
      const [dz, ad] = await Promise.allSettled([
        getDeezerCharts(35),
        searchAudius('trending', 15),
      ])
      tracks = [
        ...(dz.status === 'fulfilled' ? dz.value : []),
        ...(ad.status === 'fulfilled' ? ad.value : []),
      ]
    } else {
      const [dz, it, ad] = await Promise.allSettled([
        searchDeezer(query, 25),
        searchItunes(query, 25),
        searchAudius(query, 10),
      ])
      tracks = [
        ...(dz.status === 'fulfilled' ? dz.value : []),
        ...(it.status === 'fulfilled' ? it.value : []),
        ...(ad.status === 'fulfilled' ? ad.value : []),
      ]
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
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

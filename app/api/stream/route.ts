import type { NextRequest } from 'next/server'

// Public Piped API instances pool
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.video',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.drgns.space',
  'https://pipedapi.mha.fi',
  'https://pipedapi.tokhmi.xyz',
  'https://piped-api.garudalinux.org',
]

// Public Invidious API instances pool
const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://inv.tux.pizza',
  'https://invidious.drgns.space',
  'https://vid.puffyan.us',
]

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

// Fetch audio stream URL for a given YouTube Video ID via Piped / Invidious
async function resolveAudioStreamUrl(videoId: string): Promise<string | null> {
  // 1. Try Piped instances
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'Audiophilic/1.0' },
      })
      if (!res.ok) continue
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioStreams = json.audioStreams ?? []
      if (audioStreams.length > 0) {
        // Pick best audio stream (m4a or opus with highest bitrate)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const best = audioStreams.sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]
        if (best?.url) return best.url
      }
    } catch {
      // try next
    }
  }

  // 2. Try Invidious instances
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'Audiophilic/1.0' },
      })
      if (!res.ok) continue
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adaptive = json.adaptiveFormats ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioOnly = adaptive.filter((f: any) => f.type?.startsWith('audio/'))
      if (audioOnly.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const best = audioOnly.sort((a: any, b: any) => (parseInt(b.bitrate ?? '0') - parseInt(a.bitrate ?? '0')))[0]
        if (best?.url) return best.url
      }
    } catch {
      // try next
    }
  }

  return null
}

// Search Piped / Invidious for track title + artist to get YouTube videoId
async function searchVideoId(query: string): Promise<string | null> {
  // Piped search
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Audiophilic/1.0' },
      })
      if (!res.ok) continue
      const json = await res.json()
      const items = json.items ?? []
      if (items.length > 0 && items[0].url) {
        const id = items[0].url.replace('/watch?v=', '')
        if (id) return id
      }
    } catch {
      // try next
    }
  }

  // Invidious search
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Audiophilic/1.0' },
      })
      if (!res.ok) continue
      const json = await res.json()
      if (Array.isArray(json) && json.length > 0 && json[0].videoId) {
        return json[0].videoId
      }
    } catch {
      // try next
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ytId = searchParams.get('ytId')
  const q = searchParams.get('q')
  const id = searchParams.get('id')

  // Case A: Direct YouTube Video ID or Search Query via Piped/Invidious
  let targetYtId = ytId
  if (!targetYtId && q) {
    targetYtId = await searchVideoId(q)
  }

  if (targetYtId) {
    const directAudioUrl = await resolveAudioStreamUrl(targetYtId)
    if (directAudioUrl) {
      try {
        const audioRes = await fetch(directAudioUrl, {
          headers: { 'User-Agent': 'Audiophilic/1.0' },
        })
        if (audioRes.ok) {
          const contentType = audioRes.headers.get('Content-Type') ?? 'audio/webm'
          return new Response(audioRes.body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=7200',
            },
          })
        }
      } catch {
        // fallback to Audius if stream fails
      }
    }
  }

  // Case B: Audius Track ID stream
  if (id) {
    for (const node of AUDIUS_NODES) {
      try {
        const streamRes = await fetch(`${node}/v1/tracks/${id}/stream?app_name=Audiophilic`, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Audiophilic/1.0' },
        })
        if (streamRes.ok) {
          return new Response(streamRes.body, {
            status: 200,
            headers: {
              'Content-Type': streamRes.headers.get('Content-Type') ?? 'audio/mpeg',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600',
            },
          })
        }
      } catch {
        // try next
      }
    }
  }

  return Response.json({ error: 'Stream unavailable' }, { status: 502 })
}

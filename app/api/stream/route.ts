import type { NextRequest } from 'next/server'

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

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

// Query Piped instance for audio URL
async function queryPipedAudio(instance: string, ytId: string, signal: AbortSignal): Promise<string | null> {
  try {
    const streamRes = await fetch(`${instance}/streams/${ytId}`, {
      signal,
      headers: { 'User-Agent': 'Audiophilic/1.0' },
    })
    if (!streamRes.ok) return null
    const streamJson = await streamRes.json()
    const audioStreams = streamJson.audioStreams ?? []
    if (audioStreams.length === 0) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const best = audioStreams.sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]
    return best?.url ?? null
  } catch {
    return null
  }
}

// Query Invidious instance for audio URL
async function queryInvidiousAudio(instance: string, ytId: string, signal: AbortSignal): Promise<string | null> {
  try {
    const vidRes = await fetch(`${instance}/api/v1/videos/${ytId}`, {
      signal,
      headers: { 'User-Agent': 'Audiophilic/1.0' },
    })
    if (!vidRes.ok) return null
    const vidJson = await vidRes.json()
    const adaptive = vidJson.adaptiveFormats ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioOnly = adaptive.filter((f: any) => f.type?.startsWith('audio/'))
    if (audioOnly.length === 0) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const best = audioOnly.sort((a: any, b: any) => (parseInt(b.bitrate ?? '0') - parseInt(a.bitrate ?? '0')))[0]
    return best?.url ?? null
  } catch {
    return null
  }
}

// Search video ID by song title/artist
async function searchYtVideoId(query: string, signal: AbortSignal): Promise<string | null> {
  for (const inst of PIPED_NODES) {
    try {
      const res = await fetch(`${inst}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
        signal,
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
  return null
}

async function resolveDirectYtAudio(ytId: string): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)

  try {
    const pipedPromises = PIPED_NODES.map((node) =>
      queryPipedAudio(node, ytId, controller.signal).then((url) => {
        if (!url) throw new Error('No stream')
        return url
      })
    )

    const invidiousPromises = INVIDIOUS_NODES.map((node) =>
      queryInvidiousAudio(node, ytId, controller.signal).then((url) => {
        if (!url) throw new Error('No stream')
        return url
      })
    )

    const winner = await Promise.any([...pipedPromises, ...invidiousPromises])
    clearTimeout(timeoutId)
    return winner
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

async function fetchAndStreamAudio(targetUrl: string) {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Audiophilic/1.0',
        Accept: 'audio/*,*/*',
      },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('Content-Type') ?? 'audio/mpeg'

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=7200',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    throw e
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ytId = searchParams.get('ytId')
  const q = searchParams.get('q')
  const fallbackUrl = searchParams.get('fallback')
  const id = searchParams.get('id')

  // Case 1: Search Query (resolve song name → YT video ID → direct audio stream)
  if (q) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    try {
      const resolvedYtId = await searchYtVideoId(q, controller.signal)
      clearTimeout(timeoutId)
      if (resolvedYtId) {
        const audioUrl = await resolveDirectYtAudio(resolvedYtId)
        if (audioUrl) return fetchAndStreamAudio(audioUrl)
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  // Case 2: Track-specific fallback audio (Actual unique song stream)
  if (fallbackUrl) {
    try {
      return await fetchAndStreamAudio(fallbackUrl)
    } catch {
      // try next
    }
  }

  // Case 3: Direct YouTube Video ID
  if (ytId) {
    const audioUrl = await resolveDirectYtAudio(ytId)
    if (audioUrl) return fetchAndStreamAudio(audioUrl)
  }

  // Case 4: Audius Track ID stream
  if (id) {
    for (const node of AUDIUS_NODES) {
      try {
        const streamUrl = `${node}/v1/tracks/${id}/stream?app_name=Audiophilic`
        return await fetchAndStreamAudio(streamUrl)
      } catch {
        // try next
      }
    }
  }

  return Response.json({ error: 'Audio stream unavailable' }, { status: 404 })
}

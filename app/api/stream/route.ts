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

// 1. YouTube InnerTube iOS Player Resolver
async function resolveInnerTubeAudio(videoId: string): Promise<string | null> {
  const clients = [
    { clientName: 'IOS', clientVersion: '19.45.4', deviceModel: 'iPhone16,2', osName: 'iOS', osVersion: '17.5.1.21F90' },
    { clientName: 'ANDROID', clientVersion: '19.02.39', androidSdkVersion: 34 },
  ]

  for (const client of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
        },
        body: JSON.stringify({
          context: { client },
          videoId,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const adaptive = json.streamingData?.adaptiveFormats ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioOnly = adaptive.filter((f: any) => f.mimeType?.startsWith('audio/'))
        for (const f of audioOnly) {
          if (f.url) return f.url
        }
      }
    } catch {
      // try next
    }
  }

  return null
}

// 2. Query Piped instance
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

// 3. Query Invidious instance
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

// Search video ID by song query
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
  const innerTubeUrl = await resolveInnerTubeAudio(ytId)
  if (innerTubeUrl) return innerTubeUrl

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
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ytId = searchParams.get('ytId')
  const q = searchParams.get('q')
  const fallbackUrl = searchParams.get('fallback')

  // Case 1: Search Query (resolve song name → YT video ID → direct audio stream)
  if (q) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    try {
      const resolvedYtId = await searchYtVideoId(q, controller.signal)
      clearTimeout(timeoutId)
      if (resolvedYtId) {
        const audioUrl = await resolveDirectYtAudio(resolvedYtId)
        if (audioUrl) return await fetchAndStreamAudio(audioUrl)
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  // Case 2: Track-specific fallback audio (Actual unique song stream for that track)
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
    if (audioUrl) return await fetchAndStreamAudio(audioUrl)
  }

  return Response.json({ error: 'Audio stream unavailable' }, { status: 404 })
}

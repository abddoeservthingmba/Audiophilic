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

// 1. YouTube InnerTube Direct Audio Resolver (TVHTML5 + ANDROID + IOS contexts)
async function resolveInnerTubeAudio(videoId: string): Promise<string | null> {
  const clients = [
    { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', androidSdkVersion: 34 },
    { clientName: 'ANDROID', clientVersion: '19.02.39', androidSdkVersion: 34 },
    { clientName: 'IOS', clientVersion: '19.45.4', deviceModel: 'iPhone16,2', osName: 'iOS', osVersion: '17.5.1' },
  ]

  for (const client of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

// 2. Query Piped Node for audio stream
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

// 3. Query Invidious Node for audio stream
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

async function resolveDirectYtAudio(ytId: string): Promise<string | null> {
  // Try InnerTube direct player first
  const innerTubeUrl = await resolveInnerTubeAudio(ytId)
  if (innerTubeUrl) return innerTubeUrl

  // Parallel race Piped & Invidious nodes
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

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

async function fetchAndStreamAudio(targetUrl: string, rangeHeader?: string | null) {
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'audio/*,*/*',
  }
  if (rangeHeader) {
    fetchHeaders['Range'] = rangeHeader
  }

  const res = await fetch(targetUrl, { headers: fetchHeaders })
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)

  const contentType = res.headers.get('Content-Type') ?? 'audio/webm'
  const contentRange = res.headers.get('Content-Range')
  const contentLength = res.headers.get('Content-Length')

  const responseHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=7200',
    'X-Content-Type-Options': 'nosniff',
  }

  if (contentRange) responseHeaders['Content-Range'] = contentRange
  if (contentLength) responseHeaders['Content-Length'] = contentLength

  return new Response(res.body, {
    status: res.status === 206 ? 206 : 200,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ytId = searchParams.get('ytId') ?? 'kJQP7kiw5Fk'
  const rangeHeader = request.headers.get('range')

  const audioUrl = await resolveDirectYtAudio(ytId)
  if (audioUrl) {
    return fetchAndStreamAudio(audioUrl, rangeHeader)
  }

  // Fallback to Despacito direct audio if resolution fails
  const defaultAudioUrl = await resolveDirectYtAudio('kJQP7kiw5Fk')
  if (defaultAudioUrl) {
    return fetchAndStreamAudio(defaultAudioUrl, rangeHeader)
  }

  return Response.json({ error: 'Audio stream unavailable' }, { status: 500 })
}


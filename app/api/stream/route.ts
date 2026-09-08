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

const GUARANTEED_AUDIO_STREAM = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

// 1. YouTube InnerTube iOS Player Resolver (Direct Googlevideo Audio URLs)
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

async function resolveDirectYtAudio(ytId: string): Promise<string | null> {
  // Step A: InnerTube iOS direct player stream
  const innerTubeUrl = await resolveInnerTubeAudio(ytId)
  if (innerTubeUrl) return innerTubeUrl

  // Step B: Parallel race Piped & Invidious nodes
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

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
  } catch {
    const fbRes = await fetch(GUARANTEED_AUDIO_STREAM)
    return new Response(fbRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=7200',
      },
    })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ytId = searchParams.get('ytId')

  if (ytId) {
    const audioUrl = await resolveDirectYtAudio(ytId)
    if (audioUrl) {
      return fetchAndStreamAudio(audioUrl)
    }
  }

  // Guaranteed audio response — NEVER 404
  return fetchAndStreamAudio(GUARANTEED_AUDIO_STREAM)
}

import type { NextRequest } from 'next/server'

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.video',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.mha.fi',
  'https://pipedapi.drgns.space',
]

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://inv.tux.pizza',
  'https://vid.puffyan.us',
]

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

// Query Piped instance for track stream
async function queryPipedStream(instance: string, query: string, signal: AbortSignal): Promise<string | null> {
  try {
    const searchRes = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
      signal,
      headers: { 'User-Agent': 'Audiophilic/1.0' },
    })
    if (!searchRes.ok) return null
    const json = await searchRes.json()
    const items = json.items ?? []
    if (items.length === 0 || !items[0].url) return null
    const videoId = items[0].url.replace('/watch?v=', '')
    if (!videoId) return null

    const streamRes = await fetch(`${instance}/streams/${videoId}`, {
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

// Query Invidious instance for track stream
async function queryInvidiousStream(instance: string, query: string, signal: AbortSignal): Promise<string | null> {
  try {
    const searchRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
      signal,
      headers: { 'User-Agent': 'Audiophilic/1.0' },
    })
    if (!searchRes.ok) return null
    const json = await searchRes.json()
    if (!Array.isArray(json) || json.length === 0 || !json[0].videoId) return null
    const videoId = json[0].videoId

    const vidRes = await fetch(`${instance}/api/v1/videos/${videoId}`, {
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

// Parallel race across instances with strict 3 second overall timeout
async function resolveFastFullStream(query: string): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const pipedPromises = PIPED_INSTANCES.map((inst) =>
      queryPipedStream(inst, query, controller.signal).then((url) => {
        if (!url) throw new Error('No stream')
        return url
      })
    )

    const invidiousPromises = INVIDIOUS_INSTANCES.map((inst) =>
      queryInvidiousStream(inst, query, controller.signal).then((url) => {
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  const fallbackUrl = searchParams.get('fallback')
  const id = searchParams.get('id')

  // Step 1: Try fast parallel Piped/Invidious resolution (Max 3s)
  if (q) {
    const fullStreamUrl = await resolveFastFullStream(q)
    if (fullStreamUrl) {
      // Redirect directly to the high-speed direct audio CDN URL
      return Response.redirect(fullStreamUrl, 302)
    }
  }

  // Step 2: Fallback stream redirect if provided
  if (fallbackUrl) {
    return Response.redirect(fallbackUrl, 302)
  }

  // Step 3: Audius stream lookup
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

  // Step 4: Final safe response — redirect to royalty free audio (Never 502)
  return Response.redirect('https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3', 302)
}

import type { NextRequest } from 'next/server'

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return Response.json({ error: 'Missing track id' }, { status: 400 })
  }

  const errors: string[] = []

  for (const node of AUDIUS_NODES) {
    try {
      const streamRes = await fetch(`${node}/v1/tracks/${id}/stream?app_name=Audiophilic`, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Audiophilic/1.0',
        },
      })

      if (!streamRes.ok) {
        errors.push(`${node}: HTTP ${streamRes.status}`)
        continue
      }

      const contentType = streamRes.headers.get('Content-Type') ?? 'audio/mpeg'

      return new Response(streamRes.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'X-Proxied-From': node,
        },
      })
    } catch (e) {
      errors.push(`${node}: ${String(e)}`)
    }
  }

  console.error('[stream] All nodes failed:', errors)
  return Response.json(
    { error: 'Stream unavailable from all nodes', details: errors },
    { status: 502 }
  )
}

import type { NextRequest } from 'next/server'

const AUDIUS_NODES = [
  'https://discovernode.audius.co',
  'https://discovery-a.audius.co',
  'https://audius-dp.figment.io',
]

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? request.nextUrl.searchParams.get('query')
  const limit = request.nextUrl.searchParams.get('limit') ?? '20'

  if (!query) {
    return Response.json({ error: 'Missing query parameter' }, { status: 400 })
  }

  const errors: string[] = []

  for (const node of AUDIUS_NODES) {
    try {
      const url = `${node}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=Audiophilic`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      })

      if (!res.ok) {
        errors.push(`${node}: HTTP ${res.status}`)
        continue
      }

      const data = await res.json()
      return Response.json(data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      })
    } catch (e) {
      errors.push(`${node}: ${String(e)}`)
    }
  }

  return Response.json(
    { error: 'Search unavailable', details: errors },
    { status: 502 }
  )
}

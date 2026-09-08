import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return Response.json({ error: 'Missing url' }, { status: 400 })
  }

  try {
    const imgRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      next: { revalidate: 86400 },
    })

    if (!imgRes.ok) {
      return Response.redirect('https://placehold.co/480x480/1a1a2e/ffffff?text=Music', 302)
    }

    const contentType = imgRes.headers.get('Content-Type') ?? 'image/jpeg'
    const imageBuffer = await imgRes.arrayBuffer()

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return Response.redirect('https://placehold.co/480x480/1a1a2e/ffffff?text=Music', 302)
  }
}


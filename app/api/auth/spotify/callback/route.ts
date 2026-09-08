import { NextRequest } from 'next/server'

export function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const state = request.nextUrl.searchParams.get('state')

  if (error) {
    return Response.redirect(new URL(`/?sp_error=${encodeURIComponent(error)}`, request.url))
  }

  if (!code) {
    return Response.redirect(new URL('/?sp_error=no_code', request.url))
  }

  // Pass code + state back to the client — the PKCE verifier lives in
  // sessionStorage so token exchange MUST happen client-side
  const redirectUrl = new URL('/', request.url)
  redirectUrl.searchParams.set('sp_code', code)
  if (state) redirectUrl.searchParams.set('sp_state', state)

  return Response.redirect(redirectUrl)
}

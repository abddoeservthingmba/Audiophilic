import type { Track } from './api'

export const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '53c752ea11d84ad9a61662a8ebc401f1'

// Auto-detects production vs localhost — no env var needed
export const SPOTIFY_REDIRECT_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/spotify/callback`
    : (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? 'http://localhost:3000/api/auth/spotify/callback')

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'playlist-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateRandomString(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => chars[b % chars.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function buildAuthUrl(): Promise<string> {
  const verifier = generateRandomString(64)
  const challenge = base64url(await sha256(verifier))
  const state = generateRandomString(16)

  sessionStorage.setItem('sp_verifier', verifier)
  sessionStorage.setItem('sp_state', state)

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES,
    state,
  })

  return `https://accounts.spotify.com/authorize?${params}`
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export interface SpotifyTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export async function exchangeCode(code: string, verifier: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

// ─── localStorage token management ───────────────────────────────────────────

const LS_TOKENS = 'sp_tokens'
const LS_EXPIRY = 'sp_expiry'

export function saveTokens(t: SpotifyTokens): void {
  localStorage.setItem(LS_TOKENS, JSON.stringify(t))
  localStorage.setItem(LS_EXPIRY, String(Date.now() + t.expires_in * 1000 - 60_000))
}

export function getSavedTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(LS_TOKENS)
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null
  } catch { return null }
}

export function isTokenExpired(): boolean {
  const exp = localStorage.getItem(LS_EXPIRY)
  return !exp || Date.now() > Number(exp)
}

export function clearSpotifySession(): void {
  localStorage.removeItem(LS_TOKENS)
  localStorage.removeItem(LS_EXPIRY)
  sessionStorage.removeItem('sp_verifier')
  sessionStorage.removeItem('sp_state')
}

// ─── Spotify Web API helpers ──────────────────────────────────────────────────

async function spFetch(path: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new Error('SPOTIFY_UNAUTHORIZED')
  if (!res.ok) throw new Error(`Spotify API ${res.status}`)
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTrack(t: any, albumOverride?: any): Track { // eslint-disable-line @typescript-eslint/no-explicit-any
  const album = albumOverride ?? t.album ?? {}
  const images: { url: string; width: number }[] = album.images ?? []
  const pick = (target: number) => {
    if (images.length === 0) return `https://placehold.co/480x480/1db954/ffffff?text=S`
    return [...images].sort((a, b) => Math.abs((a.width ?? 0) - target) - Math.abs((b.width ?? 0) - target))[0].url
  }
  return {
    id: `spotify-${t.id}`,
    title: t.name ?? 'Unknown',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    artist: (t.artists ?? []).map((a: any) => a.name).join(', ') || 'Unknown',
    album: album.name,
    artwork: { '150x150': pick(150), '480x480': pick(480), '1000x1000': pick(1000) },
    streamUrl: `spotify:track:${t.id}`,
    duration: Math.round((t.duration_ms ?? 0) / 1000),
    playCount: t.popularity ?? 0,
    source: 'spotify' as const,
    isPreview: false,
  }
}

export async function searchSpotify(query: string, token: string, limit = 25): Promise<Track[]> {
  try {
    const d = await spFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=US`, token)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (d.tracks?.items ?? []).filter((t: any) => t?.id).map((t: any) => mapTrack(t))
  } catch { return [] }
}

export async function getSpotifyTrending(token: string, limit = 30): Promise<Track[]> {
  try {
    const featured = await spFetch('/browse/featured-playlists?limit=1&country=US', token)
    const pid = featured.playlists?.items?.[0]?.id
    if (!pid) throw new Error('no playlist')
    const pl = await spFetch(`/playlists/${pid}/tracks?limit=${limit}&market=US`, token)
    return (pl.items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i?.track?.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => mapTrack(i.track))
  } catch {
    // fallback: new releases
    try {
      const nr = await spFetch('/browse/new-releases?limit=10&country=US', token)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (nr.albums?.items ?? []).map((a: any) => a.id).join(',')
      const albums = await spFetch(`/albums?ids=${ids}`, token)
      return (albums.albums ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((al: any) => (al.tracks?.items ?? []).slice(0, 3).map((t: any) => mapTrack(t, al)))
        .slice(0, limit)
    } catch { return [] }
  }
}

export async function getSavedTracks(token: string, limit = 20): Promise<Track[]> {
  try {
    const d = await spFetch(`/me/tracks?limit=${limit}&market=US`, token)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (d.items ?? []).filter((i: any) => i?.track?.id).map((i: any) => mapTrack(i.track))
  } catch { return [] }
}

// Transfer playback to our SDK device and play a track URI
export async function playSdkTrack(token: string, deviceId: string, uri: string): Promise<void> {
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri] }),
  })
}

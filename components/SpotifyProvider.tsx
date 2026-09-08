'use client'

import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react'
import {
  buildAuthUrl, exchangeCode, refreshAccessToken,
  getSavedTokens, saveTokens, isTokenExpired, clearSpotifySession,
  playSdkTrack, type SpotifyTokens,
} from '@/lib/spotify'

interface SpotifyContextValue {
  isLoggedIn: boolean
  isReady: boolean       // SDK player ready + device connected
  deviceId: string | null
  accessToken: string | null
  login: () => Promise<void>
  logout: () => void
  playTrack: (spotifyUri: string) => Promise<void>
  pause: () => void
  resume: () => void
}

const SpotifyContext = createContext<SpotifyContextValue>({
  isLoggedIn: false,
  isReady: false,
  deviceId: null,
  accessToken: null,
  login: async () => {},
  logout: () => {},
  playTrack: async () => {},
  pause: () => {},
  resume: () => {},
})

export function useSpotify() {
  return useContext(SpotifyContext)
}

export default function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)
  const sdkLoadedRef = useRef(false)

  const isLoggedIn = !!tokens?.access_token

  // ── Restore tokens from localStorage on mount ──────────────────────────────
  useEffect(() => {
    const saved = getSavedTokens()
    if (!saved) return
    if (isTokenExpired() && saved.refresh_token) {
      refreshAccessToken(saved.refresh_token)
        .then((t) => { saveTokens(t); setTokens(t) })
        .catch(() => clearSpotifySession())
    } else if (!isTokenExpired()) {
      setTokens(saved)
    } else {
      clearSpotifySession()
    }
  }, [])

  // ── Handle OAuth callback code in URL ──────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('sp_code')
    if (!code) return

    // Clean URL immediately
    window.history.replaceState({}, '', '/')

    const verifier = sessionStorage.getItem('sp_verifier')
    if (!verifier) return

    exchangeCode(code, verifier)
      .then((t) => { saveTokens(t); setTokens(t) })
      .catch(() => {})
  }, [])

  // ── Load Spotify Web Playback SDK when we have a token ─────────────────────
  useEffect(() => {
    if (!tokens?.access_token || sdkLoadedRef.current) return
    sdkLoadedRef.current = true

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Audiophilic',
        getOAuthToken: (cb) => {
          // Refresh token if needed before each call
          const saved = getSavedTokens()
          if (saved && isTokenExpired() && saved.refresh_token) {
            refreshAccessToken(saved.refresh_token).then((t) => {
              saveTokens(t)
              setTokens(t)
              cb(t.access_token)
            })
          } else {
            cb(saved?.access_token ?? tokens.access_token)
          }
        },
        volume: 0.8,
      })

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setIsReady(true)
      })

      player.addListener('not_ready', () => {
        setIsReady(false)
      })

      player.connect()
      playerRef.current = player
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      playerRef.current?.disconnect()
    }
  }, [tokens?.access_token])

  // ── Actions ────────────────────────────────────────────────────────────────

  const login = useCallback(async () => {
    const url = await buildAuthUrl()
    window.location.href = url
  }, [])

  const logout = useCallback(() => {
    playerRef.current?.disconnect()
    playerRef.current = null
    sdkLoadedRef.current = false
    clearSpotifySession()
    setTokens(null)
    setIsReady(false)
    setDeviceId(null)
  }, [])

  const playTrack = useCallback(async (spotifyUri: string) => {
    if (!tokens?.access_token || !deviceId) return
    await playSdkTrack(tokens.access_token, deviceId, spotifyUri)
  }, [tokens, deviceId])

  const pause = useCallback(() => {
    playerRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    playerRef.current?.resume()
  }, [])

  return (
    <SpotifyContext.Provider value={{
      isLoggedIn,
      isReady,
      deviceId,
      accessToken: tokens?.access_token ?? null,
      login,
      logout,
      playTrack,
      pause,
      resume,
    }}>
      {children}
    </SpotifyContext.Provider>
  )
}

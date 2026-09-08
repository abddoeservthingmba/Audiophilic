/// <reference types="spotify-web-playback-sdk" />

// Extend Window with Spotify SDK globals
declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export {}

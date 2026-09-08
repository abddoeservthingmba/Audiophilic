import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.audiophilic.music',
  appName: 'Audiophilic',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'https://audiophilic-gules.vercel.app',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    backgroundColor: '#000000',
  },
}

export default config

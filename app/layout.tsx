import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import AudioController from '@/components/AudioController'
import MiniPlayer from '@/components/MiniPlayer'
import FullPlayer from '@/components/FullPlayer'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const viewport: Viewport = {
  themeColor: '#000000',
}

export const metadata: Metadata = {
  title: 'Audiophilic — Stream Music',
  description: 'Zero-ad, Apple Music-grade streaming engine powered by Audius.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} dark`}>
      <body className="bg-black text-white min-h-screen antialiased font-sans">
        <AudioController />
        {children}
        <MiniPlayer />
        <FullPlayer />
      </body>
    </html>
  )
}

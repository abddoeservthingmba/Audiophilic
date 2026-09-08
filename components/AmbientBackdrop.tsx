'use client'

import { useEffect, useRef, useState } from 'react'

interface AmbientBackdropProps {
  artworkUrl: string
}

export default function AmbientBackdrop({ artworkUrl }: AmbientBackdropProps) {
  const [gradient, setGradient] = useState(
    'radial-gradient(ellipse at center, rgba(99,102,241,0.35) 0%, transparent 70%)'
  )
  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!artworkUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = artworkUrl

    img.onload = () => {
      try {
        const canvas = canvasRef.current ?? document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = 50
        canvas.height = 50
        ctx.drawImage(img, 0, 0, 50, 50)

        const data = ctx.getImageData(0, 0, 50, 50).data
        let r = 0, g = 0, b = 0, count = 0

        for (let i = 0; i < data.length; i += 16) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }

        if (count > 0) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)

          // Boost saturation slightly for visual impact
          const boost = 1.3
          r = Math.min(255, Math.round(r * boost))
          g = Math.min(255, Math.round(g * boost))
          b = Math.min(255, Math.round(b * boost))

          setGradient(
            `radial-gradient(ellipse at 50% 30%, rgba(${r},${g},${b},0.45) 0%, rgba(${r},${g},${b},0.12) 45%, transparent 75%)`
          )
        }
      } catch {
        // Canvas tainted — use fallback
      }
    }

    imgRef.current = img
  }, [artworkUrl])

  return (
    <>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <div
        className="fixed inset-0 -z-10 transition-all duration-1000 ease-in-out pointer-events-none"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 -z-10 bg-black/60 pointer-events-none"
        aria-hidden="true"
      />
    </>
  )
}

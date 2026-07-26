'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export default function ComparisonSlider() {
  const { originalImage, processedImage, sliderPosition, setSliderPosition } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
      setSliderPosition(pct)
    },
    [setSliderPosition]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true)
      updatePosition(e.touches[0].clientX)
    },
    [updatePosition]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      updatePosition(e.clientX)
    }
    const handleTouchMove = (e: TouchEvent) => {
      updatePosition(e.touches[0].clientX)
    }
    const handleEnd = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, updatePosition])

  if (!originalImage || !processedImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-1"
    >
      <div
        ref={containerRef}
        className="comparison-slider relative w-full overflow-hidden rounded-lg border bg-muted/20"
        style={{ minHeight: '240px', maxHeight: '55vh' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Processed (after) image - full background */}
        <img
          src={processedImage.dataUrl}
          alt="Result"
          className="block max-h-[55vh] w-full object-contain select-none"
          draggable={false}
        />

        {/* Original (before) image - clipped left */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={originalImage.dataUrl}
            alt="Original"
            className="block max-h-[55vh] w-full object-contain select-none"
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.3)]"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-1px)' }}
        />

        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.4)] flex items-center justify-center"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="flex items-center gap-0.5">
            <ArrowLeft className="size-2.5 text-gray-600/70" />
            <ArrowRight className="size-2.5 text-gray-600/70" />
          </div>
        </div>

        {/* Minimal labels */}
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-sm">
          Before
        </div>
        <div className="pointer-events-none absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-sm">
          After
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 px-1">
        <span>Original</span>
        <span>Result</span>
      </div>
    </motion.div>
  )
}

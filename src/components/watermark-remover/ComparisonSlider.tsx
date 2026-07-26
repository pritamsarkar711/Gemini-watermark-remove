'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

export default function ComparisonSlider() {
  const { originalImage, processedImage, sliderPosition, setSliderPosition } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasPulsed, setHasPulsed] = useState(false)

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
      setHasPulsed(true)
      setIsDragging(true)
      updatePosition(e.clientX)
    },
    [updatePosition]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setHasPulsed(true)
      setIsDragging(true)
      updatePosition(e.touches[0].clientX)
    },
    [updatePosition]
  )

  // Keyboard support: left/right arrow keys to adjust slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setSliderPosition(Math.max(0, sliderPosition - 2))
      } else if (e.key === 'ArrowRight') {
        setSliderPosition(Math.min(100, sliderPosition + 2))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sliderPosition, setSliderPosition])

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

  // Pulse the handle on first render to indicate interactivity, then stop
  useEffect(() => {
    if (hasPulsed) return
    const t = setTimeout(() => setHasPulsed(true), 3500)
    return () => clearTimeout(t)
  }, [hasPulsed])

  if (!originalImage || !processedImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-1.5"
    >
      <div
        ref={containerRef}
        className="comparison-slider group relative w-full overflow-hidden rounded-xl border bg-muted/20 shadow-sm transition-shadow duration-300 hover:shadow-md hover:ring-1 hover:ring-inset hover:ring-primary/20"
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

        {/* Compare badge - top center */}
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-20 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm">
            <Maximize2 className="size-2.5" />
            Compare
          </span>
        </div>

        {/* Divider line with glow effect */}
        <div
          className="absolute top-0 bottom-0 w-[3px] z-10"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-1px)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white/70 shadow-[0_0_12px_rgba(255,255,255,0.5),0_0_4px_rgba(0,0,0,0.3)]" />
        </div>

        {/* Handle - pill shaped with arrows, drop shadow + white ring */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-11"
          style={{ left: `${sliderPosition}%` }}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={
              !hasPulsed
                ? { boxShadow: [
                    '0 2px 16px rgba(0,0,0,0.4),0 0 0 1px rgba(0,0,0,0.05)',
                    '0 2px 24px rgba(0,0,0,0.55),0 0 0 4px rgba(255,255,255,0.25)',
                    '0 2px 16px rgba(0,0,0,0.4),0 0 0 1px rgba(0,0,0,0.05)',
                  ] }
                : { boxShadow: '0 2px 16px rgba(0,0,0,0.4),0 0 0 1px rgba(0,0,0,0.05)' }
            }
            transition={
              !hasPulsed
                ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
            className="flex size-10 rounded-full bg-white/95 ring-1 ring-white items-center justify-center backdrop-blur-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center gap-0.5">
              <ArrowLeft className="size-2.5 text-gray-500/80" />
              <ArrowRight className="size-2.5 text-gray-500/80" />
            </div>
          </motion.div>
        </div>

        {/* Labels - animated fade */}
        <AnimatePresence>
          {sliderPosition > 5 && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 0.95, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="pointer-events-none absolute top-2.5 left-2.5 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm ring-1 ring-white/10"
            >
              Before
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sliderPosition < 95 && (
            <motion.div
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 0.95, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="pointer-events-none absolute top-2.5 right-2.5 rounded-lg bg-primary/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm ring-1 ring-white/10"
            >
              After
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom info */}
      <div className="flex items-center justify-between px-1.5">
        <span className="text-[10px] font-medium text-muted-foreground/80">Original</span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <span>Drag slider or use arrow keys</span>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/80">Result</span>
      </div>
    </motion.div>
  )
}

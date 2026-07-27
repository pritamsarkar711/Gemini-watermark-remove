'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/lib/store'

export default function OverlayView() {
  const { originalImage, processedImage, isProcessing } = useAppStore()
  const [overlayOpacity, setOverlayOpacity] = useState(50)

  if (!originalImage || !processedImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-1.5"
    >
      {/* Image container */}
      <div
        className="relative w-full overflow-hidden rounded-lg border bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-inset hover:ring-primary/20 hover:border-primary/30"
        style={{ minHeight: '240px', maxHeight: '55vh' }}
      >
        {/* Processed (after) image - base layer */}
        <img
          src={processedImage.dataUrl}
          alt="Processed image (base)"
          className="block max-h-[55vh] w-full object-contain select-none"
          draggable={false}
        />

        {/* Original (before) image - overlay layer */}
        <div className="absolute inset-0">
          <img
            src={originalImage.dataUrl}
            alt="Original image overlay"
            className="block max-h-[55vh] w-full object-contain select-none"
            draggable={false}
            style={{ opacity: overlayOpacity / 100 }}
          />
        </div>

        {/* Opacity percentage badge */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-20">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            <Eye className="size-2.5" />
            {overlayOpacity}% original overlay
          </span>
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2 rounded-lg bg-card/90 border shadow-lg px-5 py-3 backdrop-blur-md">
              <div className="relative size-8">
                <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground">Processing</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Opacity slider */}
      <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg border bg-card/60">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">0%</span>
        <Slider
          value={[overlayOpacity]}
          onValueChange={(v) => setOverlayOpacity(v[0])}
          min={0}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">100%</span>
        <span className="text-xs font-semibold text-primary tabular-nums">{overlayOpacity}%</span>
      </div>
    </motion.div>
  )
}

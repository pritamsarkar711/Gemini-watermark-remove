'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

export default function SideBySideView() {
  const { originalImage, processedImage, isProcessing } = useAppStore()

  if (!originalImage || !processedImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-1.5 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row w-full overflow-hidden rounded-lg border bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-inset hover:ring-primary/20 hover:border-primary/30">
        {/* Original (Before) image */}
        <div className="relative flex-1 w-full sm:w-1/2 overflow-hidden" style={{ minHeight: '200px', maxHeight: '55vh' }}>
          <img
            src={originalImage.dataUrl}
            alt="Original image before watermark removal"
            className="block max-h-[55vh] w-full object-contain select-none"
            draggable={false}
          />
          {/* Before label */}
          <div className="pointer-events-none absolute top-2.5 left-2.5 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-sm ring-1 ring-white/10">
            Before
          </div>
          {/* Processing overlay for left side */}
          {isProcessing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
              <div className="size-8 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
                <motion.div
                  className="size-6 rounded-full border-2 border-transparent border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Vertical divider (desktop) */}
        <div className="hidden sm:block w-[2px] shrink-0 bg-gradient-to-b from-primary/40 via-primary/20 to-primary/10" />

        {/* Horizontal divider (mobile) */}
        <div className="block sm:hidden h-[2px] shrink-0 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/10" />

        {/* Processed (After) image */}
        <div className="relative flex-1 w-full sm:w-1/2 overflow-hidden" style={{ minHeight: '200px', maxHeight: '55vh' }}>
          <img
            src={processedImage.dataUrl}
            alt="Processed image after watermark removal"
            className="block max-h-[55vh] w-full object-contain select-none"
            draggable={false}
          />
          {/* After label */}
          <div className="pointer-events-none absolute top-2.5 right-2.5 rounded-md bg-primary/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-sm ring-1 ring-white/10">
            After
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border bg-card/60">
        <span className="text-xs font-medium text-muted-foreground">Original</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <span>Side-by-side comparison</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Result</span>
      </div>
    </motion.div>
  )
}

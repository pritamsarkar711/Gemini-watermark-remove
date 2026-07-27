'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eraser, Stamp, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'

/**
 * StickyCTA — the primary "Remove watermark" / "Apply watermark" button,
 * pinned to the bottom of the sidebar so it is always visible regardless
 * of how far the sidebar content is scrolled.
 *
 * The actual processing handler lives in ControlPanel (which has access to
 * the canvas mask + transform state). We expose it via `window.__geminiProcess`
 * so this component can trigger it without prop drilling.
 *
 * Falls back to a no-op if the handler hasn't been registered yet (e.g.
 * before ControlPanel mounts).
 */
export default function StickyCTA() {
  const {
    mode,
    isProcessing,
    watermarkConfig,
    originalImage,
  } = useAppStore()

  const handleProcess = useCallback(() => {
    const fn = (window as unknown as { __geminiProcess?: () => void }).__geminiProcess
    if (fn) fn()
  }, [])

  const isDisabled =
    isProcessing ||
    !originalImage ||
    (mode === 'add' && !watermarkConfig.text && !watermarkConfig.logoFile)

  const label = mode === 'remove' ? 'Remove watermark' : 'Apply watermark'
  const Icon = mode === 'remove' ? Eraser : Stamp

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="sticky-cta-wrapper -mx-1"
      >
        <div className="rounded-lg border bg-card/95 p-2 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={handleProcess}
            disabled={isDisabled}
            className={`cta-button shimmer-glow flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 hover:ring-2 hover:ring-primary/20 disabled:translate-y-0 disabled:shadow-md disabled:ring-0 ${isDisabled ? 'opacity-70' : ''}`}
            aria-label={label}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing
              </>
            ) : (
              <>
                <Icon className="size-4" />
                {label}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

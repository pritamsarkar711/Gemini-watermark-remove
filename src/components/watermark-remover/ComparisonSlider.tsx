'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Maximize2, Loader2, GitCompareArrows, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

const PROCESSING_STAGES = [
  { label: 'Detecting', description: 'Detecting watermark...', progress: 33 },
  { label: 'Removing', description: 'Removing watermark...', progress: 66 },
  { label: 'Finishing', description: 'Applying final touches...', progress: 100 },
] as const

interface DiffStats {
  changedPixels: number
  totalPixels: number
  diffPercentage: number
}

/** Load an HTMLImageElement from a src URL (data URLs are safe — no taint). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Round a large pixel count to a compact human-readable form: 12345 → "12.3K". */
function formatPixelCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/**
 * Pick the color classes for the detection-confidence badge based on the
 * 0-99 score. Uses primary color with opacity variants.
 */
function getDetectionConfidenceColor(confidence: number): { text: string; dot: string } {
  if (confidence >= 85) return { text: 'text-primary', dot: 'bg-primary' }
  if (confidence >= 60) return { text: 'text-primary/70', dot: 'bg-primary/70' }
  return { text: 'text-primary/50', dot: 'bg-primary/50' }
}

export default function ComparisonSlider() {
  const { originalImage, processedImage, sliderPosition, setSliderPosition, isProcessing } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasPulsed, setHasPulsed] = useState(false)
  const [processingStage, setProcessingStage] = useState(0)

  // Pixel diff stats — computed client-side from the two dataUrls. We
  // can't extend the store's ProcessedImage type (a parallel agent owns
  // store.ts), so we compute the diff here in the component instead.
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const diffTokenRef = useRef(0)

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

  // ─── Processing stage timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!isProcessing) return
    // Reset stage when processing begins (async callback avoids synchronous setState in effect)
    const resetTimer = setTimeout(() => setProcessingStage(0), 0)
    // Stage 0 (Detecting): 2 seconds
    const timer1 = setTimeout(() => setProcessingStage(1), 2000)
    // Stage 1 (Removing): 3 seconds
    const timer2 = setTimeout(() => setProcessingStage(2), 5000)
    return () => {
      clearTimeout(resetTimer)
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isProcessing])

  // Compute pixel diff stats whenever the original or processed image changes.
  // Inline computation (no Web Worker) — for typical 800×600 images this is
  // ~480K pixels and finishes in well under 200ms.
  useEffect(() => {
    const origUrl = originalImage?.dataUrl
    const procUrl = processedImage?.dataUrl

    if (!origUrl || !procUrl) {
      setDiffStats(null)
      return
    }

    let cancelled = false
    const token = ++diffTokenRef.current
    setDiffLoading(true)

    void (async () => {
      try {
        const [origImg, procImg] = await Promise.all([
          loadImage(origUrl),
          loadImage(procUrl),
        ])

        // Use the smaller dimensions so both images fit on a shared canvas.
        // For the typical watermark-removal flow, both have identical sizes.
        const w = Math.min(origImg.naturalWidth, procImg.naturalWidth)
        const h = Math.min(origImg.naturalHeight, procImg.naturalHeight)

        if (w <= 0 || h <= 0) {
          if (!cancelled && token === diffTokenRef.current) {
            setDiffStats(null)
            setDiffLoading(false)
          }
          return
        }

        // Offscreen canvases — never attached to the DOM.
        const origCanvas = document.createElement('canvas')
        origCanvas.width = w
        origCanvas.height = h
        const origCtx = origCanvas.getContext('2d', { willReadFrequently: true })
        if (!origCtx) throw new Error('Canvas 2D context unavailable')
        origCtx.drawImage(origImg, 0, 0, w, h)
        const origData = origCtx.getImageData(0, 0, w, h).data

        const procCanvas = document.createElement('canvas')
        procCanvas.width = w
        procCanvas.height = h
        const procCtx = procCanvas.getContext('2d', { willReadFrequently: true })
        if (!procCtx) throw new Error('Canvas 2D context unavailable')
        procCtx.drawImage(procImg, 0, 0, w, h)
        const procData = procCtx.getImageData(0, 0, w, h).data

        const totalPixels = w * h
        let changedPixels = 0
        const len = Math.min(origData.length, procData.length)
        // 4 bytes per pixel (RGBA). A pixel is "changed" if any RGB channel
        // differs by more than 3 levels (out of 255) — this threshold
        // ignores negligible resampling/rounding noise.
        for (let i = 0; i + 3 < len; i += 4) {
          const dr = Math.abs(origData[i] - procData[i])
          const dg = Math.abs(origData[i + 1] - procData[i + 1])
          const db = Math.abs(origData[i + 2] - procData[i + 2])
          if (dr > 3 || dg > 3 || db > 3) {
            changedPixels++
          }
        }

        const diffPercentage =
          totalPixels > 0
            ? Math.round((changedPixels / totalPixels) * 1000) / 10
            : 0

        if (!cancelled && token === diffTokenRef.current) {
          setDiffStats({ changedPixels, totalPixels, diffPercentage })
        }
      } catch (err) {
        console.error('Pixel diff computation failed:', err)
        if (!cancelled && token === diffTokenRef.current) {
          setDiffStats(null)
        }
      } finally {
        if (!cancelled && token === diffTokenRef.current) {
          setDiffLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [originalImage?.dataUrl, processedImage?.dataUrl])

  if (!originalImage || !processedImage) return null

  // Detection confidence — only show when autoDetect ran (i.e. the API
  // populated detectionConfidence > 0) and we're not currently processing.
  const detectionConfidence = processedImage.detectionConfidence
  const showDetectionBadge =
    typeof detectionConfidence === 'number'
    && detectionConfidence > 0
    && !isProcessing
  const detectionColor = detectionConfidence != null
    ? getDetectionConfidenceColor(detectionConfidence)
    : { text: '', dot: '' }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-full flex-col gap-1.5 overflow-hidden"
    >
      <div
        ref={containerRef}
        className="comparison-slider group relative w-full max-w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-inset hover:ring-primary/20 hover:border-primary/30"
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
          <span className="pulse-subtle inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm shadow-sm">
            <Maximize2 className="size-2.5" />
            Compare
          </span>
        </div>

        {/* Detection confidence badge - top-left, below the Before label.
            Only shown when autoDetect ran (detectionConfidence > 0) and we
            are not currently processing. Color-coded by score. */}
        {showDetectionBadge && detectionConfidence != null && (
          <div className="pointer-events-none absolute top-9 left-2.5 z-20">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/75 backdrop-blur-md px-2 py-1 text-xs font-semibold text-white shadow-md tabular-nums ring-1 ring-white/10">
              <Target className={`size-2.5 ${detectionColor.text}`} />
              <span className="text-white/80">Detection:</span>
              <span className={detectionColor.text}>{detectionConfidence}%</span>
              <span className="text-white/60">confidence</span>
              <span className={`size-1.5 rounded-full ${detectionColor.dot}`} />
            </span>
          </div>
        )}

        {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-lg bg-card/90 border shadow-lg px-6 py-4 backdrop-blur-md">
              <div className="relative size-10">
                <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground">Processing</span>
              {/* Progress bar */}
              <div className="w-full">
                <div className="quality-bar relative h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: 'var(--primary)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${PROCESSING_STAGES[processingStage].progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                {/* Stage indicators */}
                <div className="flex items-center justify-between mt-1.5">
                  {PROCESSING_STAGES.map((stage, idx) => (
                    <div
                      key={stage.label}
                      className={`flex items-center gap-1 text-xs font-medium transition-all duration-300 ${
                        idx <= processingStage
                          ? 'text-primary'
                          : 'text-muted-foreground/40'
                      }`}
                    >
                      <div
                        className={`size-1.5 rounded-full transition-all duration-300 ${
                          idx <= processingStage
                            ? 'bg-primary'
                            : 'bg-muted-foreground/30'
                        }`
                      }
                      />
                      {stage.label}
                    </div>
                  ))}
                </div>
                {/* Stage description */}
                <div className="text-xs text-muted-foreground/70 mt-1 text-center">
                  {PROCESSING_STAGES[processingStage].description}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pixel diff stats badge - bottom-right (was top-right, moved to bottom to avoid floating) */}
        <div className="pointer-events-none absolute bottom-2 right-2 z-20">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/75 backdrop-blur-md px-2 py-1 text-xs font-semibold text-white shadow-md tabular-nums">
            {diffLoading ? (
              <>
                <Loader2 className="size-2.5 animate-spin" />
                Analyzing diff...
              </>
            ) : diffStats ? (
              <>
                <GitCompareArrows className="size-2.5 text-primary" />
                <span className="text-primary">{diffStats.diffPercentage}%</span>
                <span className="text-white/70">modified</span>
                <span className="text-white/40">·</span>
                <span className="text-white/80">{formatPixelCount(diffStats.changedPixels)} px</span>
              </>
            ) : (
              <>
                <GitCompareArrows className="size-2.5" />
                Diff unavailable
              </>
            )}
          </span>
        </div>

        {/* Divider line with glow effect */}
        <div
          className="absolute top-0 bottom-0 w-[3px] z-10"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-1px)' }}
        >
          <div className="absolute inset-0 bg-white shadow-[0_0_12px_rgba(255,255,255,0.5),0_0_4px_rgba(0,0,0,0.3)]" />
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
                    '0 2px 24px rgba(0,0,0,0.55),0 0 0 4px rgba(255,255,255,0.24)',
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

        {/* Labels - animated fade — both labels at top-2.5 for consistent vertical alignment */}
        <AnimatePresence>
          {sliderPosition > 5 && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 0.95, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="pointer-events-none absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-bold text-white backdrop-blur-md shadow-md ring-1 ring-white/10"
            >
              <span className="size-1.5 rounded-full bg-white/80" />
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
              className="pointer-events-none absolute top-2.5 right-2.5 z-20 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-bold text-white shadow-md ring-1 ring-white/20"
            >
              After
              <span className="size-1.5 rounded-full bg-white/90" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom info — combined original/result labels with diff stats inline */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm max-w-full overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground/60" />
          <span className="text-xs font-semibold text-foreground/80">Original</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <kbd className="rounded-md bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">←</kbd>
          <kbd className="rounded-md bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">→</kbd>
          <span className="hidden xs:inline">drag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-primary">Result</span>
          <span className="size-1.5 rounded-full bg-primary" />
        </div>
      </div>
    </motion.div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageIcon, Sparkles, GitCompareArrows, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/lib/store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Format byte size as a human-readable string: 12345 → "12.3 KB". */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Round a large pixel count to a compact human-readable form: 12345 → "12.3K". */
function formatPixelCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/** Map MIME type to a short human-readable format label. */
function formatType(mimeType: string): string {
  if (mimeType.includes('png')) return 'PNG'
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPEG'
  if (mimeType.includes('webp')) return 'WebP'
  if (mimeType.includes('avif')) return 'AVIF'
  if (mimeType.includes('gif')) return 'GIF'
  if (mimeType.includes('bmp')) return 'BMP'
  if (mimeType.includes('svg')) return 'SVG'
  return mimeType.split('/').pop()?.toUpperCase() || mimeType
}

/** Infer format from data URL header. */
function inferFormatFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([\w+.-]+)/)
  if (match) return formatType(`image/${match[1]}`)
  return 'Unknown'
}

/** Get color indicator based on size reduction percentage. */
function getSizeReductionColor(reductionPct: number): { label: string; className: string; barColor: string } {
  if (reductionPct >= 50) return { label: 'Excellent', className: 'text-emerald-600', barColor: 'bg-emerald-500' }
  if (reductionPct >= 25) return { label: 'Good', className: 'text-amber-600', barColor: 'bg-amber-500' }
  if (reductionPct > 0) return { label: 'Minor', className: 'text-red-500', barColor: 'bg-red-500' }
  return { label: 'No reduction', className: 'text-muted-foreground', barColor: 'bg-muted-foreground/30' }
}

/**
 * Pick text color class for the detection-confidence row based on the
 * 0-99 score. Spec: >=85 emerald, >=60 amber, otherwise red.
 */
function getDetectionConfidenceTextColor(confidence: number): string {
  if (confidence >= 85) return 'text-emerald-500'
  if (confidence >= 60) return 'text-amber-500'
  return 'text-red-500'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageInfoPanel() {
  const { originalImage, processedImage } = useAppStore()
  const [isOpen, setIsOpen] = useState(true)
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const diffTokenRef = useRef(0)

  // ─── Compute pixel diff stats ──────────────────────────────────────────────
  // Reuse the computation logic from ComparisonSlider for the pixel diff percentage.
  const computeDiff = useCallback(() => {
    const origUrl = originalImage?.dataUrl
    const procUrl = processedImage?.dataUrl

    if (!origUrl || !procUrl) {
      setDiffStats(null)
      return
    }

    const token = ++diffTokenRef.current
    setDiffLoading(true)

    void (async () => {
      try {
        const [origImg, procImg] = await Promise.all([
          loadImage(origUrl),
          loadImage(procUrl),
        ])

        const w = Math.min(origImg.naturalWidth, procImg.naturalWidth)
        const h = Math.min(origImg.naturalHeight, procImg.naturalHeight)

        if (w <= 0 || h <= 0) {
          if (token === diffTokenRef.current) {
            setDiffStats(null)
            setDiffLoading(false)
          }
          return
        }

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

        if (token === diffTokenRef.current) {
          setDiffStats({ changedPixels, totalPixels, diffPercentage })
        }
      } catch (err) {
        console.error('Pixel diff computation failed:', err)
        if (token === diffTokenRef.current) {
          setDiffStats(null)
        }
      } finally {
        if (token === diffTokenRef.current) {
          setDiffLoading(false)
        }
      }
    })()
  }, [originalImage?.dataUrl, processedImage?.dataUrl])

  useEffect(() => {
    computeDiff()
  }, [computeDiff])

  // ─── Derived values ────────────────────────────────────────────────────────

  if (!originalImage || !processedImage) return null

  const origSize = originalImage.size
  const procSize = processedImage.size
  const sizeReductionPct = origSize > 0
    ? Math.round(((origSize - procSize) / origSize) * 100)
    : 0
  const sizeIncrease = procSize > origSize
  const effectiveReduction = sizeIncrease
    ? Math.round(((procSize - origSize) / origSize) * 100)
    : sizeReductionPct

  const origW = originalImage.width
  const origH = originalImage.height
  const procW = processedImage.width
  const procH = processedImage.height
  const dimUnchanged = origW === procW && origH === procH

  const origFormat = formatType(originalImage.type)
  // ProcessedImage doesn't have a `type` field, so infer from data URL
  const procFormat = inferFormatFromDataUrl(processedImage.dataUrl)

  const sizeIndicator = getSizeReductionColor(sizeReductionPct)

  return (
    <div className="sidebar-panel flex flex-col gap-3 rounded-xl p-3.5 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border">
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="sidebar-panel-header flex items-center justify-between w-full text-left"
        aria-expanded={isOpen}
        aria-label="Toggle image information panel"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
            <GitCompareArrows className="size-3.5" />
          </div>
          <span className="text-xs font-bold text-foreground">Image Info</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {/* ── Before section ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2.5">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Before</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[10px] pl-1">
                <span className="text-muted-foreground font-medium">Dimensions</span>
                <span className="text-foreground/80 tabular-nums font-semibold">{origW} × {origH}</span>

                <span className="text-muted-foreground font-medium">Size</span>
                <span className="text-foreground/80 tabular-nums font-semibold">{formatFileSize(origSize)}</span>

                <span className="text-muted-foreground font-medium">Format</span>
                <span className="text-foreground/80 font-semibold">{origFormat}</span>

                {originalImage.originalName && (
                  <>
                    <span className="text-muted-foreground font-medium">Filename</span>
                    <span className="text-foreground/80 truncate max-w-[140px]" title={originalImage.originalName}>{originalImage.originalName}</span>
                  </>
                )}
              </div>
            </div>

            {/* ── After section ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 rounded-lg bg-primary/5 p-2.5 ring-1 ring-primary/10">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">After</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[10px] pl-1">
                <span className="text-muted-foreground font-medium">Dimensions</span>
                <span className="text-foreground tabular-nums font-semibold">{procW} × {procH}</span>

                <span className="text-muted-foreground font-medium">Size</span>
                <span className="text-foreground tabular-nums font-semibold">{formatFileSize(procSize)}</span>

                <span className="text-muted-foreground font-medium">Format</span>
                <span className="text-foreground font-semibold">{procFormat}</span>

                {/* Detection confidence — only present when autoDetect ran. */}
                {typeof processedImage.detectionConfidence === 'number'
                  && processedImage.detectionConfidence > 0 && (
                  <>
                    <span className="text-muted-foreground font-medium">Detection confidence</span>
                    <span className={`tabular-nums font-semibold ${getDetectionConfidenceTextColor(processedImage.detectionConfidence)}`}>
                      {processedImage.detectionConfidence}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ── Comparison section ─────────────────────────────────────── */}
            <div className="flex flex-col gap-2.5 border-t border-border/50 pt-3">
              <div className="flex items-center gap-1.5">
                <GitCompareArrows className="size-3 text-primary" />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Comparison</span>
              </div>

              {/* Size comparison */}
              <div className="flex flex-col gap-2 pl-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-muted-foreground">Size</span>
                  <span className={`font-bold tabular-nums ${sizeIncrease ? 'text-red-500' : sizeIndicator.className}`}>
                    {formatFileSize(origSize)} → {formatFileSize(procSize)}
                    {sizeIncrease
                      ? ` (↑ ${effectiveReduction}%)`
                      : sizeReductionPct > 0
                        ? ` (↓ ${sizeReductionPct}%)`
                        : ' (unchanged)'
                    }
                  </span>
                </div>

                {/* Visual progress bar for size reduction */}
                <div className="relative h-2 w-full rounded-full bg-muted/40 overflow-hidden ring-1 ring-border/30">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${sizeIndicator.barColor}`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.max(0, sizeReductionPct)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground font-medium">0%</span>
                  <span className={`${sizeIndicator.className} font-bold`}>
                    {sizeIndicator.label}
                  </span>
                  <span className="text-muted-foreground font-medium">100%</span>
                </div>
              </div>

              {/* Dimensions comparison */}
              <div className="flex items-center justify-between text-[10px] pl-1">
                <span className="font-semibold text-muted-foreground">Dimensions</span>
                <span className="font-bold tabular-nums text-foreground">
                  {dimUnchanged
                    ? `${origW}×${origH} → ${procW}×${procH} (unchanged)`
                    : `${origW}×${origH} → ${procW}×${procH} (${
                        origW !== procW
                          ? `↓ ${Math.round(((origW - procW) / origW) * 100)}%×`
                          : ''
                      }${
                        origH !== procH
                          ? `↓ ${Math.round(((origH - procH) / origH) * 100)}%`
                          : origW === procW ? '' : ''
                      })`
                  }
                </span>
              </div>

              {/* Pixel diff stats */}
              <div className="flex items-center justify-between text-[10px] pl-1">
                <span className="font-semibold text-muted-foreground">Pixels modified</span>
                <span className="font-bold tabular-nums text-foreground">
                  {diffLoading
                    ? 'Computing...'
                    : diffStats
                      ? `${diffStats.diffPercentage}% (${formatPixelCount(diffStats.changedPixels)} changed)`
                      : 'Unavailable'
                  }
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

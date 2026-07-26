'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Loader2, Minimize2, Copy, Check, ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatBytesSpaced(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Convert a dataUrl string into a File so we can POST it as FormData. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/data:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new File([u8arr], filename, { type: mime })
}

export default function DownloadPanel() {
  const { processedImage, originalImage, outputFileName, setOutputFileName, qualityConfig } = useAppStore()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null)
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null)
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Estimated output size — fetched from /api/estimate-size so the user
  // sees what the download will weigh BEFORE clicking Optimize/Download.
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const estimateCacheRef = useRef<Map<string, number>>(new Map())
  const estimateTokenRef = useRef(0)

  const handleDownload = useCallback(() => {
    const dataUrl = optimizedDataUrl || processedImage?.dataUrl
    if (!dataUrl) return

    const format = qualityConfig.format
    const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${outputFileName || 'processed'}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [optimizedDataUrl, processedImage, outputFileName, qualityConfig.format])

  const handleCopyToClipboard = useCallback(async () => {
    const dataUrl = optimizedDataUrl || processedImage?.dataUrl
    if (!dataUrl) return

    try {
      // Convert dataUrl to blob for clipboard
      const blob = await fetch(dataUrl).then(r => r.blob())
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: just copy the dataUrl string
      try {
        await navigator.clipboard.writeText(dataUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        console.error('Copy failed')
      }
    }
  }, [optimizedDataUrl, processedImage])

  const handleOptimize = useCallback(async () => {
    if (!originalImage) return

    setIsOptimizing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('format', qualityConfig.format)
      formData.append('quality', String(qualityConfig.quality))
      formData.append('maxWidth', String(qualityConfig.maxWidth))
      formData.append('maxHeight', String(qualityConfig.maxHeight))

      const res = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setOptimizedDataUrl(data.result.dataUrl)
        setOptimizedSize(data.result.optimizedSize)
        setCompressionRatio(data.result.compressionRatio)
      }
    } catch (err) {
      console.error('Optimization failed:', err)
    } finally {
      setIsOptimizing(false)
    }
  }, [originalImage, qualityConfig])

  // Fetch estimated size whenever the processed image or quality config
  // changes (debounced 500ms). Skipped when an optimized version already
  // exists — in that case we know the real size, no need to estimate.
  useEffect(() => {
    if (!processedImage?.dataUrl || optimizedSize !== null) {
      setEstimatedSize(null)
      return
    }

    const estimateKey = `${qualityConfig.format}-${qualityConfig.quality}-${qualityConfig.maxWidth}-${qualityConfig.maxHeight}`

    // Cache hit → instant display.
    const cached = estimateCacheRef.current.get(estimateKey)
    if (cached !== undefined) {
      setEstimatedSize(cached)
      return
    }

    const token = ++estimateTokenRef.current
    setIsEstimating(true)

    const t = setTimeout(async () => {
      try {
        const file = dataUrlToFile(processedImage.dataUrl, originalImage?.name ?? 'image.png')
        const formData = new FormData()
        formData.append('image', file)
        formData.append('format', qualityConfig.format)
        formData.append('quality', String(qualityConfig.quality))
        formData.append('maxWidth', String(qualityConfig.maxWidth))
        formData.append('maxHeight', String(qualityConfig.maxHeight))

        const res = await fetch('/api/estimate-size', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (token !== estimateTokenRef.current) return

        if (data.success) {
          estimateCacheRef.current.set(estimateKey, data.estimatedSize as number)
          setEstimatedSize(data.estimatedSize as number)
        }
      } catch (err) {
        console.error('Estimate failed:', err)
      } finally {
        if (token === estimateTokenRef.current) {
          setIsEstimating(false)
        }
      }
    }, 500)

    return () => clearTimeout(t)
  }, [
    processedImage?.dataUrl,
    optimizedSize,
    qualityConfig.format,
    qualityConfig.quality,
    qualityConfig.maxWidth,
    qualityConfig.maxHeight,
    originalImage?.name,
  ])

  // When the source image changes, invalidate the cache.
  useEffect(() => {
    estimateCacheRef.current.clear()
    setEstimatedSize(null)
  }, [processedImage?.dataUrl])

  if (!processedImage) return null

  // Badge size logic:
  //  - After Optimize clicked → show actual optimized size.
  //  - Otherwise → show estimated size (if known), else fall back to raw size.
  const badgeSize =
    optimizedSize ??
    estimatedSize ??
    processedImage.size
  const badgeIsEstimate = optimizedSize === null && estimatedSize !== null

  // Comparison info row — only after optimization has actually been applied.
  // Shows: Original: 29KB → Optimized: 12KB (↓ 59%)
  const showComparisonRow = optimizedSize !== null && compressionRatio !== null
  const comparisonPct = compressionRatio ? Number(compressionRatio) : 0
  const comparisonDirection: 'down' | 'up' = comparisonPct >= 0 ? 'down' : 'up'
  const comparisonAbsPct = Math.abs(comparisonPct)
  const originalSizeForComparison = processedImage.size

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5"
    >
      {/* Filename */}
      <div className="flex items-center gap-2 rounded-lg border bg-card/80 p-2.5 shadow-sm">
        <FileText className="size-3.5 text-muted-foreground/60" />
        <Input
          value={outputFileName}
          onChange={(e) => setOutputFileName(e.target.value)}
          className="h-6 text-xs flex-1"
          placeholder="File name"
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="gap-1.5 h-7 text-xs rounded-lg"
        >
          {isOptimizing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Minimize2 className="size-3" />
          )}
          {isOptimizing ? 'Optimizing' : 'Optimize'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyToClipboard}
          className="gap-1.5 h-7 text-xs rounded-lg"
        >
          {copied ? (
            <Check className="size-3 text-green-500" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Comparison info row — only shown after optimization is applied */}
      {showComparisonRow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-[10px]"
        >
          <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground/70">
            <span>
              <span className="text-muted-foreground/50">Original: </span>
              <span className="font-medium text-foreground">{formatBytesSpaced(originalSizeForComparison)}</span>
            </span>
            <span className="text-muted-foreground/40">→</span>
            <span>
              <span className="text-muted-foreground/50">Optimized: </span>
              <span className="font-medium text-foreground">{formatBytesSpaced(optimizedSize ?? 0)}</span>
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium ${
              comparisonDirection === 'down'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {comparisonDirection === 'down' ? (
              <ArrowDown className="size-2.5" />
            ) : (
              <ArrowUp className="size-2.5" />
            )}
            {comparisonAbsPct}%
          </span>
        </motion.div>
      )}

      {/* Pre-optimization hint row — shows estimate is calculating */}
      {!showComparisonRow && (isEstimating || badgeIsEstimate) && (
        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/50">
          {isEstimating ? (
            <>
              <Loader2 className="size-2.5 animate-spin" />
              <span>Estimating output size...</span>
            </>
          ) : (
            <span>Estimated download size</span>
          )}
        </div>
      )}

      {/* Download button */}
      <Button
        size="default"
        onClick={handleDownload}
        className="cta-button w-full gap-1.5 rounded-lg font-semibold h-11 text-sm shadow-md hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/20 transition-all"
      >
        <Download className="size-4" />
        Download
        <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground/90">
          {isEstimating && !badgeIsEstimate && optimizedSize === null ? (
            <Loader2 className="size-2.5 animate-spin" />
          ) : null}
          {badgeIsEstimate ? '~' : ''}
          {formatBytes(badgeSize)}
        </span>
      </Button>
    </motion.div>
  )
}

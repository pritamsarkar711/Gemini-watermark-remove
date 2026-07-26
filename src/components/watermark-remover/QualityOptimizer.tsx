'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings2, Loader2, ArrowDown, ArrowUp } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import type { QualityConfig } from '@/lib/store'

const presets: { label: string; config: QualityConfig }[] = [
  { label: 'Original', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
  { label: 'Web', config: { format: 'webp', quality: 80, maxWidth: 1920, maxHeight: 1080 } },
  { label: 'Print', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
  { label: 'Social', config: { format: 'jpeg', quality: 85, maxWidth: 1200, maxHeight: 1200 } },
]

function isPresetActive(config: QualityConfig, preset: QualityConfig): boolean {
  return (
    config.format === preset.format &&
    config.quality === preset.quality &&
    config.maxWidth === preset.maxWidth &&
    config.maxHeight === preset.maxHeight
  )
}

function formatBytes(bytes: number): string {
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

interface EstimateResult {
  estimatedSize: number
  format: string
  width: number
  height: number
}

export default function QualityOptimizer() {
  const { qualityConfig, setQualityConfig, originalImage, processedImage } = useAppStore()

  // Pick the image we should base the estimate on. Prefer the processed
  // result (so the estimate reflects what the user will actually download),
  // but fall back to the original upload when nothing has been processed yet.
  const sourceDataUrl = processedImage?.dataUrl ?? originalImage?.dataUrl ?? null
  const sourceFileName = originalImage?.name ?? 'image.png'
  // The original-size baseline is used for the savings comparison. When a
  // processed image exists, compare against its size; otherwise compare
  // against the uploaded file's size.
  const baselineSize = processedImage?.size ?? originalImage?.size ?? 0

  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Per-config cache so switching presets or tabbing away and back doesn't
  // refetch an estimate we already computed.
  const cacheRef = useRef<Map<string, EstimateResult>>(new Map())
  // Token so we can ignore stale responses if the user changes config mid-flight.
  const requestTokenRef = useRef(0)

  const estimateKey = `${qualityConfig.format}-${qualityConfig.quality}-${qualityConfig.maxWidth}-${qualityConfig.maxHeight}`

  const fetchEstimate = useCallback(async () => {
    if (!sourceDataUrl) {
      setEstimate(null)
      return
    }

    // Serve from cache when possible — makes preset switching instant.
    const cached = cacheRef.current.get(estimateKey)
    if (cached) {
      setEstimate(cached)
      return
    }

    const token = ++requestTokenRef.current
    setIsLoading(true)

    try {
      // Convert the dataUrl to a File only when we actually need to send it.
      const file = dataUrlToFile(sourceDataUrl, sourceFileName)

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

      // Ignore the response if a newer request superseded us.
      if (token !== requestTokenRef.current) return

      if (data.success) {
        const result: EstimateResult = {
          estimatedSize: data.estimatedSize,
          format: data.format,
          width: data.width,
          height: data.height,
        }
        cacheRef.current.set(estimateKey, result)
        setEstimate(result)
      }
    } catch (err) {
      console.error('Estimate failed:', err)
    } finally {
      if (token === requestTokenRef.current) {
        setIsLoading(false)
      }
    }
  }, [sourceDataUrl, sourceFileName, estimateKey, qualityConfig])

  // Debounce 500ms after any qualityConfig change, then fetch.
  useEffect(() => {
    if (!sourceDataUrl) {
      setEstimate(null)
      return
    }

    // If we already have a cached value for this key, show it immediately.
    const cached = cacheRef.current.get(estimateKey)
    if (cached) {
      setEstimate(cached)
      return
    }

    setIsLoading(true)
    const t = setTimeout(() => {
      void fetchEstimate()
    }, 500)
    return () => clearTimeout(t)
  }, [estimateKey, sourceDataUrl, fetchEstimate])

  // When the source image itself changes, invalidate the cache because the
  // underlying pixels are different even if the quality config is the same.
  useEffect(() => {
    cacheRef.current.clear()
    setEstimate(null)
  }, [sourceDataUrl])

  // Compute savings percentage vs. the baseline (original or processed).
  let savingsPct: number | null = null
  let savingsDirection: 'down' | 'up' | null = null
  if (estimate && baselineSize > 0) {
    const diff = (estimate.estimatedSize - baselineSize) / baselineSize
    savingsPct = Math.round(Math.abs(diff) * 100)
    savingsDirection = diff <= 0 ? 'down' : 'up'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      <div className="flex items-center gap-1.5">
        <Settings2 className="size-3.5 text-muted-foreground/60" />
        <Label className="text-xs font-semibold">Export quality</Label>
      </div>

      <div className="flex items-center gap-1">
        {presets.map((preset) => {
          const active = isPresetActive(qualityConfig, preset.config)
          return (
            <button
              key={preset.label}
              onClick={() => setQualityConfig(preset.config)}
              className={`h-6 text-[10px] rounded-md px-2 border transition-colors ${
                active
                  ? 'bg-primary/10 border-primary/30 text-primary font-medium ring-1 ring-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:bg-accent border-transparent'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Format</span>
        <Select
          value={qualityConfig.format}
          onValueChange={(v) => setQualityConfig({ format: v as 'jpeg' | 'png' | 'webp' })}
        >
          <SelectTrigger className="w-[3.5rem] h-6 text-[10px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG</SelectItem>
            <SelectItem value="jpeg">JPEG</SelectItem>
            <SelectItem value="webp">WebP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {qualityConfig.format !== 'png' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground/50 font-medium">Quality</span>
          <Slider
            value={[qualityConfig.quality]}
            min={10}
            max={100}
            step={1}
            onValueChange={(v) => setQualityConfig({ quality: v[0] })}
            className="w-20"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 text-right">{qualityConfig.quality}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Max width</span>
        <Input
          type="number"
          value={qualityConfig.maxWidth}
          onChange={(e) => setQualityConfig({ maxWidth: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Max height</span>
        <Input
          type="number"
          value={qualityConfig.maxHeight}
          onChange={(e) => setQualityConfig({ maxHeight: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg"
        />
      </div>

      {/* Estimated output size row */}
      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-[10px]">
        <span className="font-medium text-muted-foreground/70">Estimated size</span>

        <div className="flex items-center gap-1.5 tabular-nums">
          {isLoading && !estimate ? (
            <>
              <Loader2 className="size-3 animate-spin text-muted-foreground/60" />
              <span className="text-muted-foreground/60">Calculating...</span>
            </>
          ) : estimate ? (
            <>
              <span className="font-semibold text-foreground">
                {formatBytes(estimate.estimatedSize)}
              </span>
              {savingsDirection && savingsPct !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium ${
                    savingsDirection === 'down'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {savingsDirection === 'down' ? (
                    <ArrowDown className="size-2.5" />
                  ) : (
                    <ArrowUp className="size-2.5" />
                  )}
                  {savingsPct}%
                </span>
              )}
            </>
          ) : !sourceDataUrl ? (
            <span className="text-muted-foreground/40">Upload an image</span>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin text-muted-foreground/60" />
              <span className="text-muted-foreground/60">Calculating...</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

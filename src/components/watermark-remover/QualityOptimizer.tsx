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
  { label: 'Thumbnail', config: { format: 'jpeg', quality: 70, maxWidth: 150, maxHeight: 150 } },
  { label: 'Social', config: { format: 'jpeg', quality: 85, maxWidth: 1200, maxHeight: 1200 } },
  { label: 'HD', config: { format: 'webp', quality: 90, maxWidth: 1920, maxHeight: 1080 } },
  { label: 'Web', config: { format: 'webp', quality: 80, maxWidth: 1920, maxHeight: 1080 } },
  { label: 'Print', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
  { label: 'Original', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
]

const formatDescriptions: Record<string, string> = {
  png: 'Lossless, larger files',
  jpeg: 'Lossy, smaller files',
  webp: 'Modern, best balance',
  avif: 'Next-gen, smallest',
}

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

/** Get size reduction indicator using primary color classes */
function getSizeReductionIndicator(reductionPct: number): { label: string; className: string; barClass: string } {
  if (reductionPct >= 50) return { label: 'Excellent', className: 'text-primary', barClass: 'bg-primary' }
  if (reductionPct >= 25) return { label: 'Good', className: 'text-primary/70', barClass: 'bg-primary/70' }
  if (reductionPct > 0) return { label: 'Minor', className: 'text-primary/50', barClass: 'bg-primary/50' }
  return { label: 'No reduction', className: 'text-muted-foreground', barClass: 'bg-muted-foreground/30' }
}

export default function QualityOptimizer() {
  const { qualityConfig, setQualityConfig, originalImage, processedImage } = useAppStore()

  const sourceDataUrl = processedImage?.dataUrl ?? originalImage?.dataUrl ?? null
  const sourceFileName = originalImage?.name ?? 'image.png'
  const baselineSize = processedImage?.size ?? originalImage?.size ?? 0

  const [estimate, setEstimate] = useState<EstimateResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef<Map<string, EstimateResult>>(new Map())
  const requestTokenRef = useRef(0)

  const estimateKey = `${qualityConfig.format}-${qualityConfig.quality}-${qualityConfig.maxWidth}-${qualityConfig.maxHeight}`

  const fetchEstimate = useCallback(async () => {
    if (!sourceDataUrl) {
      setEstimate(null)
      return
    }

    const cached = cacheRef.current.get(estimateKey)
    if (cached) {
      setEstimate(cached)
      return
    }

    const token = ++requestTokenRef.current
    setIsLoading(true)

    try {
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

  // Debounce 500ms after any qualityConfig change
  useEffect(() => {
    if (!sourceDataUrl) {
      setEstimate(null)
      return
    }

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

  // Invalidate cache when source image changes
  useEffect(() => {
    cacheRef.current.clear()
    setEstimate(null)
  }, [sourceDataUrl])

  // Compute savings
  let savingsPct: number | null = null
  let savingsDirection: 'down' | 'up' | null = null
  if (estimate && baselineSize > 0) {
    const diff = (estimate.estimatedSize - baselineSize) / baselineSize
    savingsPct = Math.round(Math.abs(diff) * 100)
    savingsDirection = diff <= 0 ? 'down' : 'up'
  }

  const compressionRatio = savingsDirection === 'down' && savingsPct !== null
    ? savingsPct
    : 0

  // Quality percentage (10-100 range mapped to 0-100%)
  const qualityPercent = ((qualityConfig.quality - 10) / 90) * 100
  const showQualitySlider = qualityConfig.format !== 'png'

  const sizeIndicator = estimate && savingsDirection === 'down' && savingsPct !== null
    ? getSizeReductionIndicator(savingsPct)
    : { label: '', className: '', barClass: '' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-4 shadow-sm"
    >
      <div className="flex items-center gap-1.5">
        <Settings2 className="size-3.5 text-primary/60" />
        <Label className="text-xs font-semibold text-foreground">Export Quality</Label>
      </div>

      {/* Preset chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((preset) => {
          const active = isPresetActive(qualityConfig, preset.config)
          return (
            <button
              key={preset.label}
              onClick={() => setQualityConfig(preset.config)}
              className={`h-7 text-xs rounded-md px-2.5 border transition-colors ${
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

      {/* Format selector */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/50 font-medium">Format</span>
        <div className="flex flex-col items-end gap-0.5">
          <Select
            value={qualityConfig.format}
            onValueChange={(v) => setQualityConfig({ format: v as QualityConfig['format'] })}
          >
            <SelectTrigger className="w-[6rem] h-7 text-xs rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="avif">AVIF</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground/40 italic">
            {formatDescriptions[qualityConfig.format]}
          </span>
        </div>
      </div>

      {/* Quality slider */}
      {showQualitySlider && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground/50 font-medium">Quality</span>
            <Slider
              value={[qualityConfig.quality]}
              min={10}
              max={100}
              step={1}
              onValueChange={(v) => setQualityConfig({ quality: v[0] })}
              className="w-24"
            />
            <span className="text-xs tabular-nums text-muted-foreground/50 w-5 text-right">{qualityConfig.quality}</span>
          </div>
          {/* Visual quality bar — primary color gradient */}
          <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-muted/50">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${qualityPercent}%`,
                background: `linear-gradient(to right, color-mix(in oklch, var(--primary) 40%, transparent), color-mix(in oklch, var(--primary) 70%, transparent), var(--primary))`,
              }}
            />
          </div>
        </div>
      )}

      {/* Max dimensions */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/50 font-medium">Max width</span>
        <Input
          type="number"
          value={qualityConfig.maxWidth}
          onChange={(e) => setQualityConfig({ maxWidth: Number(e.target.value) || 4096 })}
          className="w-[4rem] h-7 text-xs px-1.5 rounded-md"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/50 font-medium">Max height</span>
        <Input
          type="number"
          value={qualityConfig.maxHeight}
          onChange={(e) => setQualityConfig({ maxHeight: Number(e.target.value) || 4096 })}
          className="w-[4rem] h-7 text-xs px-1.5 rounded-md"
        />
      </div>

      {/* Estimated output size row */}
      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
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
                      ? 'bg-primary/10 text-primary'
                      : 'bg-primary/10 text-primary/70'
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

      {/* Savings comparison row */}
      {estimate && baselineSize > 0 && savingsDirection === 'down' && savingsPct !== null && (
        <div className="flex flex-col gap-1.5 rounded-md bg-primary/5 border border-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-primary/80 font-medium">
              Savings vs original
            </span>
            <div className="flex items-center gap-1.5 tabular-nums">
              <span className="text-muted-foreground/60">{formatBytes(baselineSize)}</span>
              <ArrowDown className="size-2.5 text-primary" />
              <span className="font-semibold text-primary">
                {formatBytes(estimate.estimatedSize)}
              </span>
            </div>
          </div>
          {/* Compression ratio bar */}
          <div className="relative h-2 w-full rounded-full overflow-hidden bg-primary/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/40 transition-all duration-500"
              style={{ width: `${Math.min(compressionRatio, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expansion warning row */}
      {estimate && baselineSize > 0 && savingsDirection === 'up' && savingsPct !== null && (
        <div className="flex flex-col gap-1.5 rounded-md bg-primary/5 border border-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-primary/80 font-medium">
              Larger than original
            </span>
            <div className="flex items-center gap-1.5 tabular-nums">
              <span className="text-muted-foreground/60">{formatBytes(baselineSize)}</span>
              <ArrowUp className="size-2.5 text-primary" />
              <span className="font-semibold text-primary">
                {formatBytes(estimate.estimatedSize)}
              </span>
            </div>
          </div>
          {/* Expansion ratio bar */}
          <div className="relative h-2 w-full rounded-full overflow-hidden bg-primary/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary/40 transition-all duration-500"
              style={{ width: `${Math.min(savingsPct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

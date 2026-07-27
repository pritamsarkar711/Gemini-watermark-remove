'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crop, Loader2, RotateCcw, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

type CropRatio = {
  label: string
  ratio: number | null // null = free
}

const CROP_RATIOS: CropRatio[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '3:4', ratio: 3 / 4 },
]

export default function CropPanel() {
  const {
    originalImage,
    setOriginalImage,
    setIsProcessing,
    cropRect,
    setCropRect,
    isCropOverlayActive,
    setCropOverlayActive,
  } = useAppStore()
  const [isCropping, setIsCropping] = useState(false)
  const [isOpen, setIsOpen] = useState(false) // Start collapsed to reduce sidebar crowding
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null) // null = Free (UI-only)

  // Initialize crop rect when image changes (keeps isCropOverlayActive as-is —
  // never auto-enables the overlay, per task requirements).
  useEffect(() => {
    if (!originalImage) return

    setCropRect({
      x: 0,
      y: 0,
      width: originalImage.width,
      height: originalImage.height,
    })

    const resetTimer = setTimeout(() => setSelectedRatio(null), 0)
    return () => clearTimeout(resetTimer)
  }, [originalImage, setCropRect])

  // When the panel opens, default the overlay to ON. When it closes, turn the
  // overlay OFF (so the image isn't cluttered when the user is done cropping).
  const handleToggleOpen = useCallback(() => {
    setIsOpen((v) => {
      const next = !v
      // When opening, show the overlay; when closing, hide it.
      setCropOverlayActive(next)
      return next
    })
  }, [setCropOverlayActive])

  const handleRatioChange = useCallback(
    (ratio: number | null) => {
      if (!originalImage) return
      setSelectedRatio(ratio)

      if (ratio === null) return // Free - no constraint

      const imgW = originalImage.width
      const imgH = originalImage.height

      // Calculate the largest crop rectangle that fits the ratio within the image
      let newW: number
      let newH: number

      if (ratio >= 1) {
        // Landscape or square ratio
        newW = imgW
        newH = Math.round(imgW / ratio)
        if (newH > imgH) {
          newH = imgH
          newW = Math.round(imgH * ratio)
        }
      } else {
        // Portrait ratio
        newH = imgH
        newW = Math.round(imgH * ratio)
        if (newW > imgW) {
          newW = imgW
          newH = Math.round(imgW / ratio)
        }
      }

      // Center the crop rectangle
      const newX = Math.round((imgW - newW) / 2)
      const newY = Math.round((imgH - newH) / 2)

      setCropRect({ x: newX, y: newY, width: newW, height: newH })
    },
    [originalImage, setCropRect]
  )

  const updateCropField = useCallback(
    (field: keyof CropRect, value: number) => {
      if (!originalImage) return

      const imgW = originalImage.width
      const imgH = originalImage.height

      // Compute next rect from the current store value
      const prev = cropRect
      let next: CropRect = { ...prev, [field]: Math.max(0, Math.round(value)) }

      // Clamp x and y
      if (field === 'x') {
        next.x = Math.min(next.x, imgW - 1)
      }
      if (field === 'y') {
        next.y = Math.min(next.y, imgH - 1)
      }

      // Clamp width and height
      if (field === 'width') {
        next.width = Math.max(1, Math.min(next.width, imgW - next.x))
      }
      if (field === 'height') {
        next.height = Math.max(1, Math.min(next.height, imgH - next.y))
      }

      // If a ratio is locked, adjust the other dimension
      if (selectedRatio !== null) {
        if (field === 'width') {
          next.height = Math.max(
            1,
            Math.min(Math.round(next.width / selectedRatio), imgH - next.y)
          )
          next.width = Math.round(next.height * selectedRatio)
        } else if (field === 'height') {
          next.width = Math.max(
            1,
            Math.min(Math.round(next.height * selectedRatio), imgW - next.x)
          )
          next.height = Math.round(next.width / selectedRatio)
        }
        // If x or y changed, keep the ratio by adjusting width/height
        if (field === 'x' || field === 'y') {
          const maxW = imgW - next.x
          const maxH = imgH - next.y
          let w = next.width
          let h = next.height
          if (w / h > selectedRatio) {
            w = Math.round(h * selectedRatio)
          } else {
            h = Math.round(w / selectedRatio)
          }
          if (w > maxW) {
            w = maxW
            h = Math.round(w / selectedRatio)
          }
          if (h > maxH) {
            h = maxH
            w = Math.round(h * selectedRatio)
          }
          next.width = Math.max(1, w)
          next.height = Math.max(1, h)
        }
      }

      setCropRect(next)
    },
    [originalImage, selectedRatio, cropRect, setCropRect]
  )

  const handleApply = useCallback(async () => {
    if (!originalImage) return

    setIsCropping(true)
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('x', String(cropRect.x))
      formData.append('y', String(cropRect.y))
      formData.append('width', String(cropRect.width))
      formData.append('height', String(cropRect.height))

      const res = await fetch('/api/crop', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        const resultDataUrl = data.result.dataUrl
        const resultBlob = await fetch(resultDataUrl).then((r) => r.blob())
        const resultFile = new File([resultBlob], originalImage.name, {
          type: 'image/png',
        })

        const newImageInfo = {
          ...originalImage,
          file: resultFile,
          width: data.result.width,
          height: data.result.height,
          size: data.result.size,
          dataUrl: resultDataUrl,
        }
        setOriginalImage(newImageInfo, 'transform')
        toast({ title: 'Crop applied', description: 'Image has been cropped successfully.' })
      }
    } catch (err) {
      console.error('Crop failed:', err)
      toast({ title: 'Crop failed', description: 'Could not crop image.', variant: 'destructive' })
    } finally {
      setIsCropping(false)
      setIsProcessing(false)
    }
  }, [originalImage, cropRect, setOriginalImage, setIsProcessing])

  const handleReset = useCallback(() => {
    if (!originalImage) return
    setCropRect({
      x: 0,
      y: 0,
      width: originalImage.width,
      height: originalImage.height,
    })
    setSelectedRatio(null)
  }, [originalImage, setCropRect])

  // Check if crop is different from full image
  const hasCrop =
    originalImage &&
    (cropRect.x !== 0 ||
      cropRect.y !== 0 ||
      cropRect.width !== originalImage.width ||
      cropRect.height !== originalImage.height)

  if (!originalImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/80 p-3 sm:p-4 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md max-w-full overflow-hidden"
    >
      {/* Header (clickable toggle) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleOpen() } }}
        className="sidebar-panel-header flex items-center justify-between cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Crop className="size-3.5" />
          </span>
          <span className="text-sm font-bold text-foreground">Crop</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Show overlay toggle (only meaningful when panel is open) */}
          {isOpen && (
            <div
              role="group"
              aria-label="Toggle crop overlay"
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCropOverlayActive(!isCropOverlayActive)
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                aria-label={isCropOverlayActive ? 'Hide overlay' : 'Show overlay'}
              >
                {isCropOverlayActive ? (
                  <Eye className="size-2.5" />
                ) : (
                  <EyeOff className="size-2.5" />
                )}
                <span className="hidden sm:inline">Overlay</span>
              </button>
              <Switch
                checked={isCropOverlayActive}
                onCheckedChange={(checked) => setCropOverlayActive(checked)}
                onClick={(e) => e.stopPropagation()}
                className="scale-75 origin-center"
                aria-label="Show crop overlay on image"
              />
            </div>
          )}
          {hasCrop && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleReset() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Space') { e.stopPropagation(); handleReset() } }}
              className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-2.5" />
              Reset
            </button>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground/50"
          >
            <ChevronDown className="size-3.5" />
          </motion.div>
        </div>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-2">
              {/* Ratio presets */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/25 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">Aspect ratio</span>
                  <span className="text-[11px] font-medium text-muted-foreground">Choose a crop frame</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CROP_RATIOS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleRatioChange(r.ratio)}
                      className={`min-h-9 w-full rounded-lg border px-2 text-xs font-bold transition-all ${
                        selectedRatio === r.ratio
                          ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'border-border/60 bg-card text-foreground/75 hover:border-primary/35 hover:bg-primary/5 hover:text-foreground'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numeric inputs */}
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">Crop bounds</span>
                  <span className="text-[11px] font-medium text-muted-foreground">Pixels</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['x', 'X', 0, originalImage.width - 1],
                    ['y', 'Y', 0, originalImage.height - 1],
                    ['width', 'Width', 1, originalImage.width],
                    ['height', 'Height', 1, originalImage.height],
                  ] as const).map(([field, label, min, max]) => (
                    <label key={field} className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={cropRect[field]}
                        onChange={(e) => updateCropField(field, parseInt(e.target.value) || min)}
                        className="h-9 w-full rounded-lg border border-border/70 bg-card px-2 text-sm font-semibold tabular-nums text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview dimensions */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2 text-xs tabular-nums">
                <span className="font-semibold text-muted-foreground">Output size</span>
                <span className="font-bold text-foreground">
                  {originalImage.width}×{originalImage.height}
                  <span className="px-1.5 text-muted-foreground">→</span>
                  <span className={hasCrop ? 'text-primary' : 'text-foreground'}>
                    {cropRect.width}×{cropRect.height}
                  </span>
                </span>
              </div>

              {/* Apply button */}
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isCropping || !hasCrop}
                className="w-full gap-1.5 rounded-lg h-9 text-xs font-bold shadow-sm hover:shadow-md hover:shadow-primary/20 transition-all"
              >
                {isCropping ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Cropping
                  </>
                ) : (
                  <>
                    <Crop className="size-3" />
                    Apply crop
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

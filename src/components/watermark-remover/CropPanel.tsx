'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crop, Loader2, RotateCcw, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

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
  const { originalImage, setOriginalImage, setIsProcessing } = useAppStore()
  const [isCropping, setIsCropping] = useState(false)
  const [isOpen, setIsOpen] = useState(false) // Start collapsed to reduce sidebar crowding
  const [selectedRatio, setSelectedRatio] = useState<number | null>(null) // null = Free
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })

  // Initialize crop rect when image changes
  useEffect(() => {
    if (originalImage) {
      setCropRect({
        x: 0,
        y: 0,
        width: originalImage.width,
        height: originalImage.height,
      })
      setSelectedRatio(null)
    }
  }, [originalImage])

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
    [originalImage]
  )

  const updateCropField = useCallback(
    (field: keyof CropRect, value: number) => {
      if (!originalImage) return

      const imgW = originalImage.width
      const imgH = originalImage.height

      setCropRect((prev) => {
        let next = { ...prev, [field]: Math.max(0, Math.round(value)) }

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

        return next
      })
    },
    [originalImage, selectedRatio]
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
      }
    } catch (err) {
      console.error('Crop failed:', err)
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
  }, [originalImage])

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
      className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      {/* Header (clickable toggle) */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center justify-between cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Crop className="size-3.5 text-muted-foreground/60" />
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Crop</span>
        </div>
        <div className="flex items-center gap-2">
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
      </button>

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
            <div className="flex flex-col gap-2.5 pt-1">
      {/* Ratio presets */}
      <div className="grid grid-cols-4 gap-1">
        {CROP_RATIOS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => handleRatioChange(r.ratio)}
            className={`size-7 rounded-md text-[9px] font-medium transition-all ${
              selectedRatio === r.ratio
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Numeric inputs */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-4 text-[10px] font-medium text-muted-foreground/60">
            X
          </span>
          <input
            type="number"
            min={0}
            max={originalImage.width - 1}
            value={cropRect.x}
            onChange={(e) => updateCropField('x', parseInt(e.target.value) || 0)}
            className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="w-4 text-[10px] font-medium text-muted-foreground/60">
            Y
          </span>
          <input
            type="number"
            min={0}
            max={originalImage.height - 1}
            value={cropRect.y}
            onChange={(e) => updateCropField('y', parseInt(e.target.value) || 0)}
            className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 text-[10px] font-medium text-muted-foreground/60">
            W
          </span>
          <input
            type="number"
            min={1}
            max={originalImage.width}
            value={cropRect.width}
            onChange={(e) => updateCropField('width', parseInt(e.target.value) || 1)}
            className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="w-4 text-[10px] font-medium text-muted-foreground/60">
            H
          </span>
          <input
            type="number"
            min={1}
            max={originalImage.height}
            value={cropRect.height}
            onChange={(e) => updateCropField('height', parseInt(e.target.value) || 1)}
            className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Preview dimensions */}
      <div className="text-[10px] text-muted-foreground/60 tabular-nums">
        {originalImage.width}x{originalImage.height} &rarr;{' '}
        <span className={hasCrop ? 'text-primary font-semibold' : ''}>
          {cropRect.width}x{cropRect.height}
        </span>
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isCropping || !hasCrop}
        className="w-full gap-1.5 rounded-lg h-8 text-xs font-medium shadow-sm"
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

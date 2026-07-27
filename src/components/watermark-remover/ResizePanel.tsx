'use client'

import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Loader2, RotateCcw, Lock, Unlock, ChevronDown, FileOutput } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore, type ResizeConfig } from '@/lib/store'
import { toast } from '@/hooks/use-toast'

type ResizeMode = ResizeConfig['mode']
type TargetFormat = ResizeConfig['targetFormat']

const RESIZE_MODES: { label: string; value: ResizeMode; desc: string }[] = [
  { label: 'Fit', value: 'fit', desc: 'Inside' },
  { label: 'Fill', value: 'fill', desc: 'Cover' },
  { label: 'Stretch', value: 'stretch', desc: 'Stretch' },
  { label: 'Exact', value: 'exact', desc: 'Exact' },
]

const FORMAT_OPTIONS: { label: string; value: TargetFormat; desc: string }[] = [
  { label: 'Same', value: 'same', desc: 'Keep original' },
  { label: 'PNG', value: 'png', desc: 'Lossless' },
  { label: 'JPEG', value: 'jpeg', desc: 'Compressed' },
  { label: 'WebP', value: 'webp', desc: 'Modern' },
  { label: 'AVIF', value: 'avif', desc: 'Next-gen' },
  { label: 'BMP', value: 'bmp', desc: 'Uncompressed' },
  { label: 'TIFF', value: 'tiff', desc: 'High quality' },
  { label: 'GIF', value: 'gif', desc: 'Animated' },
]

interface SizePreset {
  label: string
  width: number
  height: number
}

const SIZE_PRESETS: SizePreset[] = [
  { label: 'Original', width: 0, height: 0 },
  { label: '1920×1080', width: 1920, height: 1080 },
  { label: '1280×720', width: 1280, height: 720 },
  { label: '800×600', width: 800, height: 600 },
  { label: '640×480', width: 640, height: 480 },
  { label: '400×400', width: 400, height: 400 },
]

export default function ResizePanel() {
  const {
    originalImage,
    resizeConfig,
    setResizeConfig,
    setOriginalImage,
    setIsProcessing,
  } = useAppStore()

  const [isResizing, setIsResizing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Initialize resize dimensions when image changes
  useEffect(() => {
    if (originalImage) {
      if (resizeConfig.width === 0 || resizeConfig.height === 0) {
        setResizeConfig({
          width: originalImage.width,
          height: originalImage.height,
        })
      }
    }
  }, [originalImage, setResizeConfig, resizeConfig.width, resizeConfig.height])

  const handleWidthChange = useCallback(
    (value: number) => {
      if (!originalImage) return
      const newWidth = Math.max(16, Math.min(8192, Math.round(value)))

      if (resizeConfig.lockAspectRatio) {
        const aspectRatio = originalImage.width / originalImage.height
        const newHeight = Math.max(16, Math.min(8192, Math.round(newWidth / aspectRatio)))
        setResizeConfig({ width: newWidth, height: newHeight })
      } else {
        setResizeConfig({ width: newWidth })
      }
    },
    [originalImage, resizeConfig.lockAspectRatio, setResizeConfig]
  )

  const handleHeightChange = useCallback(
    (value: number) => {
      if (!originalImage) return
      const newHeight = Math.max(16, Math.min(8192, Math.round(value)))

      if (resizeConfig.lockAspectRatio) {
        const aspectRatio = originalImage.width / originalImage.height
        const newWidth = Math.max(16, Math.min(8192, Math.round(newHeight * aspectRatio)))
        setResizeConfig({ width: newWidth, height: newHeight })
      } else {
        setResizeConfig({ height: newHeight })
      }
    },
    [originalImage, resizeConfig.lockAspectRatio, setResizeConfig]
  )

  const handlePresetSelect = useCallback(
    (preset: SizePreset) => {
      if (!originalImage) return
      if (preset.width === 0 && preset.height === 0) {
        // Original size
        setResizeConfig({ width: originalImage.width, height: originalImage.height })
      } else if (resizeConfig.lockAspectRatio) {
        // Calculate dimensions that preserve aspect ratio within the preset bounds
        const aspectRatio = originalImage.width / originalImage.height
        let newWidth = preset.width
        let newHeight = Math.round(newWidth / aspectRatio)
        if (newHeight > preset.height) {
          newHeight = preset.height
          newWidth = Math.round(newHeight * aspectRatio)
        }
        setResizeConfig({ width: Math.max(16, newWidth), height: Math.max(16, newHeight) })
      } else {
        setResizeConfig({ width: preset.width, height: preset.height })
      }
    },
    [originalImage, resizeConfig.lockAspectRatio, setResizeConfig]
  )

  const handleApply = useCallback(async () => {
    if (!originalImage) return

    setIsResizing(true)
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('width', String(resizeConfig.width))
      formData.append('height', String(resizeConfig.height))
      formData.append('mode', resizeConfig.mode)
      if (resizeConfig.targetFormat !== 'same') {
        formData.append('format', resizeConfig.targetFormat)
      }

      const res = await fetch('/api/resize', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        const resultDataUrl = data.result.dataUrl
        const resultBlob = await fetch(resultDataUrl).then((r) => r.blob())
        const resultMimeType = data.result.format || 'image/png'
        const resultFile = new File([resultBlob], originalImage.name, {
          type: resultMimeType,
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
        toast({ title: 'Resize applied', description: 'Image has been resized successfully.' })
      }
    } catch (err) {
      console.error('Resize failed:', err)
      toast({ title: 'Resize failed', description: 'Could not resize image.', variant: 'destructive' })
    } finally {
      setIsResizing(false)
      setIsProcessing(false)
    }
  }, [originalImage, resizeConfig, setOriginalImage, setIsProcessing])

  const handleReset = useCallback(() => {
    if (!originalImage) return
    setResizeConfig({
      width: originalImage.width,
      height: originalImage.height,
      mode: 'fit',
      lockAspectRatio: true,
      targetFormat: 'same',
    })
  }, [originalImage, setResizeConfig])

  // Check if dimensions differ from original
  const hasResize =
    originalImage &&
    (resizeConfig.width !== originalImage.width || resizeConfig.height !== originalImage.height)

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
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((v) => !v) } }}
        className="sidebar-panel-header flex items-center justify-between cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Maximize className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Resize</span>
        </div>
        <div className="flex items-center gap-2">
          {hasResize && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleReset() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Space') { e.stopPropagation(); handleReset() } }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-colors"
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
            <div className="flex flex-col gap-2.5 pt-1">

      {/* Aspect ratio lock + dimension inputs */}
      <div className="flex items-center gap-2">
        <span className="w-5 text-xs font-medium text-muted-foreground/60">W</span>
        <input
          type="number"
          min={16}
          max={8192}
          value={resizeConfig.width}
          onChange={(e) => handleWidthChange(parseInt(e.target.value) || 16)}
          className="w-[5rem] h-7 text-xs px-1.5 rounded-md border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={() => setResizeConfig({ lockAspectRatio: !resizeConfig.lockAspectRatio })}
          className={`size-6 rounded-md border flex items-center justify-center transition-all ${
            resizeConfig.lockAspectRatio
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground/60 hover:text-foreground'
          }`}
          title={resizeConfig.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          aria-label={resizeConfig.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
        >
          {resizeConfig.lockAspectRatio ? (
            <Lock className="size-3" />
          ) : (
            <Unlock className="size-3" />
          )}
        </button>
        <span className="w-5 text-xs font-medium text-muted-foreground/60">H</span>
        <input
          type="number"
          min={16}
          max={8192}
          value={resizeConfig.height}
          onChange={(e) => handleHeightChange(parseInt(e.target.value) || 16)}
          className="w-[5rem] h-7 text-xs px-1.5 rounded-md border bg-background/50 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Resize mode buttons */}
      <div className="grid grid-cols-4 gap-1">
        {RESIZE_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setResizeConfig({ mode: m.value })}
            className={`h-8 w-full rounded-md text-xs font-medium transition-all ${
              resizeConfig.mode === m.value
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
            }`}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Size presets */}
      <div className="grid grid-cols-3 gap-1">
        {SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetSelect(preset)}
            className={`h-7 rounded-md text-xs font-medium transition-all ${
              (preset.width === 0 && resizeConfig.width === originalImage.width && resizeConfig.height === originalImage.height) ||
              (preset.width > 0 && resizeConfig.width === preset.width && resizeConfig.height === preset.height)
                ? 'bg-primary/15 text-primary shadow-sm border-primary/30 border'
                : 'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Dimension preview */}
      <div className="text-xs text-muted-foreground/60 tabular-nums">
        {originalImage.width}×{originalImage.height} &rarr;{' '}
        <span className={hasResize ? 'text-primary font-semibold' : ''}>
          {resizeConfig.width}×{resizeConfig.height}
        </span>
      </div>

      {/* Format selector */}
      <div className="flex items-center gap-1.5">
        <FileOutput className="size-3 text-muted-foreground/60" />
        <span className="text-xs font-medium text-muted-foreground/60">Format</span>
        <div className="flex gap-1 ml-auto flex-wrap max-w-full overflow-hidden">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setResizeConfig({ targetFormat: f.value })}
              className={`h-7 min-h-[36px] rounded-md text-xs font-medium transition-all px-2 sm:px-3 ${
                resizeConfig.targetFormat === f.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
              }`}
              title={f.desc}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isResizing || !hasResize}
        className="w-full gap-1.5 rounded-md h-8 text-xs font-medium shadow-sm"
      >
        {isResizing ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Resizing
          </>
        ) : (
          <>
            <Maximize className="size-3" />
            Apply resize
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

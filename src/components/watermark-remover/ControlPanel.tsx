'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eraser, Stamp, Scan, Paintbrush, Loader2, RotateCw, FlipHorizontal, FlipVertical, ChevronDown, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import WatermarkAdder from './WatermarkAdder'

function getPrimaryRgba(alpha: number): string {
  if (typeof window === 'undefined') return `rgba(40, 102, 72, ${alpha})`
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  const normalized = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(40, 102, 72, ${alpha})`
  const n = Number.parseInt(normalized, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function showSuccessToast(action: 'remove' | 'add') {
  toast({
    title: action === 'remove' ? 'Watermark removed' : 'Watermark applied',
    description: action === 'remove'
      ? 'The watermark has been successfully removed from your image.'
      : 'The watermark has been added to your image.',
  })
}

export default function ControlPanel() {
  const {
    mode,
    setMode,
    autoDetect,
    setAutoDetect,
    maskData,
    setMaskData,
    originalImage,
    isProcessing,
    setIsProcessing,
    setProcessedImage,
    setShowComparison,
    watermarkConfig,
    transformConfig,
    setTransformConfig,
    setOriginalImage,
    isInlineBrushActive,
  } = useAppStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [isTransforming, setIsTransforming] = useState(false)
  const [isTransformOpen, setIsTransformOpen] = useState(false)
  const [isAutoEnhancing, setIsAutoEnhancing] = useState(false)

  const handleProcess = useCallback(async () => {
    if (!originalImage) return

    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)

      if (mode === 'remove') {
        formData.append('autoDetect', String(autoDetect))
        if (!autoDetect && maskData) {
          const maskBlob = await fetch(maskData).then((r) => r.blob())
          formData.append('mask', maskBlob, 'mask.png')
        }

        const res = await fetch('/api/remove-watermark', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.success) {
          // Merge detection metadata through to the store. The API returns
          // detectionConfidence (0-99) and detectionRegion (bounding box or
          // null) at the top level — only present when autoDetect ran.
          // For manual-mask removals both are undefined/null, which is the
          // correct semantic ("we didn't auto-detect anything").
          const result = {
            dataUrl: data.result.dataUrl as string,
            width: data.result.width as number,
            height: data.result.height as number,
            size: data.result.size as number,
            detectionConfidence: typeof data.detectionConfidence === 'number' ? data.detectionConfidence : undefined,
            detectionRegion: data.detectionRegion ?? null,
          }
          setProcessedImage(result, 'remove-watermark')
          setShowComparison(true)
          showSuccessToast('remove')
        }
      } else {
        formData.append('text', watermarkConfig.text)
        formData.append('fontSize', String(watermarkConfig.fontSize))
        formData.append('color', watermarkConfig.color)
        formData.append('opacity', String(watermarkConfig.opacity))
        formData.append('position', watermarkConfig.position)
        formData.append('rotation', String(watermarkConfig.rotation))
        formData.append('shadow', String(watermarkConfig.shadow))
        formData.append('repeat', String(watermarkConfig.repeat))

        if (watermarkConfig.logoFile) {
          formData.append('logo', watermarkConfig.logoFile)
          formData.append('logoOpacity', String(watermarkConfig.logoOpacity))
          formData.append('logoSize', String(watermarkConfig.logoSize))
          formData.append('logoPosition', watermarkConfig.logoPosition)
        }

        const res = await fetch('/api/add-watermark', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.success) {
          setProcessedImage(data.result, 'add-watermark')
          setShowComparison(true)
          showSuccessToast('add')
        }
      }
    } catch (err) {
      console.error('Processing failed:', err)
      toast({
        title: 'Processing failed',
        description: mode === 'remove' ? 'Could not remove watermark. Try again or use manual mask.' : 'Could not apply watermark. Check your settings.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [originalImage, mode, autoDetect, maskData, watermarkConfig, setIsProcessing, setProcessedImage, setShowComparison])


  // Expose handleProcess to the parent via a ref-less pattern: store it in a
  // module-level variable so the sticky CTA in page.tsx can call it.
  // We use a simple approach: store the latest handler on the window object
  // under a known key. This avoids prop drilling and context complexity.
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as unknown as { __geminiProcess?: () => void }).__geminiProcess = handleProcess
    return () => {
      delete (window as unknown as { __geminiProcess?: () => void }).__geminiProcess
    }
  }, [handleProcess])

  // Handle image transformation
  const handleTransform = useCallback(async () => {
    if (!originalImage) return

    setIsTransforming(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('rotation', String(transformConfig.rotation))
      formData.append('flipH', String(transformConfig.flipH))
      formData.append('flipV', String(transformConfig.flipV))

      const res = await fetch('/api/transform', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        const resultDataUrl = data.result.dataUrl
        const resultBlob = await fetch(resultDataUrl).then((r) => r.blob())
        const resultFile = new File([resultBlob], originalImage.name, { type: 'image/png' })

        const newImageInfo = {
          ...originalImage,
          file: resultFile,
          width: data.result.width,
          height: data.result.height,
          size: data.result.size,
          dataUrl: resultDataUrl,
        }
        setOriginalImage(newImageInfo, 'transform')
        toast({ title: 'Transform applied', description: 'Image has been rotated/flipped successfully.' })
      }
    } catch (err) {
      console.error('Transform failed:', err)
      toast({ title: 'Transform failed', description: 'Could not transform image. Try again.', variant: 'destructive' })
    } finally {
      setIsTransforming(false)
    }
  }, [originalImage, transformConfig, setOriginalImage])

  // Canvas drawing for manual mask
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !originalImage) return

    const img = new Image()
    img.onload = () => {
      const maxW = 400
      const scale = Math.min(1, maxW / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
    }
    img.src = originalImage.dataUrl
  }, [originalImage])

  const drawOnCanvas = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !canvasRef.current) return
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      ctx.fillStyle = getPrimaryRgba(0.38)
      ctx.beginPath()
      ctx.arc(x, y, brushSize * scaleX / 2, 0, Math.PI * 2)
      ctx.fill()
    },
    [isDrawing, brushSize]
  )

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true)
      drawOnCanvas(e)
    },
    [drawOnCanvas]
  )

  const handleCanvasMouseUp = useCallback(() => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    setMaskData(canvas.toDataURL('image/png'))
  }, [setMaskData])

  const clearMask = useCallback(() => {
    setMaskData(null)
    initCanvas()
  }, [setMaskData, initCanvas])

  useEffect(() => {
    if (mode === 'remove' && !autoDetect) {
      initCanvas()
    }
  }, [mode, autoDetect, initCanvas])

  const hasTransform = transformConfig.rotation !== 0 || transformConfig.flipH || transformConfig.flipV

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-full flex-col gap-3 sm:gap-4 overflow-hidden"
    >
      {/* Transform controls + Auto Enhance */}
      <div className="sidebar-panel flex flex-col gap-2 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm sm:p-4">
        <div className="flex min-h-8 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTransformOpen((prev) => !prev)}
            className="sidebar-panel-header flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            aria-expanded={isTransformOpen}
          >
            <span className="text-sm font-bold text-foreground">Transform</span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                isTransformOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
          {/* Auto Enhance is a sibling action, never nested inside the toggle button. */}
          <button
            type="button"
            onClick={async () => {
              if (!originalImage || isAutoEnhancing) return
              setIsAutoEnhancing(true)
              setIsProcessing(true)
              try {
                const formData = new FormData()
                formData.append('image', originalImage.file)
                formData.append('brightness', '1.15')
                formData.append('contrast', '1.1')
                formData.append('saturation', '1.2')
                formData.append('sharpen', '1')
                formData.append('blur', '0')
                formData.append('hue', '0')
                formData.append('grayscale', 'false')
                formData.append('sepia', 'false')
                formData.append('invert', 'false')

                const res = await fetch('/api/adjust', {
                  method: 'POST',
                  body: formData,
                })
                const data = await res.json()

                if (data.success) {
                  const resultDataUrl = data.result.dataUrl
                  const resultBlob = await fetch(resultDataUrl).then((r) => r.blob())
                  const resultFile = new File([resultBlob], originalImage.name, { type: 'image/png' })

                  const newImageInfo = {
                    ...originalImage,
                    file: resultFile,
                    width: data.result.width,
                    height: data.result.height,
                    size: data.result.size,
                    dataUrl: resultDataUrl,
                  }
                  setOriginalImage(newImageInfo, 'transform')
                  toast({ title: 'Auto enhanced', description: 'Image brightness, contrast, and saturation have been improved.' })
                }
              } catch (err) {
                console.error('Auto enhance failed:', err)
                toast({ title: 'Enhance failed', description: 'Could not auto-enhance image.', variant: 'destructive' })
              } finally {
                setIsAutoEnhancing(false)
                setIsProcessing(false)
              }
            }}
            disabled={!originalImage || isAutoEnhancing}
            className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-all shadow-sm ${
              !originalImage || isAutoEnhancing
                ? 'cursor-not-allowed text-muted-foreground opacity-40'
                : 'cursor-pointer border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 text-primary hover:from-primary/20 hover:to-primary/10 hover:shadow-md'
            }`}
            title="Auto enhance image"
            aria-label="Auto enhance image"
          >
            {isAutoEnhancing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Wrench className="size-3" />
            )}
            Enhance
          </button>
        </div>
        {hasTransform && (
          <button
            type="button"
            onClick={() => setTransformConfig({ rotation: 0, flipH: false, flipV: false })}
            className="self-end rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Reset transform
          </button>
        )}
        <AnimatePresence initial={false}>
          {isTransformOpen && (
            <motion.div
              key="transform-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-end gap-2">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`size-7 rounded-md ${isTransforming ? 'opacity-50' : ''}`}
                    onClick={() => setTransformConfig({ rotation: (transformConfig.rotation + 90) % 360 })}
                    disabled={isTransforming}
                    title="Rotate 90°"
                    aria-label="Rotate 90 degrees"
                  >
                    <RotateCw className="size-3" />
                  </Button>
                  <span className={`transform-label ${transformConfig.rotation !== 0 ? 'transform-label-active' : ''}`}>Rotate</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`size-7 rounded-md ${transformConfig.flipH ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20' : ''} ${isTransforming ? 'opacity-50' : ''}`}
                    onClick={() => setTransformConfig({ flipH: !transformConfig.flipH })}
                    disabled={isTransforming}
                    title="Flip horizontal"
                    aria-label="Flip horizontal"
                  >
                    <FlipHorizontal className="size-3" />
                  </Button>
                  <span className={`transform-label ${transformConfig.flipH ? 'transform-label-active' : ''}`}>Flip H</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`size-7 rounded-md ${transformConfig.flipV ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20' : ''} ${isTransforming ? 'opacity-50' : ''}`}
                    onClick={() => setTransformConfig({ flipV: !transformConfig.flipV })}
                    disabled={isTransforming}
                    title="Flip vertical"
                    aria-label="Flip vertical"
                  >
                    <FlipVertical className="size-3" />
                  </Button>
                  <span className={`transform-label ${transformConfig.flipV ? 'transform-label-active' : ''}`}>Flip V</span>
                </div>
                {hasTransform && (
                  <Button
                    size="sm"
                    onClick={handleTransform}
                    disabled={isTransforming}
                    className="ml-auto h-7 rounded-md text-xs gap-1 shadow-sm"
                  >
                    {isTransforming ? <Loader2 className="size-2.5 animate-spin" /> : null}
                    Apply
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as 'remove' | 'add')}
        className="w-full"
      >
        <TabsList className="h-11 w-full rounded-xl border border-primary/15 bg-muted/65 p-1 shadow-inner shadow-primary/10">
          <TabsTrigger value="remove" className="h-9 flex-1 gap-1.5 rounded-lg border border-transparent text-sm font-bold transition-all data-[state=inactive]:bg-card/70 data-[state=inactive]:text-foreground/75 data-[state=inactive]:shadow-sm data-[state=inactive]:hover:border-primary/25 data-[state=inactive]:hover:bg-card data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20">
            <Eraser className="size-3.5" />
            Remove
          </TabsTrigger>
          <TabsTrigger value="add" className="h-9 flex-1 gap-1.5 rounded-lg border border-transparent text-sm font-bold transition-all data-[state=inactive]:bg-card/70 data-[state=inactive]:text-foreground/75 data-[state=inactive]:shadow-sm data-[state=inactive]:hover:border-primary/25 data-[state=inactive]:hover:bg-card data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20">
            <Stamp className="size-3.5" />
            Add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="remove" className="mt-3 flex flex-col gap-3 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-left-1 data-[state=inactive]:animate-out data-[state=inactive]:fade-out">
          <div className="sidebar-panel flex items-center justify-between rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm gap-3">
            <div className="flex items-center gap-2">
              <Scan className="size-3.5 text-muted-foreground/70" />
              <span className="text-sm font-medium">Auto detect</span>
            </div>
            <Switch checked={autoDetect} onCheckedChange={setAutoDetect} className="toggle-switch scale-90" />
          </div>

          {!autoDetect && !isInlineBrushActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paintbrush className="size-3.5 text-muted-foreground/70" />
                  <span className="text-sm font-medium">Brush</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground/50">{brushSize}px</span>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-16 accent-primary h-1"
                  />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-lg border bg-muted/30">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={drawOnCanvas}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={clearMask}
                className="self-start h-7 text-xs rounded-md"
              >
                Clear mask
              </Button>
            </motion.div>
          )}

          {/* Hint when inline brush is active on the main preview */}
          {isInlineBrushActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5"
            >
              <Paintbrush className="size-3.5 text-primary" />
              <span className="text-sm font-medium text-foreground/80">
                Paint over the watermark on the image, then click Apply.
              </span>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-3 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-right-1 data-[state=inactive]:animate-out data-[state=inactive]:fade-out">
          <WatermarkAdder />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

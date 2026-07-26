'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eraser, Stamp, Scan, Paintbrush, Loader2, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAppStore } from '@/lib/store'
import WatermarkAdder from './WatermarkAdder'

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
  } = useAppStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [isTransforming, setIsTransforming] = useState(false)

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
          setProcessedImage(data.result)
          setShowComparison(true)
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
          setProcessedImage(data.result)
          setShowComparison(true)
        }
      }
    } catch (err) {
      console.error('Processing failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [originalImage, mode, autoDetect, maskData, watermarkConfig, setIsProcessing, setProcessedImage, setShowComparison])

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
        // Update the original image with transformed version
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
        setOriginalImage(newImageInfo)
      }
    } catch (err) {
      console.error('Transform failed:', err)
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

      ctx.fillStyle = 'rgba(255, 60, 60, 0.35)'
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
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col gap-3"
    >
      {/* Transform controls - always visible */}
      <div className="flex flex-col gap-2 rounded-md border bg-card p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground/60">Transform</span>
          {hasTransform && (
            <button
              onClick={() => setTransformConfig({ rotation: 0, flipH: false, flipV: false })}
              className="text-[9px] text-muted-foreground/40 hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => setTransformConfig({ rotation: (transformConfig.rotation + 90) % 360 })}
            disabled={isTransforming}
          >
            <RotateCw className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={`size-7 ${transformConfig.flipH ? 'bg-primary/10 border-primary/40' : ''}`}
            onClick={() => setTransformConfig({ flipH: !transformConfig.flipH })}
            disabled={isTransforming}
          >
            <FlipHorizontal className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={`size-7 ${transformConfig.flipV ? 'bg-primary/10 border-primary/40' : ''}`}
            onClick={() => setTransformConfig({ flipV: !transformConfig.flipV })}
            disabled={isTransforming}
          >
            <FlipVertical className="size-3" />
          </Button>
          {hasTransform && (
            <Button
              size="sm"
              onClick={handleTransform}
              disabled={isTransforming}
              className="ml-auto h-7 text-[10px] gap-1"
            >
              {isTransforming ? <Loader2 className="size-2.5 animate-spin" /> : null}
              Apply
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as 'remove' | 'add')}
        className="w-full"
      >
        <TabsList className="w-full h-8">
          <TabsTrigger value="remove" className="flex-1 gap-1 h-7 text-xs">
            <Eraser className="size-3" />
            Remove
          </TabsTrigger>
          <TabsTrigger value="add" className="flex-1 gap-1 h-7 text-xs">
            <Stamp className="size-3" />
            Add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="remove" className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-md border bg-card p-2.5">
            <div className="flex items-center gap-2">
              <Scan className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Auto</span>
            </div>
            <Switch checked={autoDetect} onCheckedChange={setAutoDetect} className="scale-90" />
          </div>

          {!autoDetect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Paintbrush className="size-3.5 text-muted-foreground" />
                  <span className="text-xs">Brush</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50">{brushSize}</span>
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

              <div className="relative overflow-hidden rounded-md border bg-muted/30">
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
                className="self-start h-7 text-xs"
              >
                Clear
              </Button>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-3">
          <WatermarkAdder />
        </TabsContent>
      </Tabs>

      <Button
        size="default"
        onClick={handleProcess}
        disabled={isProcessing || (mode === 'add' && !watermarkConfig.text && !watermarkConfig.logoFile)}
        className="w-full gap-1.5 rounded-lg font-semibold h-9"
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Processing
          </>
        ) : (
          <>
            {mode === 'remove' ? <Eraser className="size-3.5" /> : <Stamp className="size-3.5" />}
            {mode === 'remove' ? 'Remove' : 'Apply'}
          </>
        )}
      </Button>
    </motion.div>
  )
}

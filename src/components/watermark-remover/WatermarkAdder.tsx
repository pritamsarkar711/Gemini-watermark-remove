'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Type, Upload, ImageIcon, RotateCw, Grid3x3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppStore, type WatermarkPosition } from '@/lib/store'

const POSITIONS: WatermarkPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center',
  'bottom-left', 'bottom-center', 'bottom-right',
]

const POS_ICONS: Record<WatermarkPosition, string> = {
  'top-left': '↖', 'top-center': '↑', 'top-right': '↗',
  'center': '⊕',
  'bottom-left': '↙', 'bottom-center': '↓', 'bottom-right': '↘',
}

const PRESET_COLORS = [
  '#ffffff', '#000000', '#ff4444', '#4444ff',
  '#44ff44', '#ffff44', '#ff44ff', '#44ffff',
]

// Preview canvas size constraints (in canvas pixels; CSS scales to container)
const PREVIEW_MAX_WIDTH = 480
const PREVIEW_MAX_HEIGHT = 360
const PREVIEW_PADDING = 20

/**
 * Compute the (x, y) anchor point for a watermark box at the given position.
 * The returned `y` represents the BOTTOM of the box (consistent with
 * `textBaseline = 'bottom'` for text, and with `drawImage(x, y - h)` for logos).
 */
function getPositionCoords(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  textW: number,
  textH: number,
  padding = PREVIEW_PADDING
): { x: number; y: number } {
  switch (position) {
    case 'top-left': return { x: padding, y: padding + textH }
    case 'top-center': return { x: (canvasW - textW) / 2, y: padding + textH }
    case 'top-right': return { x: canvasW - textW - padding, y: padding + textH }
    case 'center': return { x: (canvasW - textW) / 2, y: (canvasH + textH) / 2 }
    case 'bottom-left': return { x: padding, y: canvasH - padding }
    case 'bottom-center': return { x: (canvasW - textW) / 2, y: canvasH - padding }
    case 'bottom-right': return { x: canvasW - textW - padding, y: canvasH - padding }
    default: return { x: padding, y: canvasH - padding }
  }
}

/** Load an image source into an HTMLImageElement, resolving once decoded. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

export default function WatermarkAdder() {
  const { originalImage, processedImage, watermarkConfig, setWatermarkConfig } = useAppStore()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Monotonic token used to cancel superseded draws (e.g. user typing fast).
  const drawTokenRef = useRef(0)

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setWatermarkConfig({ logoFile: file })
      }
    },
    [setWatermarkConfig]
  )

  const draw = useCallback(async () => {
    // Bump token so any in-flight draw knows it has been superseded.
    const token = ++drawTokenRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Prefer the processed image as the base (so the user previews the final
    // result); fall back to the original image.
    const baseImage = processedImage ?? originalImage
    if (!baseImage) {
      canvas.width = PREVIEW_MAX_WIDTH
      canvas.height = PREVIEW_MAX_HEIGHT
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    try {
      const img = await loadImage(baseImage.dataUrl)
      if (drawTokenRef.current !== token) return // superseded

      // Fit the image inside the preview bounds, never upscale.
      const scale = Math.min(
        PREVIEW_MAX_WIDTH / img.width,
        PREVIEW_MAX_HEIGHT / img.height,
        1
      )
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h

      // Draw the base image.
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      // Scale font/logo sizes to match the preview scale so what you see is
      // representative of what the server will render at full resolution.
      const scaledFontSize = Math.max(1, watermarkConfig.fontSize * scale)

      // ── Text watermark ──────────────────────────────────────────────
      if (watermarkConfig.text.trim()) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, watermarkConfig.opacity / 100))
        ctx.font = `${scaledFontSize}px 'Work Sans', system-ui, sans-serif`
        ctx.fillStyle = watermarkConfig.color
        ctx.textBaseline = 'bottom'

        if (watermarkConfig.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.55)'
          ctx.shadowBlur = Math.max(2, scaledFontSize / 4)
          ctx.shadowOffsetX = 1
          ctx.shadowOffsetY = 1
        }

        const textMetrics = ctx.measureText(watermarkConfig.text)
        const textW = textMetrics.width
        const textH = scaledFontSize

        if (watermarkConfig.repeat) {
          // Diagonal tile pattern covering the entire canvas. We center the
          // canvas origin, apply rotation, then fill a grid sized to cover the
          // canvas diagonal (so tiles fill the rotated viewport).
          const stepX = textW + 60
          const stepY = textH + 60
          ctx.translate(w / 2, h / 2)
          ctx.rotate((watermarkConfig.rotation * Math.PI) / 180)
          const diag = Math.sqrt(w * w + h * h)
          let row = 0
          for (let y = -diag; y <= diag; y += stepY) {
            // Stagger every other row for a classic diagonal-tile feel.
            const offset = row % 2 === 0 ? 0 : stepX / 2
            for (let x = -diag + offset; x <= diag; x += stepX) {
              ctx.fillText(watermarkConfig.text, x, y)
            }
            row++
          }
        } else {
          const { x, y } = getPositionCoords(
            watermarkConfig.position, w, h, textW, textH, PREVIEW_PADDING
          )
          // Rotate around the text's visual center for natural rotation.
          const cx = x + textW / 2
          const cy = y - textH / 2
          ctx.translate(cx, cy)
          ctx.rotate((watermarkConfig.rotation * Math.PI) / 180)
          ctx.fillText(watermarkConfig.text, -textW / 2, textH / 2)
        }
        ctx.restore()
      }

      // ── Logo watermark ──────────────────────────────────────────────
      if (watermarkConfig.logoFile) {
        const logoUrl = URL.createObjectURL(watermarkConfig.logoFile)
        try {
          const logoImg = await loadImage(logoUrl)
          if (drawTokenRef.current !== token) return // superseded

          const logoW = Math.max(1, watermarkConfig.logoSize * scale)
          const logoAspect = logoImg.height / Math.max(1, logoImg.width)
          const logoH = logoW * logoAspect

          ctx.save()
          ctx.globalAlpha = Math.max(0, Math.min(1, watermarkConfig.logoOpacity / 100))
          const { x, y } = getPositionCoords(
            watermarkConfig.logoPosition, w, h, logoW, logoH, PREVIEW_PADDING
          )
          // y is the bottom of the logo's box; drawImage expects top-left.
          ctx.drawImage(logoImg, x, y - logoH, logoW, logoH)
          ctx.restore()
        } catch {
          // Logo failed to decode — silently skip so the rest of the preview
          // (text + base image) still renders.
        } finally {
          URL.revokeObjectURL(logoUrl)
        }
      }
    } catch {
      if (drawTokenRef.current !== token) return // superseded
      // Base image failed to load — reset canvas to a blank state.
      canvas.width = PREVIEW_MAX_WIDTH
      canvas.height = PREVIEW_MAX_HEIGHT
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [
    originalImage,
    processedImage,
    watermarkConfig.text,
    watermarkConfig.color,
    watermarkConfig.fontSize,
    watermarkConfig.opacity,
    watermarkConfig.position,
    watermarkConfig.rotation,
    watermarkConfig.shadow,
    watermarkConfig.repeat,
    watermarkConfig.logoFile,
    watermarkConfig.logoOpacity,
    watermarkConfig.logoSize,
    watermarkConfig.logoPosition,
  ])

  useEffect(() => {
    void draw()
  }, [draw])

  return (
    <div className="flex flex-col gap-3">
      {/* LIVE PREVIEW */}
      <div className="flex flex-col gap-2 rounded-lg border bg-card/80 p-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold">Live preview</span>
        </div>
        <div className="relative overflow-hidden rounded-md border bg-muted/20 shadow-inner">
          {originalImage ? (
            <>
              <canvas ref={canvasRef} className="block w-full h-auto" />
              {/* "Live" badge — top-right of canvas */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400/70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-green-400" />
                </span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-white">Live</span>
              </div>
            </>
          ) : (
            <div className="flex aspect-[2/1] w-full items-center justify-center">
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                <ImageIcon className="size-5" />
                <span className="text-[10px]">Upload an image first</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text watermark */}
      <div className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Type className="size-3.5 text-muted-foreground/60" />
            <Label className="text-xs font-semibold">Text watermark</Label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/60">Shadow</span>
            <Switch
              checked={watermarkConfig.shadow}
              onCheckedChange={(v) => setWatermarkConfig({ shadow: v })}
              className="scale-75"
            />
          </div>
        </div>

        <Input
          value={watermarkConfig.text}
          onChange={(e) => setWatermarkConfig({ text: e.target.value })}
          placeholder="Enter watermark text"
          className="h-7 text-xs rounded-lg"
        />

        {/* Color presets */}
        <div className="flex items-center gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setWatermarkConfig({ color })}
              className={`size-4 rounded-md border transition-all shadow-sm ${
                watermarkConfig.color === color ? 'ring-2 ring-primary ring-offset-1 ring-offset-card scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <div className="flex items-center gap-1 ml-1">
            <div
              className="size-4 rounded-md border cursor-pointer shadow-sm"
              style={{ backgroundColor: watermarkConfig.color }}
            />
            <Input
              value={watermarkConfig.color}
              onChange={(e) => setWatermarkConfig({ color: e.target.value })}
              className="w-[4rem] h-5 text-[9px] px-1 rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/50">Size</span>
          <Slider
            value={[watermarkConfig.fontSize]}
            min={8}
            max={72}
            step={1}
            onValueChange={(v) => setWatermarkConfig({ fontSize: v[0] })}
            className="w-20"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 text-right">{watermarkConfig.fontSize}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/50">Opacity</span>
          <Slider
            value={[watermarkConfig.opacity]}
            min={5}
            max={100}
            step={1}
            onValueChange={(v) => setWatermarkConfig({ opacity: v[0] })}
            className="w-20"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-7 text-right">{watermarkConfig.opacity}%</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
            <RotateCw className="size-2.5" />
            Rotate
          </span>
          <Slider
            value={[watermarkConfig.rotation]}
            min={-90}
            max={90}
            step={5}
            onValueChange={(v) => setWatermarkConfig({ rotation: v[0] })}
            className="w-20"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-7 text-right">{watermarkConfig.rotation}°</span>
        </div>

        {/* Repeat toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Grid3x3 className="size-3 text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground/50">Tile pattern</span>
          </div>
          <Switch
            checked={watermarkConfig.repeat}
            onCheckedChange={(v) => setWatermarkConfig({ repeat: v })}
            className="scale-75"
          />
        </div>

        {!watermarkConfig.repeat && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 font-medium">Position</span>
            <div className="grid grid-cols-3 gap-1">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setWatermarkConfig({ position: pos })}
                  className={`flex size-7 items-center justify-center rounded-md text-[10px] transition-all shadow-sm ${
                    watermarkConfig.position === pos
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted/60 text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {POS_ICONS[pos]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logo watermark */}
      <div className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-muted-foreground/60" />
          <Label className="text-xs font-semibold">Logo watermark</Label>
        </div>

        <div
          onClick={() => logoInputRef.current?.click()}
          className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed bg-muted/20 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all shadow-sm"
        >
          {watermarkConfig.logoFile ? (
            <div className="flex items-center gap-2">
              <ImageIcon className="size-3 text-primary/70" />
              <span className="text-[11px] font-medium text-foreground/70">{watermarkConfig.logoFile.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="size-3.5 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground/60">Upload logo</span>
            </div>
          )}
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />

        {watermarkConfig.logoFile && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/50">Opacity</span>
              <Slider
                value={[watermarkConfig.logoOpacity]}
                min={5}
                max={100}
                step={1}
                onValueChange={(v) => setWatermarkConfig({ logoOpacity: v[0] })}
                className="w-20"
              />
              <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 text-right">{watermarkConfig.logoOpacity}%</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/50">Size</span>
              <Slider
                value={[watermarkConfig.logoSize]}
                min={20}
                max={300}
                step={5}
                onValueChange={(v) => setWatermarkConfig({ logoSize: v[0] })}
                className="w-20"
              />
              <span className="text-[10px] tabular-nums text-muted-foreground/50 w-6 text-right">{watermarkConfig.logoSize}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground/50 font-medium">Position</span>
              <div className="grid grid-cols-3 gap-1">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setWatermarkConfig({ logoPosition: pos })}
                    className={`flex size-7 items-center justify-center rounded-md text-[10px] transition-all shadow-sm ${
                      watermarkConfig.logoPosition === pos
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/60 text-muted-foreground hover:bg-accent'
                  }`}
                  >
                    {POS_ICONS[pos]}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setWatermarkConfig({ logoFile: null })}
              className="self-start h-6 text-[10px] rounded-lg"
            >
              Remove logo
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

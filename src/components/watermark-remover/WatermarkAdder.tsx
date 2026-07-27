'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Type, Upload, ImageIcon, RotateCw, Grid3x3, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppStore, type WatermarkPosition } from '@/lib/store'
import PresetBar from './PresetBar'

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

// Preview canvas size constraints (in canvas pixels). Large enough to make watermark text legible,
// while still fitting comfortably in the editor card.
const PREVIEW_MAX_WIDTH = 720
const PREVIEW_MAX_HEIGHT = 360
const PREVIEW_PADDING = 20

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

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

  const updateColor = useCallback((color: string) => {
    if (!isValidHexColor(color)) return
    setWatermarkConfig({ color: color.toLowerCase() })
  }, [setWatermarkConfig])

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

  const [logoOpen, setLogoOpen] = useState(false)

  return (
    <div className="flex max-w-full flex-col gap-3 overflow-x-hidden">
      {/* PRESETS — quick-apply watermark templates */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm max-w-full overflow-x-hidden sm:p-4">
        <PresetBar />
      </div>

      {/* LIVE PREVIEW */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm max-w-full overflow-x-hidden sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Live preview</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white">Live</span>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg border bg-muted/20 shadow-inner" style={{ maxHeight: '360px' }}>
          {originalImage ? (
            <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full" style={{ maxHeight: '360px', width: 'auto' }} />
          ) : (
            <div className="flex aspect-[2/1] w-full items-center justify-center">
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                <ImageIcon className="size-5" />
                <span className="text-xs">Upload an image first</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text watermark */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm max-w-full overflow-x-hidden sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Type className="size-4 text-primary" />
            <Label className="text-sm font-bold text-foreground">Text watermark</Label>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Shadow</span>
            <Switch
              checked={watermarkConfig.shadow}
              onCheckedChange={(v) => setWatermarkConfig({ shadow: v })}
              className="scale-75 toggle-switch"
            />
          </div>
        </div>

        <Input
          value={watermarkConfig.text}
          onChange={(e) => setWatermarkConfig({ text: e.target.value })}
          placeholder="Enter watermark text"
          aria-label="Watermark text"
          className="h-11 rounded-lg border-border/70 px-3 text-base font-medium shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
        />

        {/* Accessible, responsive colour controls. The custom field never forces the swatches off-screen. */}
        <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-muted/25 p-2.5 sm:p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Text color</span>
            <span className="rounded-md bg-card px-2 py-1 font-mono text-xs font-semibold uppercase text-primary ring-1 ring-border/60">
              {watermarkConfig.color}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateColor(color)}
                aria-label={`Set text color to ${color}`}
                aria-pressed={watermarkConfig.color.toLowerCase() === color}
                className={`flex size-9 items-center justify-center rounded-full border-2 transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  watermarkConfig.color.toLowerCase() === color
                    ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-card'
                    : 'border-white/60 shadow-sm hover:border-primary/50'
                }`}
                style={{ backgroundColor: color }}
              >
                {watermarkConfig.color.toLowerCase() === color && <span className="size-2 rounded-full border border-primary bg-card shadow" />}
              </button>
            ))}
            <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card pl-1 pr-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/45">
              <input
                type="color"
                value={isValidHexColor(watermarkConfig.color) ? watermarkConfig.color : '#ffffff'}
                onChange={(e) => updateColor(e.target.value)}
                aria-label="Choose a custom text color"
                className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
              />
              Custom
            </label>
            <Input
              key={watermarkConfig.color}
              defaultValue={watermarkConfig.color}
              onChange={(e) => {
                if (isValidHexColor(e.target.value)) updateColor(e.target.value)
              }}
              onBlur={(e) => {
                if (!isValidHexColor(e.currentTarget.value)) e.currentTarget.value = watermarkConfig.color
              }}
              maxLength={7}
              spellCheck={false}
              aria-label="Custom colour hex value"
              className="h-9 w-25 rounded-lg bg-card px-2 font-mono text-xs font-semibold uppercase"
            />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(72px,1fr)_minmax(110px,2fr)_3.5rem] items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Size</span>
          <Slider
            value={[watermarkConfig.fontSize]}
            min={8}
            max={180}
            step={1}
            onValueChange={(v) => setWatermarkConfig({ fontSize: v[0] })}
          />
          <span className="text-right text-sm font-bold tabular-nums text-primary">{watermarkConfig.fontSize}px</span>
        </div>

        <div className="grid grid-cols-[minmax(72px,1fr)_minmax(110px,2fr)_3.5rem] items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Opacity</span>
          <Slider
            value={[watermarkConfig.opacity]}
            min={5}
            max={100}
            step={1}
            onValueChange={(v) => setWatermarkConfig({ opacity: v[0] })}
          />
          <span className="text-right text-sm font-bold tabular-nums text-primary">{watermarkConfig.opacity}%</span>
        </div>

        <div className="grid grid-cols-[minmax(72px,1fr)_minmax(110px,2fr)_3.5rem] items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <RotateCw className="size-3.5" />
            Rotate
          </span>
          <Slider
            value={[watermarkConfig.rotation]}
            min={-90}
            max={90}
            step={5}
            onValueChange={(v) => setWatermarkConfig({ rotation: v[0] })}
          />
          <span className="text-right text-sm font-bold tabular-nums text-primary">{watermarkConfig.rotation}°</span>
        </div>

        {/* Repeat toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Grid3x3 className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Tile pattern</span>
          </div>
          <Switch
            checked={watermarkConfig.repeat}
            onCheckedChange={(v) => setWatermarkConfig({ repeat: v })}
            className="scale-75 toggle-switch"
          />
        </div>

        {!watermarkConfig.repeat && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">Position</span>
            <div className="grid max-w-full grid-cols-3 gap-1.5 overflow-x-hidden">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setWatermarkConfig({ position: pos })}
                  aria-label={`Place text watermark ${pos.replace('-', ' ')}`}
                  aria-pressed={watermarkConfig.position === pos}
                  className={`flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all shadow-sm ${
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

      {/* Logo watermark — collapsible to save vertical space */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm max-w-full overflow-x-hidden sm:p-4">
        <button
          type="button"
          onClick={() => setLogoOpen((v) => !v)}
          className="flex items-center justify-between gap-3 cursor-pointer"
          aria-expanded={logoOpen}
        >
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon className="size-4 shrink-0 text-primary" />
            <Label className="text-sm font-bold text-foreground">Logo watermark</Label>
            {watermarkConfig.logoFile && (
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                {watermarkConfig.logoFile.name.length > 12
                  ? watermarkConfig.logoFile.name.slice(0, 10) + '…'
                  : watermarkConfig.logoFile.name}
              </span>
            )}
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${logoOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {logoOpen && (
            <motion.div
              key="logo-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-1">
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="flex min-h-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/25 bg-primary/[0.025] p-3 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
                >
                  {watermarkConfig.logoFile ? (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-3 text-primary/70" />
                      <span className="text-sm font-medium text-foreground/70">{watermarkConfig.logoFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="size-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Upload a logo</span>
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
                    <div className="grid grid-cols-[minmax(72px,1fr)_minmax(110px,2fr)_3.5rem] items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Opacity</span>
                      <Slider
                        value={[watermarkConfig.logoOpacity]}
                        min={5}
                        max={100}
                        step={1}
                        onValueChange={(v) => setWatermarkConfig({ logoOpacity: v[0] })}
                      />
                      <span className="text-right text-sm font-bold tabular-nums text-primary">{watermarkConfig.logoOpacity}%</span>
                    </div>

                    <div className="grid grid-cols-[minmax(72px,1fr)_minmax(110px,2fr)_3.5rem] items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Size</span>
                      <Slider
                        value={[watermarkConfig.logoSize]}
                        min={20}
                        max={300}
                        step={5}
                        onValueChange={(v) => setWatermarkConfig({ logoSize: v[0] })}
                      />
                      <span className="text-right text-sm font-bold tabular-nums text-primary">{watermarkConfig.logoSize}px</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-foreground">Position</span>
                      <div className="grid max-w-full grid-cols-3 gap-1.5 overflow-x-hidden">
                        {POSITIONS.map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setWatermarkConfig({ logoPosition: pos })}
                            aria-label={`Place logo watermark ${pos.replace('-', ' ')}`}
                            aria-pressed={watermarkConfig.logoPosition === pos}
                            className={`flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all shadow-sm ${
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
                      className="self-start h-9 rounded-lg text-sm font-semibold"
                    >
                      Remove logo
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

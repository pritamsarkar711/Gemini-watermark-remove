'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun,
  Contrast,
  Palette,
  Circle,
  SlidersHorizontal,
  Loader2,
  RotateCcw,
  Droplet,
  ChevronDown,
  Focus,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'

interface SliderRowProps {
  icon: React.ElementType
  label: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  formatValue: (v: number) => string
  onChange: (v: number) => void
}

function SliderRow({
  icon: Icon,
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  formatValue,
  onChange,
}: SliderRowProps) {
  const isModified = value !== defaultValue
  return (
    <div className={`grid grid-cols-[minmax(5.75rem,0.9fr)_minmax(6rem,2fr)_4rem] items-center gap-2 rounded-lg border px-2.5 py-2 transition-all sm:grid-cols-[minmax(7rem,0.9fr)_minmax(9rem,2fr)_4.75rem] sm:gap-3 sm:px-3 ${
      isModified
        ? 'border-primary/25 bg-primary/[0.045]'
        : 'border-border/55 bg-card/70'
    }`}>
      <span
        className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${
          isModified ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
          isModified ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="w-full"
      />
      <span
        className={`rounded-md px-2 py-1 text-right text-xs font-bold tabular-nums ring-1 ${
          isModified
            ? 'bg-primary text-primary-foreground ring-primary/20'
            : 'bg-muted/60 text-muted-foreground ring-border/50'
        }`}
      >
        {formatValue(value)}
      </span>
    </div>
  )
}

export default function AdjustPanel() {
  const {
    originalImage,
    adjustConfig,
    setAdjustConfig,
    setOriginalImage,
    setIsProcessing,
  } = useAppStore()
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [isOpen, setIsOpen] = useState(false) // Start collapsed to reduce sidebar crowding

  const handleApply = useCallback(async () => {
    if (!originalImage) return

    setIsAdjusting(true)
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('brightness', String(adjustConfig.brightness))
      formData.append('contrast', String(adjustConfig.contrast))
      formData.append('saturation', String(adjustConfig.saturation))
      formData.append('blur', String(adjustConfig.blur))
      formData.append('sharpen', String(adjustConfig.sharpen))
      formData.append('hue', String(adjustConfig.hue))
      formData.append('grayscale', String(adjustConfig.grayscale))
      formData.append('sepia', String(adjustConfig.sepia))
      formData.append('invert', String(adjustConfig.invert))

      const res = await fetch('/api/adjust', {
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
        toast({ title: 'Adjustments applied', description: 'Image adjustments have been applied successfully.' })
      }
    } catch (err) {
      console.error('Adjust failed:', err)
      toast({ title: 'Adjustments failed', description: 'Could not apply adjustments.', variant: 'destructive' })
    } finally {
      setIsAdjusting(false)
      setIsProcessing(false)
    }
  }, [originalImage, adjustConfig, setOriginalImage, setIsProcessing])

  const handleReset = useCallback(() => {
    setAdjustConfig({
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      sharpen: 0,
      hue: 0,
      grayscale: false,
      sepia: false,
      invert: false,
    })
  }, [setAdjustConfig])

  // Check if any adjustment has been modified from defaults
  const hasAdjustments =
    adjustConfig.brightness !== 1 ||
    adjustConfig.contrast !== 1 ||
    adjustConfig.saturation !== 1 ||
    adjustConfig.blur !== 0 ||
    adjustConfig.sharpen !== 0 ||
    adjustConfig.hue !== 0 ||
    adjustConfig.grayscale ||
    adjustConfig.sepia ||
    adjustConfig.invert

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/80 p-3 sm:p-4 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md max-w-full overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((v) => !v) } }}
        className="sidebar-panel-header flex items-center justify-between cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <SlidersHorizontal className="size-3.5" />
          </span>
          <span className="text-sm font-bold text-foreground">Adjustments</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAdjustments && (
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
            <div className="flex flex-col gap-3 pt-2">

      {/* Slider adjustments */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <SliderRow
          icon={Sun}
          label="Brightness"
          value={adjustConfig.brightness}
          min={0.5}
          max={2}
          step={0.05}
          defaultValue={1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setAdjustConfig({ brightness: v })}
        />
        <SliderRow
          icon={Contrast}
          label="Contrast"
          value={adjustConfig.contrast}
          min={0}
          max={2}
          step={0.05}
          defaultValue={1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setAdjustConfig({ contrast: v })}
        />
        <SliderRow
          icon={Palette}
          label="Saturation"
          value={adjustConfig.saturation}
          min={0}
          max={2}
          step={0.05}
          defaultValue={1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setAdjustConfig({ saturation: v })}
        />
        <SliderRow
          icon={Circle}
          label="Hue"
          value={adjustConfig.hue}
          min={-180}
          max={180}
          step={5}
          defaultValue={0}
          formatValue={(v) => `${v}°`}
          onChange={(v) => setAdjustConfig({ hue: v })}
        />
        <SliderRow
          icon={Droplet}
          label="Blur"
          value={adjustConfig.blur}
          min={0}
          max={10}
          step={0.1}
          defaultValue={0}
          formatValue={(v) => (v === 0 ? 'Off' : v.toFixed(1))}
          onChange={(v) => setAdjustConfig({ blur: v })}
        />
        <SliderRow
          icon={Focus}
          label="Sharpen"
          value={adjustConfig.sharpen}
          min={0}
          max={5}
          step={0.1}
          defaultValue={0}
          formatValue={(v) => (v === 0 ? 'Off' : v.toFixed(1))}
          onChange={(v) => setAdjustConfig({ sharpen: v })}
        />
      </div>

      {/* Filter toggles */}
      <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
        {([
          ['grayscale', 'Grayscale', adjustConfig.grayscale],
          ['sepia', 'Sepia', adjustConfig.sepia],
          ['invert', 'Invert', adjustConfig.invert],
        ] as const).map(([key, label, checked]) => (
          <div
            key={key}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              checked ? 'border-primary/25 bg-primary/[0.045]' : 'border-border/55 bg-card/70'
            }`}
          >
            <span className={`text-sm font-semibold ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            <Switch
              checked={checked}
              onCheckedChange={(v) => {
                if (key === 'grayscale') setAdjustConfig({ grayscale: v })
                if (key === 'sepia') setAdjustConfig({ sepia: v })
                if (key === 'invert') setAdjustConfig({ invert: v })
              }}
              className="toggle-switch scale-90"
            />
          </div>
        ))}
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isAdjusting || !hasAdjustments}
        className="w-full gap-1.5 rounded-md h-8 text-xs font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
      >
        {isAdjusting ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Applying
          </>
        ) : (
          <>
            <SlidersHorizontal className="size-3" />
            Apply adjustments
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

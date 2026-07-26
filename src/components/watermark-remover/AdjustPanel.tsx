'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun,
  Contrast,
  Palette,
  Circle,
  Sparkles,
  Loader2,
  RotateCcw,
  Droplet,
  ChevronDown,
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
    <div className="flex items-center justify-between gap-2">
      <span
        className={`flex items-center gap-1 text-[10px] font-medium ${
          isModified ? 'text-primary' : 'text-muted-foreground/60'
        }`}
      >
        <Icon className="size-3" />
        {label}
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="w-20"
      />
      <span
        className={`w-9 text-right text-[10px] tabular-nums ${
          isModified ? 'text-primary font-semibold' : 'text-muted-foreground/50'
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
      className="sidebar-panel flex flex-col gap-2.5 rounded-lg p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="sidebar-panel-header flex items-center justify-between cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-muted-foreground/60" />
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Adjustments</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAdjustments && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleReset() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Space') { e.stopPropagation(); handleReset() } }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-colors"
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

      {/* Slider adjustments */}
      <div className="flex flex-col gap-2">
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
          icon={Sparkles}
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
      <div className="flex flex-col gap-1.5 border-t pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground/60">
            Grayscale
          </span>
          <Switch
            checked={adjustConfig.grayscale}
            onCheckedChange={(v) => setAdjustConfig({ grayscale: v })}
            className="toggle-switch scale-75"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground/60">
            Sepia
          </span>
          <Switch
            checked={adjustConfig.sepia}
            onCheckedChange={(v) => setAdjustConfig({ sepia: v })}
            className="toggle-switch scale-75"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground/60">
            Invert
          </span>
          <Switch
            checked={adjustConfig.invert}
            onCheckedChange={(v) => setAdjustConfig({ invert: v })}
            className="toggle-switch scale-75"
          />
        </div>
      </div>

      {/* Apply button */}
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isAdjusting || !hasAdjustments}
        className="w-full gap-1.5 rounded-lg h-8 text-xs font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
      >
        {isAdjusting ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Applying
          </>
        ) : (
          <>
            <Sparkles className="size-3" />
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

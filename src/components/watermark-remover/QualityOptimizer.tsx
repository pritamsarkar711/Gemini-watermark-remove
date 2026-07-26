'use client'

import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
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
  { label: 'Original', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
  { label: 'Web', config: { format: 'webp', quality: 80, maxWidth: 1920, maxHeight: 1080 } },
  { label: 'Print', config: { format: 'png', quality: 100, maxWidth: 4096, maxHeight: 4096 } },
  { label: 'Social', config: { format: 'jpeg', quality: 85, maxWidth: 1200, maxHeight: 1200 } },
]

function isPresetActive(config: QualityConfig, preset: QualityConfig): boolean {
  return (
    config.format === preset.format &&
    config.quality === preset.quality &&
    config.maxWidth === preset.maxWidth &&
    config.maxHeight === preset.maxHeight
  )
}

export default function QualityOptimizer() {
  const { qualityConfig, setQualityConfig } = useAppStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5 rounded-lg border bg-card/80 p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      <div className="flex items-center gap-1.5">
        <Settings2 className="size-3.5 text-muted-foreground/60" />
        <Label className="text-xs font-semibold">Export quality</Label>
      </div>

      <div className="flex items-center gap-1">
        {presets.map((preset) => {
          const active = isPresetActive(qualityConfig, preset.config)
          return (
            <button
              key={preset.label}
              onClick={() => setQualityConfig(preset.config)}
              className={`h-6 text-[10px] rounded-md px-2 border transition-colors ${
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

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Format</span>
        <Select
          value={qualityConfig.format}
          onValueChange={(v) => setQualityConfig({ format: v as 'jpeg' | 'png' | 'webp' })}
        >
          <SelectTrigger className="w-[3.5rem] h-6 text-[10px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG</SelectItem>
            <SelectItem value="jpeg">JPEG</SelectItem>
            <SelectItem value="webp">WebP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {qualityConfig.format !== 'png' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground/50 font-medium">Quality</span>
          <Slider
            value={[qualityConfig.quality]}
            min={10}
            max={100}
            step={1}
            onValueChange={(v) => setQualityConfig({ quality: v[0] })}
            className="w-20"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 text-right">{qualityConfig.quality}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Max width</span>
        <Input
          type="number"
          value={qualityConfig.maxWidth}
          onChange={(e) => setQualityConfig({ maxWidth: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-medium">Max height</span>
        <Input
          type="number"
          value={qualityConfig.maxHeight}
          onChange={(e) => setQualityConfig({ maxHeight: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5 rounded-lg"
        />
      </div>
    </motion.div>
  )
}

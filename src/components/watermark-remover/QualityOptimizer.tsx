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

export default function QualityOptimizer() {
  const { qualityConfig, setQualityConfig } = useAppStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5 rounded-md border bg-card p-3"
    >
      <div className="flex items-center gap-1.5">
        <Settings2 className="size-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">Quality</Label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/50">Format</span>
        <Select
          value={qualityConfig.format}
          onValueChange={(v) => setQualityConfig({ format: v as 'jpeg' | 'png' | 'webp' })}
        >
          <SelectTrigger className="w-[3.5rem] h-6 text-[10px]">
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground/50">Quality</span>
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/50">Max W</span>
        <Input
          type="number"
          value={qualityConfig.maxWidth}
          onChange={(e) => setQualityConfig({ maxWidth: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/50">Max H</span>
        <Input
          type="number"
          value={qualityConfig.maxHeight}
          onChange={(e) => setQualityConfig({ maxHeight: Number(e.target.value) || 4096 })}
          className="w-[3.5rem] h-6 text-[10px] px-1.5"
        />
      </div>
    </motion.div>
  )
}

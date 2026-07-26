'use client'

import { useCallback, useRef } from 'react'
import { Type, Upload, ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
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

export default function WatermarkAdder() {
  const { watermarkConfig, setWatermarkConfig } = useAppStore()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setWatermarkConfig({ logoFile: file })
      }
    },
    [setWatermarkConfig]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Text */}
      <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
        <div className="flex items-center gap-1.5">
          <Type className="size-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Text</Label>
        </div>

        <Input
          value={watermarkConfig.text}
          onChange={(e) => setWatermarkConfig({ text: e.target.value })}
          placeholder="Watermark text"
          className="h-7 text-xs"
        />

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
          <span className="text-[10px] tabular-nums text-muted-foreground/50 w-5 text-right">{watermarkConfig.opacity}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">Color</span>
          <div className="flex items-center gap-1.5">
            <div
              className="size-4 rounded border cursor-pointer"
              style={{ backgroundColor: watermarkConfig.color }}
            />
            <Input
              value={watermarkConfig.color}
              onChange={(e) => setWatermarkConfig({ color: e.target.value })}
              className="w-[4.5rem] h-6 text-[10px] px-1.5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-muted-foreground/50">Position</span>
          <div className="grid grid-cols-3 gap-0.5">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setWatermarkConfig({ position: pos })}
                className={`
                  flex size-7 items-center justify-center rounded text-[10px] transition-all
                  ${watermarkConfig.position === pos
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                  }
                `}
              >
                {POS_ICONS[pos]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Logo</Label>
        </div>

        <div
          onClick={() => logoInputRef.current?.click()}
          className="flex cursor-pointer items-center justify-center rounded-md border border-dashed bg-muted/20 p-2 hover:border-primary/40 transition-colors"
        >
          {watermarkConfig.logoFile ? (
            <span className="text-[10px] text-muted-foreground">{watermarkConfig.logoFile.name}</span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="size-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50">Upload</span>
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
              <span className="text-[10px] text-muted-foreground/50">Position</span>
              <div className="grid grid-cols-3 gap-0.5">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setWatermarkConfig({ logoPosition: pos })}
                    className={`
                      flex size-7 items-center justify-center rounded text-[10px] transition-all
                      ${watermarkConfig.logoPosition === pos
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                      }
                    `}
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
              className="self-start h-6 text-[10px]"
            >
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

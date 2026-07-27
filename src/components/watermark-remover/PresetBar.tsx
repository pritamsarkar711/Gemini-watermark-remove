'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Plus, X, Trash2, Check } from 'lucide-react'
import { useAppStore, BUILT_IN_PRESETS, type WatermarkPreset } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Preset bar — quick-apply watermark templates.
 *
 * Renders two groups:
 *  1. Built-in presets (© 2025, DRAFT, CONFIDENTIAL, SAMPLE, DO NOT COPY, Gemini)
 *  2. User-saved custom presets (persisted to localStorage)
 *
 * Clicking a preset applies its text + style to the current watermarkConfig
 * (logoFile is preserved). Users can also save the current config as a new
 * custom preset by typing a name and clicking the + button.
 */
export default function PresetBar() {
  const {
    watermarkConfig,
    customPresets,
    addCustomPreset,
    removeCustomPreset,
    applyPreset,
  } = useAppStore()

  const [isSaving, setIsSaving] = useState(false)
  const [presetName, setPresetName] = useState('')

  const handleSave = () => {
    const name = presetName.trim()
    if (!name) return
    // Require some text or a logo to be set before saving
    if (!watermarkConfig.text && !watermarkConfig.logoFile) return

    const preset: WatermarkPreset = {
      id: `custom-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      label: name.length > 14 ? name.slice(0, 12) + '…' : name,
      text: watermarkConfig.text,
      fontSize: watermarkConfig.fontSize,
      color: watermarkConfig.color,
      opacity: watermarkConfig.opacity,
      rotation: watermarkConfig.rotation,
      shadow: watermarkConfig.shadow,
      repeat: watermarkConfig.repeat,
    }
    addCustomPreset(preset)
    setPresetName('')
    setIsSaving(false)
  }

  // Check if the current config matches any preset (for the active highlight)
  const isPresetActive = (p: WatermarkPreset): boolean =>
    watermarkConfig.text === p.text &&
    watermarkConfig.fontSize === p.fontSize &&
    watermarkConfig.color === p.color &&
    watermarkConfig.opacity === p.opacity &&
    watermarkConfig.rotation === p.rotation &&
    watermarkConfig.shadow === p.shadow &&
    watermarkConfig.repeat === p.repeat

  const allPresets = [...BUILT_IN_PRESETS, ...customPresets]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bookmark className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold">Presets</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSaving((v) => !v)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          title="Save current settings as a preset"
        >
          <Plus className="size-2.5" />
          Save
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allPresets.map((preset) => {
          const active = isPresetActive(preset)
          const isCustom = preset.id.startsWith('custom-')
          return (
            <motion.button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className={`group relative flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all shadow-sm ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-card/80 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
              title={`Apply "${preset.label}" preset`}
            >
              {active && <Check className="size-2.5" />}
              <span className="truncate max-w-[80px]">{preset.label}</span>
              {isCustom && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeCustomPreset(preset.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      removeCustomPreset(preset.id)
                    }
                  }}
                  className="ml-0.5 -mr-1 flex size-3.5 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                  title="Delete preset"
                >
                  <X className="size-2.5" />
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') {
                    setIsSaving(false)
                    setPresetName('')
                  }
                }}
                placeholder="Preset name"
                autoFocus
                className="h-7 flex-1 text-xs rounded-lg"
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!presetName.trim() || (!watermarkConfig.text && !watermarkConfig.logoFile)}
                className="h-7 rounded-lg text-[10px] gap-1"
              >
                <Plus className="size-2.5" />
                Add
              </Button>
            </div>
            {(!watermarkConfig.text && !watermarkConfig.logoFile) && (
              <p className="pt-1 text-[9px] text-muted-foreground/60">
                Set watermark text or upload a logo first
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

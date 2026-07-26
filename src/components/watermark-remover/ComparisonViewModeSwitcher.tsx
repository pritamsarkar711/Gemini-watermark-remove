'use client'

import { motion } from 'framer-motion'
import { ArrowLeftRight, Columns2, Layers } from 'lucide-react'
import { useAppStore, type ComparisonMode } from '@/lib/store'

const MODE_OPTIONS: { mode: ComparisonMode; icon: typeof ArrowLeftRight; label: string }[] = [
  { mode: 'slider', icon: ArrowLeftRight, label: 'Slider' },
  { mode: 'side-by-side', icon: Columns2, label: 'Side-by-side' },
  { mode: 'overlay', icon: Layers, label: 'Overlay' },
]

export default function ComparisonViewModeSwitcher() {
  const { comparisonMode, setComparisonMode } = useAppStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-center gap-0.5"
    >
      <div className="inline-flex items-center rounded-full border bg-card/80 p-0.5 shadow-sm backdrop-blur-sm">
        {MODE_OPTIONS.map(({ mode, icon: Icon, label }) => {
          const isActive = comparisonMode === mode
          return (
            <button
              key={mode}
              onClick={() => setComparisonMode(mode)}
              className={`relative flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={label}
              aria-label={`Switch to ${label} comparison view`}
              aria-pressed={isActive}
            >
              <Icon className="size-3" />
              <span className="hidden sm:inline">{label}</span>
              {isActive && (
                <motion.div
                  layoutId="comparison-mode-active"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  style={{ zIndex: -1 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

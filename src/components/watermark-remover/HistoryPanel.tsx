'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Eraser,
  Stamp,
  RotateCw,
  Settings2,
  RotateCcw,
  Circle,
  History as HistoryIcon,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { useAppStore, type LastAction } from '@/lib/store'

// ─── Action metadata ────────────────────────────────────────────────────────

interface ActionMeta {
  label: string
  Icon: typeof Upload
}

const ACTION_META: Record<LastAction | 'initial', ActionMeta> = {
  upload: { label: 'Image uploaded', Icon: Upload },
  'remove-watermark': { label: 'Watermark removed', Icon: Eraser },
  'add-watermark': { label: 'Watermark added', Icon: Stamp },
  transform: { label: 'Image transformed', Icon: RotateCw },
  optimize: { label: 'Quality optimized', Icon: Settings2 },
  reset: { label: 'Editor reset', Icon: RotateCcw },
  initial: { label: 'Initial state', Icon: Circle },
}

function getActionMeta(action: LastAction | null): ActionMeta {
  if (action === null) return ACTION_META.initial
  return ACTION_META[action]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPanel() {
  const { history, historyIndex, jumpTo, reset } = useAppStore()
  const [isOpen, setIsOpen] = useState(true)

  // Newest first — but keep the index labels reflecting chronological order
  // (history[0] is "#1", the initial state)
  const reversed = [...history].map((snapshot, idx) => ({
    snapshot,
    originalIndex: idx,
  })).reverse()

  const actionCount = Math.max(0, history.length - 1) // exclude the initial state from the visible "actions" count

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex flex-col rounded-lg shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      {/* Header (click to toggle) */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="sidebar-panel-header flex items-center justify-between gap-2 p-2.5 text-left"
        aria-expanded={isOpen}
        aria-controls="history-panel-body"
      >
        <div className="flex items-center gap-1.5">
          <HistoryIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
            History
          </span>
          {actionCount > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground/70">
              {actionCount} {actionCount === 1 ? 'action' : 'actions'}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground/50"
        >
          <ChevronDown className="size-3.5" />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="history-panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              <ul className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-0.5">
                {reversed.map(({ snapshot, originalIndex }) => {
                  const meta = getActionMeta(snapshot.lastAction)
                  const Icon = meta.Icon
                  const isCurrent = originalIndex === historyIndex
                  const isFuture = originalIndex > historyIndex
                  const stepNumber = originalIndex + 1

                  return (
                    <li key={originalIndex}>
                      <button
                        type="button"
                        onClick={() => jumpTo(originalIndex)}
                        className={`group relative w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all ${
                          isCurrent
                            ? 'bg-primary/10 border-l-[3px] border-primary shadow-[inset_2px_0_8px_-2px_var(--primary)]'
                            : 'border-l-2 border-transparent hover:bg-accent/40'
                        } ${isFuture ? 'opacity-40' : 'opacity-100'}`}
                        aria-current={isCurrent ? 'step' : undefined}
                        title={isCurrent ? 'Current state' : isFuture ? 'Future state — click to redo to here' : 'Click to restore'}
                      >
                        <Icon
                          className={`size-3.5 shrink-0 ${
                            isCurrent
                              ? 'text-primary'
                              : 'text-muted-foreground/60 group-hover:text-foreground'
                          }`}
                        />
                        <span
                          className={`flex-1 truncate text-sm font-medium ${
                            isCurrent ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {meta.label}
                        </span>
                        <span className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground/40">
                          #{stepNumber}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {/* Footer: clear history */}
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-xs text-muted-foreground/40">
                  {historyIndex + 1} / {history.length}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={history.length <= 1}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                    history.length <= 1
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10'
                  }`}
                  title="Clear all history and reset editor"
                >
                  <Trash2 className="size-3" />
                  Clear history
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

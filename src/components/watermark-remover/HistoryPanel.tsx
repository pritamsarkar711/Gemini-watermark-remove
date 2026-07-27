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
  CheckCircle2,
} from 'lucide-react'
import { useAppStore, type LastAction } from '@/lib/store'

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
  return action === null ? ACTION_META.initial : ACTION_META[action]
}

/** A compact, expandable timeline that matches the resize and adjustments cards. */
export default function HistoryPanel() {
  const { history, historyIndex, jumpTo, reset } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)

  const newestFirst = [...history]
    .map((snapshot, originalIndex) => ({ snapshot, originalIndex }))
    .reverse()
  const actionCount = Math.max(0, history.length - 1)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex max-w-full flex-col gap-2.5 overflow-hidden rounded-xl p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md sm:p-4"
      aria-label="Edit history"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="sidebar-panel-header flex min-h-8 w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
        aria-controls="history-panel-body"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <HistoryIcon className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">History</span>
            <span className="text-xs font-medium text-muted-foreground">Restore any previous edit</span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary">
            {actionCount} {actionCount === 1 ? 'edit' : 'edits'}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground"
          >
            <ChevronDown className="size-4" />
          </motion.span>
        </span>
      </button>

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
            <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
              <div className="rounded-xl border border-border/70 bg-muted/35 p-1.5">
                <ul className="custom-scrollbar flex max-h-64 flex-col gap-1 overflow-x-hidden overflow-y-auto pr-0.5">
                  {newestFirst.map(({ snapshot, originalIndex }) => {
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
                          className={`group flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                            isCurrent
                              ? 'border-primary/35 bg-primary text-primary-foreground shadow-sm'
                              : 'border-transparent bg-card/70 hover:border-primary/20 hover:bg-primary/5'
                          } ${isFuture && !isCurrent ? 'opacity-55' : ''}`}
                          aria-current={isCurrent ? 'step' : undefined}
                          title={isCurrent ? 'Current version' : 'Restore this version'}
                        >
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${isCurrent ? 'bg-white/15' : 'bg-primary/10 text-primary'}`}>
                            {isCurrent ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{meta.label}</span>
                            <span className={`block text-xs ${isCurrent ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                              {isCurrent ? 'Current version' : isFuture ? 'Available to redo' : 'Click to restore'}
                            </span>
                          </span>
                          <span className={`shrink-0 text-xs font-bold tabular-nums ${isCurrent ? 'text-primary-foreground/80' : 'text-muted-foreground/75'}`}>
                            #{stepNumber}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Showing version {historyIndex + 1} of {history.length}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={history.length <= 1}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                  title="Start over with a new image"
                >
                  <Trash2 className="size-3.5" />
                  Start over
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

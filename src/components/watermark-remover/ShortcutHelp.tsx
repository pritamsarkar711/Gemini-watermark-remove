'use client'

import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Shortcut data ──────────────────────────────────────────────────────────

interface Shortcut {
  /** One or more keycap labels, e.g. ["Ctrl", "Z"] or ["1"]. Multi-element arrays render as `+`-joined keycaps. */
  keys: string[]
  /** Human-readable description. */
  label: string
}

interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: ['Ctrl', 'Z'], label: 'Undo last action' },
      { keys: ['Ctrl', 'Y'], label: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo (alternate)' },
      { keys: ['Ctrl', 'S'], label: 'Download result' },
      { keys: ['Ctrl', 'C'], label: 'Copy result to clipboard' },
      { keys: ['?'], label: 'Open this help' },
      { keys: ['Esc'], label: 'Close dialogs' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: ['R'], label: 'Rotate image 90°' },
      { keys: ['H'], label: 'Flip horizontal' },
      { keys: ['V'], label: 'Flip vertical' },
      { keys: ['1'], label: 'Switch to Remove mode' },
      { keys: ['2'], label: 'Switch to Add mode' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: ['←'], label: 'Move comparison slider left' },
      { keys: ['→'], label: 'Move comparison slider right' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface ShortcutHelpProps {
  /** Controlled open state. */
  open: boolean
  /** Controlled open-state setter. */
  onOpenChange: (open: boolean) => void
  /** When true, render the floating action button (FAB) trigger. Defaults to true. */
  showFab?: boolean
}

export default function ShortcutHelp({
  open,
  onOpenChange,
  showFab = true,
}: ShortcutHelpProps) {
  return (
    <>
      {showFab && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed bottom-4 right-4 z-40 flex size-10 items-center justify-center rounded-full border bg-card/90 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:bg-card hover:text-foreground hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Open keyboard shortcuts help"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="size-5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Speed up your workflow with these shortcuts. Available in the editor view.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="flex flex-col gap-1.5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.title}
                </h3>
                <dl className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-accent/40 transition-colors"
                    >
                      <dt className="text-xs text-foreground/90">{item.label}</dt>
                      <dd className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, i) => (
                          <span key={key} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-[10px] text-muted-foreground/40">+</span>
                            )}
                            <kbd className="bg-muted border rounded px-1.5 py-0.5 text-[10px] font-mono shadow-sm">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <p className="border-t pt-3 text-center text-[10px] text-muted-foreground/50">
            Press <kbd className="bg-muted border rounded px-1 py-0.5 text-[10px] font-mono shadow-sm">?</kbd> anytime to open this dialog
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

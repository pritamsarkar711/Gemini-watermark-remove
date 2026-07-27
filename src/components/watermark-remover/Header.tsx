'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Eraser, Sun, Moon, Plus } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

export default function Header() {
  const { reset, originalImage, step } = useAppStore()
  const { theme, setTheme } = useTheme()
  // Safe hydration: mounted is true only on the client, avoiding SSR/client mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-50 w-full"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/40 to-transparent backdrop-blur-md" />

      {/* Bottom border with gradient effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm">
            <Eraser className="size-4 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-1 leading-none">
            <span className="gradient-text text-lg font-semibold tracking-tight brand-shadow">Gemini Watermark</span>
            {step !== 'upload' && (
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_60%,transparent)]" />
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* New Image button - only in editor mode */}
          <AnimatePresence>
            {step !== 'upload' && originalImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.9, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New Image</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dark mode toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === 'dark' ? (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Sun className="size-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Moon className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  )
}

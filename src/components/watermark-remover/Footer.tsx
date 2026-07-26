'use client'

import { Eraser, Heart, Github, Keyboard } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-muted/30 to-transparent">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <Eraser className="size-3" />
          <span className="text-[12px] font-medium hover:text-primary transition-colors cursor-default">Zeminai</span>
        </div>

        {/* Center: keyboard shortcut hints */}
        <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
          <Keyboard className="size-3" />
          <span>
            <kbd className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium">Ctrl+Z</kbd> Undo
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            <kbd className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium">?</kbd> Help
          </span>
        </div>

        {/* Right: credits + version */}
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70">
          <div className="flex items-center gap-1">
            <Heart className="size-2.5 text-primary/50" />
            <span className="hidden sm:inline">Built with care</span>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <span className="rounded-full border bg-card/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">© 2025 v1.1</span>
        </div>
      </div>
    </footer>
  )
}

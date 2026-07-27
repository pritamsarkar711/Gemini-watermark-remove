'use client'

import { Eraser, Heart, Keyboard, Github } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-muted/40 via-muted/20 to-transparent backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 gap-3">
        {/* Brand cluster */}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/15">
            <Eraser className="size-3 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground/80">Gemini</span>
          <span className="hidden sm:inline text-xs text-muted-foreground/60">·</span>
          <span className="hidden sm:inline text-xs font-medium text-muted-foreground">Watermark Remover</span>
        </div>

        {/* Center: keyboard shortcut hints — visually grouped */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-border/60 bg-card/60 shadow-sm">
          <Keyboard className="size-3 text-muted-foreground" />
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">Ctrl+Z</kbd>
          <span className="text-xs text-muted-foreground font-medium">Undo</span>
          <span className="text-muted-foreground/30">·</span>
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">?</kbd>
          <span className="text-xs text-muted-foreground font-medium">Help</span>
        </div>

        {/* Right: credits + version */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="size-2.5 text-primary/60" />
            <span className="hidden sm:inline font-medium">Built with care</span>
          </div>
          <span className="text-muted-foreground/30">·</span>
          <span className="rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground shadow-sm">v1.2</span>
        </div>
      </div>
    </footer>
  )
}

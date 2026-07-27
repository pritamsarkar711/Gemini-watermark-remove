'use client'

import { Eraser, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto w-full gradient-border-top bg-gradient-to-t from-muted/40 via-muted/20 to-transparent backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 gap-3">
        {/* Brand cluster */}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/15">
            <Eraser className="size-3 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground/80">Gemini Watermark</span>
        </div>

        {/* Right: credits + version */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="size-2.5 text-primary" />
            <span className="font-medium">Built with <Heart className="size-2.5 text-primary inline" /> by Jogulberg</span>
            <span className="text-muted-foreground/40">·</span>
            <a
              href="https://t.me/joegoldberg2025"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              @joegoldberg2025
            </a>
          </div>
          <span className="text-muted-foreground/30">·</span>
          <span className="rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground shadow-sm">v1.2</span>
        </div>
      </div>
    </footer>
  )
}

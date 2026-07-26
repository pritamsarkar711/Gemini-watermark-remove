'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Stamp, Scan, Download, Sparkles, Undo2, Redo2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import Header from '@/components/watermark-remover/Header'
import UploadArea from '@/components/watermark-remover/UploadArea'
import ImagePreview from '@/components/watermark-remover/ImagePreview'
import ComparisonSlider from '@/components/watermark-remover/ComparisonSlider'
import ControlPanel from '@/components/watermark-remover/ControlPanel'
import AdjustPanel from '@/components/watermark-remover/AdjustPanel'
import QualityOptimizer from '@/components/watermark-remover/QualityOptimizer'
import DownloadPanel from '@/components/watermark-remover/DownloadPanel'
import HistoryPanel from '@/components/watermark-remover/HistoryPanel'
import ShortcutHelp from '@/components/watermark-remover/ShortcutHelp'
import Footer from '@/components/watermark-remover/Footer'

export default function Home() {
  const {
    step,
    originalImage,
    processedImage,
    showComparison,
    canUndo,
    canRedo,
    undo,
    redo,
    setTransformConfig,
    transformConfig,
    setMode,
    outputFileName,
    qualityConfig,
  } = useAppStore()

  const [showHelp, setShowHelp] = useState(false)

  // ─── Basic download / copy (used by Ctrl+S / Ctrl+C) ───────────────────────
  // Note: these bypass the optional optimization layer in DownloadPanel and
  // always use the raw processedImage.dataUrl. For the optimized output, the
  // user should still click the Download button in the sidebar.
  const handleQuickDownload = useCallback(() => {
    if (!processedImage?.dataUrl) return
    const ext = qualityConfig.format === 'jpeg' ? 'jpg' : qualityConfig.format === 'webp' ? 'webp' : 'png'
    const link = document.createElement('a')
    link.href = processedImage.dataUrl
    link.download = `${outputFileName || 'processed'}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [processedImage, outputFileName, qualityConfig.format])

  const handleQuickCopy = useCallback(async () => {
    if (!processedImage?.dataUrl) return
    try {
      const blob = await fetch(processedImage.dataUrl).then((r) => r.blob())
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
    } catch {
      try {
        await navigator.clipboard.writeText(processedImage.dataUrl)
      } catch {
        console.error('Copy failed')
      }
    }
  }, [processedImage])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Undo / Redo (works everywhere) ───────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

      // ── Ctrl+S: download (prevent browser save) ─────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleQuickDownload()
        return
      }

      // ── Ctrl+C: copy result to clipboard (only when not typing & no text selected) ─
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isTypingTarget(e.target)) {
        // Only intercept if there's a processed image to copy AND the user
        // hasn't selected text on the page (let native copy win in that case)
        const hasTextSelection = typeof window !== 'undefined'
          && !!window.getSelection?.()?.toString()
        if (processedImage?.dataUrl && !hasTextSelection) {
          e.preventDefault()
          void handleQuickCopy()
        }
        return
      }

      // ── Escape: close help dialog (if open) ─────────────────────────────
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false)
        }
        return
      }

      // Skip the remaining editor-mode shortcuts when typing in a field
      if (isTypingTarget(e.target)) return
      // Skip when a modifier (other than shift for `?`) is held
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // ── `?` opens the help dialog (editor mode only) ────────────────────
      if (e.key === '?' && step !== 'upload') {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Below shortcuts only apply in editor mode
      if (step === 'upload') return

      // ── R / H / V: transforms ───────────────────────────────────────────
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setTransformConfig({ rotation: (transformConfig.rotation + 90) % 360 })
        return
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        setTransformConfig({ flipH: !transformConfig.flipH })
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setTransformConfig({ flipV: !transformConfig.flipV })
        return
      }

      // ── 1 / 2: switch mode ──────────────────────────────────────────────
      if (e.key === '1') {
        e.preventDefault()
        setMode('remove')
        return
      }
      if (e.key === '2') {
        e.preventDefault()
        setMode('add')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    undo,
    redo,
    handleQuickDownload,
    handleQuickCopy,
    showHelp,
    step,
    setTransformConfig,
    transformConfig,
    setMode,
    processedImage,
  ])

  const isEditor = step !== 'upload'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] gap-6"
              >
                <UploadArea />
              </motion.div>
            )}

            {(step === 'preview' || step === 'processing' || step === 'result') && originalImage && (
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {/* Undo/redo bar */}
                <AnimatePresence>
                  {(canUndo || canRedo) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-1.5"
                    >
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                          canUndo
                            ? 'bg-muted text-foreground hover:bg-accent'
                            : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                        title="Undo (Ctrl+Z)"
                      >
                        <Undo2 className="size-3" />
                        Undo
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                          canRedo
                            ? 'bg-muted text-foreground hover:bg-accent'
                            : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                        title="Redo (Ctrl+Y)"
                      >
                        <Redo2 className="size-3" />
                        Redo
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                  {/* Image area */}
                  <div className="flex flex-col gap-2">
                    {showComparison && processedImage ? (
                      <ComparisonSlider />
                    ) : (
                      <ImagePreview />
                    )}
                  </div>

                  {/* Controls sidebar */}
                  <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto custom-scrollbar">
                    <ControlPanel />

                    {/* Image adjustments — available whenever an image is loaded */}
                    <AdjustPanel />

                    {processedImage && step === 'result' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-3"
                      >
                        <QualityOptimizer />
                        <DownloadPanel />
                      </motion.div>
                    )}

                    {/* History timeline — always visible in editor mode */}
                    <HistoryPanel />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />

      {/* Keyboard shortcuts help (FAB + dialog) — editor mode only */}
      {isEditor && (
        <ShortcutHelp open={showHelp} onOpenChange={setShowHelp} />
      )}
    </div>
  )
}

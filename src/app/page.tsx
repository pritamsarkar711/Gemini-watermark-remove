'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Stamp, Scan, Download, Sparkles, Undo2, Redo2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import Header from '@/components/watermark-remover/Header'
import UploadArea from '@/components/watermark-remover/UploadArea'
import ImagePreview from '@/components/watermark-remover/ImagePreview'
import ComparisonSlider from '@/components/watermark-remover/ComparisonSlider'
import ControlPanel from '@/components/watermark-remover/ControlPanel'
import QualityOptimizer from '@/components/watermark-remover/QualityOptimizer'
import DownloadPanel from '@/components/watermark-remover/DownloadPanel'
import Footer from '@/components/watermark-remover/Footer'

export default function Home() {
  const { step, originalImage, processedImage, showComparison, canUndo, canRedo, undo, redo } = useAppStore()

  // Keyboard shortcuts: Ctrl+Z for undo, Ctrl+Y or Ctrl+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

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
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  )
}

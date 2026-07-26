'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Stamp, Scan, Download, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import Header from '@/components/watermark-remover/Header'
import UploadArea from '@/components/watermark-remover/UploadArea'
import ImagePreview from '@/components/watermark-remover/ImagePreview'
import ComparisonSlider from '@/components/watermark-remover/ComparisonSlider'
import ControlPanel from '@/components/watermark-remover/ControlPanel'
import QualityOptimizer from '@/components/watermark-remover/QualityOptimizer'
import DownloadPanel from '@/components/watermark-remover/DownloadPanel'
import Footer from '@/components/watermark-remover/Footer'

const FEATURES = [
  { icon: Scan, label: 'Auto detect' },
  { icon: Eraser, label: 'Inpaint' },
  { icon: Stamp, label: 'Add mark' },
  { icon: Download, label: 'Export' },
]

export default function Home() {
  const { step, originalImage, processedImage, showComparison } = useAppStore()

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
                className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] gap-6"
              >
                <UploadArea />

                {/* Feature badges */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="flex flex-wrap items-center justify-center gap-3 mt-2"
                >
                  {FEATURES.map((feature, i) => (
                    <motion.div
                      key={feature.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
                      className="flex items-center gap-1.5 rounded-full border bg-card/50 px-3 py-1"
                    >
                      <feature.icon className="size-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/60">{feature.label}</span>
                    </motion.div>
                  ))}
                </motion.div>
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
                  <div className="flex flex-col gap-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto custom-scrollbar">
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

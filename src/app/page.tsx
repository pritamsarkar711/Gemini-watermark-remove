'use client'

import { AnimatePresence, motion } from 'framer-motion'
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
                className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)]"
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

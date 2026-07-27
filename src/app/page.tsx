'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eraser, Stamp } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import Header from '@/components/watermark-remover/Header'
import UploadArea from '@/components/watermark-remover/UploadArea'
import ImagePreview from '@/components/watermark-remover/ImagePreview'
import ComparisonSlider from '@/components/watermark-remover/ComparisonSlider'
import ComparisonViewModeSwitcher from '@/components/watermark-remover/ComparisonViewModeSwitcher'
import SideBySideView from '@/components/watermark-remover/SideBySideView'
import OverlayView from '@/components/watermark-remover/OverlayView'
import ControlPanel from '@/components/watermark-remover/ControlPanel'
import CropPanel from '@/components/watermark-remover/CropPanel'
import ResizePanel from '@/components/watermark-remover/ResizePanel'
import AdjustPanel from '@/components/watermark-remover/AdjustPanel'
import QualityOptimizer from '@/components/watermark-remover/QualityOptimizer'
import DownloadPanel from '@/components/watermark-remover/DownloadPanel'
import HistoryPanel from '@/components/watermark-remover/HistoryPanel'
import BatchPanel from '@/components/watermark-remover/BatchPanel'
import ImageInfoPanel from '@/components/watermark-remover/ImageInfoPanel'
import StickyCTA from '@/components/watermark-remover/StickyCTA'
import Footer from '@/components/watermark-remover/Footer'

export default function Home() {
  const {
    step,
    originalImage,
    processedImage,
    showComparison,
    comparisonMode,
  } = useAppStore()

  const isEditor = step !== 'upload'

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <Header />

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 sm:py-6">
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
                className="flex flex-col gap-4 sm:gap-6 max-w-full overflow-x-hidden"
              >
                {/* ── Image Preview Area ─────────────────────────────────────── */}
                <div className="flex flex-col gap-3 max-w-full overflow-hidden">
                  {showComparison && processedImage && (
                    <ComparisonViewModeSwitcher />
                  )}
                  {showComparison && processedImage ? (
                    comparisonMode === 'slider' ? (
                      <ComparisonSlider />
                    ) : comparisonMode === 'side-by-side' ? (
                      <SideBySideView />
                    ) : (
                      <OverlayView />
                    )
                  ) : (
                    <ImagePreview />
                  )}
                </div>

                {/* ── Controls Section — stacked below preview ─────────────── */}
                <div className="flex flex-col gap-3 sm:gap-4 max-w-full overflow-hidden">
                  <ControlPanel />

                  {/* Image info panel — before/after stats when result available */}
                  {processedImage && step === 'result' && <ImageInfoPanel />}

                  <CropPanel />
                  <ResizePanel />
                  <AdjustPanel />

                  {processedImage && step === 'result' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-3 sm:gap-4 max-w-full overflow-hidden"
                    >
                      <QualityOptimizer />
                      <DownloadPanel />
                    </motion.div>
                  )}

                  <HistoryPanel />
                  <BatchPanel />

                  {/* Sticky primary CTA */}
                  <StickyCTA />
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

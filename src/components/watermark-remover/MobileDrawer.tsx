'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import ControlPanel from './ControlPanel'
import CropPanel from './CropPanel'
import ResizePanel from './ResizePanel'
import AdjustPanel from './AdjustPanel'
import QualityOptimizer from './QualityOptimizer'
import DownloadPanel from './DownloadPanel'
import HistoryPanel from './HistoryPanel'
import StickyCTA from './StickyCTA'
import BatchPanel from './BatchPanel'
import { useAppStore } from '@/lib/store'

/**
 * MobileDrawer — A bottom drawer that appears on mobile screens (below lg breakpoint)
 * to host all sidebar controls. On desktop (lg+), the sidebar is rendered inline.
 * 
 * This component renders:
 * - A floating "Edit tools" button that opens the drawer
 * - The drawer content with all sidebar panels
 */
export default function MobileDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const { processedImage, step, isProcessing, mode } = useAppStore()

  if (step === 'upload') return null

  return (
    <>
      {/* Floating "Edit tools" button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all lg:hidden"
        aria-label="Open editing tools"
      >
        <SlidersHorizontal className="size-4" />
        {isProcessing ? 'Processing...' : mode === 'remove' ? 'Remove tools' : 'Add tools'}
      </motion.button>

      {/* Bottom drawer with all controls */}
      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="bottom">
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="size-4 text-primary" />
              Editing Tools
            </DrawerTitle>
            <DrawerDescription className="text-[10px]">
              Adjust watermark removal, add watermarks, crop, resize, and more.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-3 px-4 pb-4 overflow-y-auto custom-scrollbar max-h-[70vh]">
            <ControlPanel />
            <CropPanel />
            <ResizePanel />
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

            <HistoryPanel />
            <BatchPanel />
          </div>

          {/* Sticky CTA inside drawer */}
          <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-md px-4 py-3 mt-auto">
            <StickyCTA />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

'use client'

import { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Images, Loader2, CheckCircle2, XCircle, Trash2, ChevronDown, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAppStore, type ImageInfo } from '@/lib/store'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

interface BatchItem {
  id: string
  file: File
  name: string
  status: 'pending' | 'processing' | 'done' | 'error'
  resultDataUrl?: string
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * BatchPanel — A panel for batch processing multiple images.
 * Users can add multiple images to a queue, then process them all
 * (removing watermarks) with one click. Results are shown with
 * individual status indicators.
 *
 * This is an additive feature — clicking a result item will load that
 * image into the main editor for further editing.
 */
export default function BatchPanel() {
  const { originalImage, autoDetect, mode } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<BatchItem[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: BatchItem[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_SIZE) continue
      newItems.push({
        id: `batch-${Date.now()}-${file.name}`,
        file,
        name: file.name,
        status: 'pending',
      })
    }
    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems])
      toast({ title: `${newItems.length} images added`, description: 'Images added to batch queue.' })
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    setCurrentIdx(-1)
  }, [])

  const processBatch = useCallback(async () => {
    if (items.length === 0) return

    setIsBatchProcessing(true)
    const updatedItems = [...items]

    for (let i = 0; i < updatedItems.length; i++) {
      if (updatedItems[i].status === 'done') continue

      setCurrentIdx(i)
      updatedItems[i].status = 'processing'

      setItems([...updatedItems])

      try {
        const formData = new FormData()
        formData.append('image', updatedItems[i].file)
        formData.append('autoDetect', String(autoDetect))

        const res = await fetch('/api/remove-watermark', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()

        if (data.success) {
          updatedItems[i].status = 'done'
          updatedItems[i].resultDataUrl = data.result.dataUrl
        } else {
          updatedItems[i].status = 'error'
          updatedItems[i].error = data.error || 'Processing failed'
        }
      } catch (err) {
        updatedItems[i].status = 'error'
        updatedItems[i].error = 'Network error'
      }

      setItems([...updatedItems])
    }

    setIsBatchProcessing(false)
    setCurrentIdx(-1)

    const doneCount = updatedItems.filter((i) => i.status === 'done').length
    const errCount = updatedItems.filter((i) => i.status === 'error').length

    if (errCount === 0) {
      toast({ title: 'Batch complete', description: `${doneCount} images processed successfully.` })
    } else {
      toast({ title: 'Batch complete', description: `${doneCount} succeeded, ${errCount} failed.`, variant: 'destructive' })
    }
  }, [items, autoDetect])

  const downloadAll = useCallback(() => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultDataUrl)
    for (const item of doneItems) {
      const link = document.createElement('a')
      link.href = item.resultDataUrl!
      link.download = item.name.replace(/\.[^.]+$/, '') + '_processed.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    toast({ title: 'Downloads started', description: `${doneItems.length} images being downloaded.` })
  }, [items])

  const pendingCount = items.filter((i) => i.status === 'pending').length
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const total = items.length

  if (!originalImage) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex flex-col rounded-lg shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md hover:border-border"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="sidebar-panel-header flex items-center justify-between gap-2 p-2.5 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Images className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Batch
          </span>
          {total > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground/70">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearAll() }}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-destructive transition-colors"
            >
              <Trash2 className="size-2.5" />
              Clear
            </button>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground/50"
          >
            <ChevronDown className="size-3.5" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 px-2.5 pb-2.5">
              {/* Add files button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBatchProcessing}
                className="w-full gap-1.5 h-8 text-sm rounded-md"
              >
                <Plus className="size-3" />
                Add images
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />

              {/* Queue list */}
              {items.length > 0 && (
                <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all ${
                        idx === currentIdx
                          ? 'bg-primary/10 border-l-2 border-primary shadow-sm'
                          : item.status === 'done'
                          ? 'bg-primary/5 border-l-2 border-primary/30'
                          : item.status === 'error'
                          ? 'bg-destructive/5 border-l-2 border-destructive/30'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      {/* Status icon */}
                      {item.status === 'processing' && (
                        <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle2 className="size-3 text-primary shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="size-3 text-destructive shrink-0" />
                      )}
                      {item.status === 'pending' && (
                        <span className="size-3 shrink-0 rounded-full border border-muted-foreground/20 bg-muted" />
                      )}

                      {/* File name */}
                      <span className="flex-1 truncate font-medium text-foreground/80">
                        {item.name}
                      </span>

                      {/* Remove button */}
                      {!isBatchProcessing && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                          aria-label="Remove from queue"
                        >
                          <XCircle className="size-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Stats bar */}
              {total > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                  <span>{pendingCount} pending · {doneCount} done · {errorCount} errors</span>
                  <span className="font-mono tabular-nums">{currentIdx >= 0 ? `${currentIdx + 1}/${total}` : ''}</span>
                </div>
              )}

              {/* Process all / Download all buttons */}
              {items.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={processBatch}
                    disabled={isBatchProcessing || pendingCount === 0}
                    className="flex-1 gap-1.5 h-7 text-xs rounded-lg shadow-sm"
                  >
                    {isBatchProcessing ? (
                      <><Loader2 className="size-3 animate-spin" /> Processing...</>
                    ) : (
                      <><Images className="size-3" /> Process all</>
                    )}
                  </Button>
                  {doneCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadAll}
                      className="gap-1.5 h-7 text-xs rounded-md"
                    >
                      <Download className="size-3" />
                      Download
                    </Button>
                  )}
                </div>
              )}

              {/* Empty state */}
              {items.length === 0 && (
                <div className="flex flex-col items-center gap-1 py-3 text-muted-foreground/50">
                  <Images className="size-4" />
                  <span className="text-xs">Add multiple images to process in batch</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Images,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronDown,
  Plus,
  Download,
  UploadCloud,
  Clock3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'

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
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: BatchItem['status']): string {
  if (status === 'processing') return 'Processing'
  if (status === 'done') return 'Ready'
  if (status === 'error') return 'Failed'
  return 'Queued'
}

/** Batch queue styled consistently with the expandable resize and adjustments cards. */
export default function BatchPanel() {
  const { originalImage, autoDetect } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<BatchItem[]>([])
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: BatchItem[] = []
    let skipped = 0

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_SIZE) {
        skipped += 1
        continue
      }
      accepted.push({
        id: `batch-${Date.now()}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        status: 'pending',
      })
    }

    if (accepted.length) {
      setItems((previous) => [...previous, ...accepted])
      setIsOpen(true)
      toast({
        title: `${accepted.length} ${accepted.length === 1 ? 'image' : 'images'} added`,
        description: skipped ? `${skipped} unsupported file${skipped === 1 ? ' was' : 's were'} skipped.` : 'Ready for batch processing.',
      })
    } else if (skipped) {
      toast({
        title: 'No images added',
        description: 'Use PNG, JPEG, or WebP files up to 50 MB.',
        variant: 'destructive',
      })
    }
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    setCurrentIdx(-1)
  }, [])

  const processBatch = useCallback(async () => {
    if (!items.length) return

    setIsBatchProcessing(true)
    const updatedItems = [...items]

    for (let index = 0; index < updatedItems.length; index += 1) {
      if (updatedItems[index].status === 'done') continue

      setCurrentIdx(index)
      updatedItems[index] = { ...updatedItems[index], status: 'processing', error: undefined }
      setItems([...updatedItems])

      try {
        const formData = new FormData()
        formData.append('image', updatedItems[index].file)
        formData.append('autoDetect', String(autoDetect))

        const response = await fetch('/api/remove-watermark', { method: 'POST', body: formData })
        const data = await response.json()

        if (data.success) {
          updatedItems[index] = { ...updatedItems[index], status: 'done', resultDataUrl: data.result.dataUrl }
        } else {
          updatedItems[index] = { ...updatedItems[index], status: 'error', error: data.error || 'Processing failed' }
        }
      } catch {
        updatedItems[index] = { ...updatedItems[index], status: 'error', error: 'Network error' }
      }

      setItems([...updatedItems])
    }

    setIsBatchProcessing(false)
    setCurrentIdx(-1)

    const completed = updatedItems.filter((item) => item.status === 'done').length
    const failed = updatedItems.filter((item) => item.status === 'error').length
    toast({
      title: failed ? 'Batch finished with issues' : 'Batch complete',
      description: failed ? `${completed} complete, ${failed} failed.` : `${completed} images processed successfully.`,
      variant: failed ? 'destructive' : 'default',
    })
  }, [items, autoDetect])

  const downloadAll = useCallback(() => {
    const completed = items.filter((item) => item.status === 'done' && item.resultDataUrl)
    completed.forEach((item) => {
      const link = document.createElement('a')
      link.href = item.resultDataUrl!
      link.download = `${item.name.replace(/\.[^.]+$/, '')}_processed.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
    toast({ title: 'Downloads started', description: `${completed.length} processed images are downloading.` })
  }, [items])

  const pendingCount = items.filter((item) => item.status === 'pending').length
  const doneCount = items.filter((item) => item.status === 'done').length
  const errorCount = items.filter((item) => item.status === 'error').length
  const total = items.length

  if (!originalImage) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sidebar-panel flex max-w-full flex-col gap-2.5 overflow-hidden rounded-xl p-3 shadow-sm transition-all duration-200 hover:bg-card hover:shadow-md sm:p-4"
      aria-label="Batch processing"
    >
      <div className="flex min-h-8 items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="sidebar-panel-header flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          aria-expanded={isOpen}
          aria-controls="batch-panel-body"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Images className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground">Batch processing</span>
              <span className="truncate text-xs font-medium text-muted-foreground">Queue images and process them together</span>
            </span>
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronDown className="size-4" />
          </motion.span>
        </button>

        {total > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary" aria-label={`${total} images in queue`}>
            {total}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="batch-panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBatchProcessing}
                  className="h-10 flex-1 gap-2 rounded-lg border-primary/25 bg-primary/[0.03] text-sm font-semibold hover:border-primary/45 hover:bg-primary/10"
                >
                  <Plus className="size-4" />
                  Add images
                </Button>
                {total > 0 && (
                  <Button
                    variant="ghost"
                    onClick={clearAll}
                    disabled={isBatchProcessing}
                    className="h-10 gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Clear queue
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files)
                  event.target.value = ''
                }}
                className="hidden"
              />

              {total === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.035] px-4 text-center transition-colors hover:border-primary/55 hover:bg-primary/[0.07]"
                >
                  <UploadCloud className="size-6 text-primary" />
                  <span className="text-sm font-bold text-foreground">Build a processing queue</span>
                  <span className="text-xs font-medium text-muted-foreground">PNG, JPEG, or WebP · up to 50 MB each</span>
                </button>
              ) : (
                <>
                  <div className="rounded-xl border border-border/70 bg-muted/35 p-1.5">
                    <div className="custom-scrollbar flex max-h-64 flex-col gap-1.5 overflow-x-hidden overflow-y-auto pr-0.5">
                      {items.map((item, index) => {
                        const isCurrent = index === currentIdx
                        const statusIcon = item.status === 'processing'
                          ? <Loader2 className="size-4 animate-spin text-primary" />
                          : item.status === 'done'
                            ? <CheckCircle2 className="size-4 text-primary" />
                            : item.status === 'error'
                              ? <XCircle className="size-4 text-destructive" />
                              : <Clock3 className="size-4 text-muted-foreground" />

                        return (
                          <div
                            key={item.id}
                            className={`flex min-h-13 items-center gap-3 rounded-lg border px-3 py-2 transition-all ${
                              isCurrent
                                ? 'border-primary/35 bg-primary/10 shadow-sm'
                                : item.status === 'done'
                                  ? 'border-primary/20 bg-card/80'
                                  : item.status === 'error'
                                    ? 'border-destructive/30 bg-destructive/[0.04]'
                                    : 'border-transparent bg-card/70'
                            }`}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background/70 ring-1 ring-border/60">
                              {statusIcon}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                              <span className={`block truncate text-xs font-medium ${item.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {item.error || `${formatSize(item.file.size)} · ${statusLabel(item.status)}`}
                              </span>
                            </span>
                            {!isBatchProcessing && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Remove ${item.name} from queue`}
                              >
                                <XCircle className="size-4" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/55 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>{pendingCount} queued</span>
                    <span className="size-1 rounded-full bg-border" />
                    <span className="text-primary">{doneCount} ready</span>
                    {errorCount > 0 && <><span className="size-1 rounded-full bg-border" /><span className="text-destructive">{errorCount} failed</span></>}
                    {currentIdx >= 0 && <span className="ml-auto tabular-nums text-primary">{currentIdx + 1}/{total}</span>}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={processBatch}
                      disabled={isBatchProcessing || pendingCount === 0}
                      className="h-10 flex-1 gap-2 rounded-lg text-sm font-bold shadow-sm"
                    >
                      {isBatchProcessing ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
                      {isBatchProcessing ? 'Processing queue…' : `Process ${pendingCount} ${pendingCount === 1 ? 'image' : 'images'}`}
                    </Button>
                    {doneCount > 0 && (
                      <Button
                        variant="outline"
                        onClick={downloadAll}
                        className="h-10 gap-2 rounded-lg text-sm font-semibold"
                      >
                        <Download className="size-4" />
                        Download ready
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

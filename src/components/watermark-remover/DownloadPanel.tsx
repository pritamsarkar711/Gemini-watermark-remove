'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Loader2, Minimize2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function DownloadPanel() {
  const { processedImage, originalImage, outputFileName, setOutputFileName, qualityConfig } = useAppStore()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizedDataUrl, setOptimizedDataUrl] = useState<string | null>(null)
  const [optimizedSize, setOptimizedSize] = useState<number | null>(null)
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleDownload = useCallback(() => {
    const dataUrl = optimizedDataUrl || processedImage?.dataUrl
    if (!dataUrl) return

    const format = qualityConfig.format
    const ext = format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${outputFileName || 'processed'}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [optimizedDataUrl, processedImage, outputFileName, qualityConfig.format])

  const handleCopyToClipboard = useCallback(async () => {
    const dataUrl = optimizedDataUrl || processedImage?.dataUrl
    if (!dataUrl) return

    try {
      // Convert dataUrl to blob for clipboard
      const blob = await fetch(dataUrl).then(r => r.blob())
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: just copy the dataUrl string
      try {
        await navigator.clipboard.writeText(dataUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        console.error('Copy failed')
      }
    }
  }, [optimizedDataUrl, processedImage])

  const handleOptimize = useCallback(async () => {
    if (!originalImage) return

    setIsOptimizing(true)
    try {
      const formData = new FormData()
      formData.append('image', originalImage.file)
      formData.append('format', qualityConfig.format)
      formData.append('quality', String(qualityConfig.quality))
      formData.append('maxWidth', String(qualityConfig.maxWidth))
      formData.append('maxHeight', String(qualityConfig.maxHeight))

      const res = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setOptimizedDataUrl(data.result.dataUrl)
        setOptimizedSize(data.result.optimizedSize)
        setCompressionRatio(data.result.compressionRatio)
      }
    } catch (err) {
      console.error('Optimization failed:', err)
    } finally {
      setIsOptimizing(false)
    }
  }, [originalImage, qualityConfig])

  if (!processedImage) return null

  const downloadSize = optimizedSize || processedImage.size

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5"
    >
      {/* Filename */}
      <div className="flex items-center gap-2 rounded-lg border bg-card/80 p-2.5 shadow-sm">
        <FileText className="size-3.5 text-muted-foreground/60" />
        <Input
          value={outputFileName}
          onChange={(e) => setOutputFileName(e.target.value)}
          className="h-6 text-xs flex-1"
          placeholder="File name"
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="gap-1.5 h-7 text-xs rounded-lg"
        >
          {isOptimizing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Minimize2 className="size-3" />
          )}
          {isOptimizing ? 'Optimizing' : 'Optimize'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyToClipboard}
          className="gap-1.5 h-7 text-xs rounded-lg"
        >
          {copied ? (
            <Check className="size-3 text-green-500" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {compressionRatio && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50"
        >
          <span>{Number(compressionRatio) > 0 ? `${compressionRatio}% smaller` : 'Original quality preserved'}</span>
        </motion.div>
      )}

      {/* Download button */}
      <Button
        size="default"
        onClick={handleDownload}
        className="w-full gap-1.5 rounded-lg font-semibold h-10 shadow-md"
      >
        <Download className="size-4" />
        Download
        <span className="text-[10px] opacity-60 ml-1">{formatBytes(downloadSize)}</span>
      </Button>
    </motion.div>
  )
}

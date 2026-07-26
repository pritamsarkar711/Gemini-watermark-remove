# Task 5-a: Add Processing Progress Bar and Format Conversion

## Agent: feature-agent-1

## Summary of Work

### Feature 1: Processing Progress Bar
- **ImagePreview.tsx**: Added 3-stage processing overlay with animated progress bar
  - PROCESSING_STAGES constant: Detecting (33%), Removing (66%), Finishing (100%)
  - Timer-based stage advancement: 2s for Detecting, 3s for Removing, then Finishing until complete
  - quality-bar CSS class gradient used for progress bar colors
  - Stage indicators with active/inactive dot styling
  - Dynamic description text: "Detecting watermark..." → "Removing watermark..." → "Applying final touches..."
  - Used setTimeout(fn, 0) pattern to avoid synchronous setState lint error

- **ComparisonSlider.tsx**: Same identical 3-stage progress bar overlay
  - Same PROCESSING_STAGES, processingStage state, and timer mechanism
  - Same visual progress bar UI with quality-bar gradient

### Feature 2: Format Conversion in ResizePanel
- **store.ts**: Added `targetFormat: 'same' | 'png' | 'jpeg' | 'webp' | 'avif'` to ResizeConfig
  - Default value: 'same' in defaultResizeConfig
  - Persisted via partialize config

- **ResizePanel.tsx**: Added format selector with 5 button options
  - FORMAT_OPTIONS array with Same, PNG, JPEG, WebP, AVIF
  - FileOutput icon for the format row label
  - Format buttons with primary/muted styling
  - FormData includes format when targetFormat !== 'same'
  - Result file MIME type matches selected format
  - Reset also clears targetFormat to 'same'

- **resize/route.ts**: Format conversion using sharp's format-specific output
  - FORMAT_MAP maps format strings to MIME types and sharp format enums
  - PNG: quality 100 (lossless), JPEG: quality 90, WebP: quality 90, AVIF: quality 80
  - Dynamic MIME type in response dataUrl and format field
  - Falls back to PNG when format is null/'same'

## Lint Result
- All lint errors pass cleanly after fixing synchronous setState-in-effect pattern

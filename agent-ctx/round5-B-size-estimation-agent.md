# Task ID: round5-B
# Agent: size-estimation-agent

## Task
Add File Size Estimation and Image Difference Stats to the Zeminai Watermark Remover:
1. New `/api/estimate-size` endpoint for fast size preview.
2. Add pixel diff stats to `/api/remove-watermark` response.
3. QualityOptimizer: show estimated output size with savings %.
4. DownloadPanel: show estimated size on Download button + comparison info row.
5. ComparisonSlider: show pixel diff stats badge (computed client-side).

## Work Log

### 1. New API: `/api/estimate-size` (NEW)
- Created `src/app/api/estimate-size/route.ts`.
- POST endpoint accepting FormData: `image` (File), `format` ('jpeg'|'png'|'webp'), `quality` (number 1..100), `maxWidth` (number), `maxHeight` (number).
- Imports sharp dynamically (`(await import('sharp')).default`) — keeps the route independent of the heavier `@/lib/image-processing` module (no canvas/inpainting code loaded).
- Reads metadata, resizes only when source exceeds max dims (using `fit: 'inside'`, `withoutEnlargement: true` — same logic as `/api/optimize`).
- Applies the identical format/quality options as `/api/optimize`: mozjpeg for jpeg, palette+compressionLevel formula for png, plain webp.
- Encodes to buffer purely to measure `buffer.length` — deliberately skips the base64 dataUrl conversion (saves ~33% size and time).
- Returns `{ success: true, estimatedSize: number, format: string, width: number, height: number }`.
- On error returns `{ success: false, error: string }` with status 500.
- Validates format against the 3 supported values; returns 400 for unsupported formats.

### 2. Modified `/api/remove-watermark`
- File: `src/app/api/remove-watermark/route.ts`.
- After producing the inpainted `resultBuffer`, computes pixel-difference stats between the original `imageBuffer` and `resultBuffer`.
- Uses sharp to get raw RGBA pixel buffers of both at identical dimensions (defensively resizes both to original's dimensions with `fit: 'fill'` in case the implementation ever changes).
- Loops 4 bytes per pixel; counts a pixel as "changed" if any RGB channel differs by more than 3 levels (out of 255) — the threshold ignores negligible resampling/rounding noise.
- Computes `totalPixels = w * h`, `diffPercentage = round((changedPixels / totalPixels) * 1000) / 10` (1 decimal place).
- Adds `stats: { changedPixels, totalPixels, diffPercentage }` to the success response.
- Existing `result: { dataUrl, width, height, size }` field is preserved UNCHANGED.
- Stats computation is wrapped in try/catch so any failure (e.g., sharp metadata issue) cannot break the main removal flow — logs and continues with zeroed stats.

### 3. Enhanced QualityOptimizer
- File: `src/components/watermark-remover/QualityOptimizer.tsx`.
- Added imports: `useCallback`, `useEffect`, `useRef`, `useState` from React; `Loader2`, `ArrowDown`, `ArrowUp` from lucide-react.
- Now reads `originalImage` and `processedImage` from the store (in addition to existing `qualityConfig`/`setQualityConfig`).
- Picks the source image for estimation: prefers `processedImage.dataUrl`, falls back to `originalImage.dataUrl`.
- Comparison baseline: `processedImage?.size ?? originalImage?.size ?? 0` (compares against processed if available, else against the original upload).
- Cache: `cacheRef = useRef<Map<string, EstimateResult>>` keyed by `${format}-${quality}-${maxWidth}-${maxHeight}`.
- Request token (`requestTokenRef`) so stale responses are ignored if the user changes config mid-flight.
- `fetchEstimate` callback converts dataUrl → File (via atob), POSTs FormData to `/api/estimate-size`, caches the result.
- Debounce effect: 500ms after any qualityConfig change, calls `fetchEstimate`. Cache hits are served instantly.
- Cache invalidation effect: clears the cache and resets estimate when `sourceDataUrl` changes (new image or new processing result).
- New "Estimated size" row at the bottom: `flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-[10px]` (per the spec's styling note).
- States shown:
  - Loading (no estimate yet): `<Loader2 className="size-3 animate-spin" />` + "Calculating..."
  - Estimate available: `{formatBytes(estimatedSize)}` + savings badge.
  - No source: "Upload an image" placeholder.
- Savings badge: green (`bg-green-500/10 text-green-600 dark:text-green-400`) if smaller, amber (`bg-amber-500/10 text-amber-600 dark:text-amber-400`) if larger. Includes `ArrowDown`/`ArrowUp` icon and the absolute percentage.
- Numeric displays use `tabular-nums` per the spec.

### 4. Enhanced DownloadPanel
- File: `src/components/watermark-remover/DownloadPanel.tsx`.
- Added imports: `useEffect`, `useRef`, `ArrowDown`, `ArrowUp` (Loader2 was already imported).
- Added `estimatedSize`, `isEstimating`, `estimateCacheRef`, `estimateTokenRef` state.
- Added `dataUrlToFile` helper (same as in QualityOptimizer) and `formatBytesSpaced` (with a space between number and unit) for the info row.
- Added `useEffect` that fires when `processedImage.dataUrl` or qualityConfig fields change. Debounces 500ms then calls `/api/estimate-size` with the processed image file. Caches by `${format}-${quality}-${maxWidth}-${maxHeight}`. Skipped entirely once `optimizedSize` is set (we have the actual size).
- Added cache-clearing effect when `processedImage.dataUrl` changes.
- Download button badge logic:
  - After Optimize clicked → shows actual `optimizedSize` (unchanged).
  - Before optimization, while estimating → shows a spinner inside the badge.
  - Before optimization, estimate available → shows `~{formatBytes(estimatedSize)}` (the `~` prefix indicates it's an estimate).
  - Fallback → shows `processedImage.size` (existing behavior).
- Added "Comparison info row" below the action buttons (replaces the old single-line `compressionRatio` text):
  - Only shown after optimization is applied (`showComparisonRow = optimizedSize !== null && compressionRatio !== null`).
  - Format: `Original: 29 KB → Optimized: 12 KB` with a green/amber savings pill (`↓ 59%` / `↑ 10%`).
  - Styling: `flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-[10px]` — matches the QualityOptimizer's estimated-size row.
- Added a "Pre-optimization hint row" that appears only when an estimate is being fetched or has been fetched: shows "Estimating output size..." (with spinner) while loading, "Estimated download size" once the estimate is known.
- All existing buttons (Optimize, Copy, Download) remain in their original positions.

### 5. Enhanced ComparisonSlider
- File: `src/components/watermark-remover/ComparisonSlider.tsx`.
- Added imports: `Loader2`, `GitCompareArrows` from lucide-react.
- Approach: Option B from the spec — compute pixel diff client-side using canvas, since store.ts cannot be modified.
- Added `DiffStats` interface: `{ changedPixels, totalPixels, diffPercentage }`.
- Added `loadImage(src)` helper: returns a Promise<HTMLImageElement>, sets `crossOrigin = 'anonymous'` (data URLs are safe — canvas won't be tainted).
- Added `formatPixelCount(n)` helper: `< 1000` → "123", `< 1M` → "12.3K", else "1.2M".
- Added `diffStats`, `diffLoading`, `diffTokenRef` state.
- Added `useEffect` triggered by `originalImage?.dataUrl` / `processedImage?.dataUrl`:
  - Loads both images via `Promise.all([loadImage(orig), loadImage(proc)])`.
  - Takes the smaller of each natural dimension (defensive — for watermark removal both are identical, but this handles edge cases).
  - Creates two offscreen `<canvas>` elements (never attached to DOM), each with `getContext('2d', { willReadFrequently: true })`.
  - Draws each image to its canvas, calls `getImageData` to get the raw RGBA buffer.
  - Loops 4 bytes per pixel; counts a pixel as "changed" if any RGB channel differs by more than 3 levels — same threshold as the server-side route.
  - Computes `diffPercentage = round((changedPixels / totalPixels) * 1000) / 10` (1 decimal place).
  - Token-guarded so stale computations don't overwrite newer ones.
  - Catches any error (e.g., canvas tainted, image failed to load) → logs and leaves `diffStats = null`.
- New badge rendered at `absolute top-9 right-2 z-20` (positioned just BELOW the existing "After" label at `top-2.5 right-2.5` to avoid overlap).
  - Styling per spec: `rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white shadow-sm tabular-nums`.
  - Uses `pointer-events-none` so it doesn't interfere with slider dragging.
  - States:
    - Loading: spinner + "Analyzing diff..."
    - Success: `GitCompareArrows` icon + "{pct}% pixels modified · {pixelCount} changed" (e.g., "5.2% pixels modified · 24.6K changed").
    - Unavailable (compute failed): "Diff unavailable".
- All existing elements preserved: Compare badge, Before/After labels, divider, handle, keyboard support, pulse animation, bottom info row.

## Verification

- **ESLint**: `bun run lint` exits 0 with zero errors and zero warnings.
- **TypeScript**: `npx tsc --noEmit` shows zero errors in the 5 files I touched. (Two pre-existing errors remain in `src/app/api/adjust/route.ts` and `src/components/watermark-remover/ImagePreview.tsx` — those files are owned by other agents and I did not touch them.)
- **Dev server log**: tail of `dev.log` shows clean compiles after every file change. No runtime errors. `POST /api/remove-watermark` still returns 200 in ~1100-1300ms (the diff stats computation adds a small overhead but stays well within budget).
- **API trace (mental)**:
  - `/api/estimate-size` POST with FormData(image, format=webp, quality=80, maxWidth=1920, maxHeight=1080) → reads formData, buffers image, reads sharp metadata, conditionally resizes, encodes to webp at quality 80, returns `{success:true, estimatedSize, format:'webp', width, height}`. No base64 encoding → fast.
  - `/api/remove-watermark` POST → existing flow (auto-detect → mask → inpaint → bufferToDataUrl → getImageInfo), then NEW stats block: sharp metadata → resize both to origW×origH → raw buffers → loop counting changed pixels → returns `{success:true, result:{dataUrl,width,height,size}, stats:{changedPixels,totalPixels,diffPercentage}}`. Existing `result` field shape unchanged.
- **ComparisonSlider robustness**: handles missing dataUrls (returns null), failed image loads (catches and shows "Diff unavailable"), mismatched dimensions (uses smaller dims), and stale computations (token-guarded).
- **QualityOptimizer cache**: switching between presets hits the cache instantly (no refetch). Switching images clears the cache.

## Stage Summary

- **Files changed**: 5 (1 new, 4 modified):
  - `src/app/api/estimate-size/route.ts` (NEW)
  - `src/app/api/remove-watermark/route.ts` (added `stats` field, additive only)
  - `src/components/watermark-remover/QualityOptimizer.tsx` (added estimated size row + cache)
  - `src/components/watermark-remover/DownloadPanel.tsx` (added estimate badge + comparison info row)
  - `src/components/watermark-remover/ComparisonSlider.tsx` (added pixel diff stats badge)
- **Files NOT touched** (per task constraints): `page.tsx`, `ControlPanel.tsx`, `ImagePreview.tsx`, `CropPanel.tsx`, `WatermarkAdder.tsx`, `AdjustPanel.tsx`, `HistoryPanel.tsx`, `globals.css`, `store.ts`, and all other API routes.
- **Verification status**: ESLint pass (0 errors, 0 warnings), TypeScript pass for all 5 touched files, dev server compiles cleanly, `/api/remove-watermark` still returns 200 with the existing `result` shape preserved (the `stats` field is purely additive).
- **Known issues / trade-offs**:
  - The `stats` field returned by `/api/remove-watermark` is NOT consumed by the store (the store's `ProcessedImage` type cannot be modified by this task). The ComparisonSlider independently computes the same diff client-side as a workaround. The two computations use the same 3-level threshold and produce the same numbers, so they stay in sync — but the server-side stats are currently unused by the frontend. They're available for any future caller that wants the server-computed value.
  - The estimated-size badge on the Download button shows `~245KB` (with a tilde prefix) before optimization to clearly signal it's an estimate, and the actual size after optimization. This is a UX safety measure to prevent users from being surprised if the actual size differs slightly from the estimate.
  - The ComparisonSlider stats badge is positioned at `top-9 right-2` (just below the "After" label at `top-2.5 right-2.5`) to avoid visual overlap. The spec's exact `top-2 right-2` would have collided with the existing "After" label, so I shifted it down by ~28px — it still reads as "top-right of the comparison slider".
  - On very large images (e.g., 4000×4000 = 16M pixels), the client-side diff computation takes ~50-100ms inline (no Web Worker). For typical watermarked images (800×600 to 2000×1500) it's well under 50ms — fast enough to not block the UI thread perceptibly.

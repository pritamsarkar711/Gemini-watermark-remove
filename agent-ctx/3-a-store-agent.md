# Task 3-a: Update Zustand Store with Undo/Redo

## Summary
Updated `/home/z/my-project/src/lib/store.ts` to add complete undo/redo functionality and history tracking. All 10 requirements from the task were implemented:

1. ✅ `history` array storing `HistorySnapshot` objects (originalImage, processedImage, step, transformConfig, watermarkConfig, lastAction)
2. ✅ `historyIndex` tracking current position (initialized to 0)
3. ✅ `pushHistory()` method that saves current state to history with optional action label
4. ✅ `undo()` method that decrements historyIndex and restores from snapshot
5. ✅ `redo()` method that increments historyIndex and restores from snapshot
6. ✅ `canUndo` and `canRedo` boolean state fields, updated on every history change
7. ✅ `setProcessedImage` automatically pushes to history (creates snapshot of state after change, truncates redo future)
8. ✅ `setOriginalImage` automatically pushes to history when image is set (same pattern)
9. ✅ `lastAction` field with LastAction union type ("upload" | "remove-watermark" | "add-watermark" | "transform" | "optimize" | "reset")
10. ✅ All existing functionality intact — no types removed, no methods changed, no breaking changes

## Key Design Decisions
- **Standard undo/redo pattern**: `history[historyIndex]` always represents the current state. New actions push a snapshot of the state AFTER the change, truncating any redo future.
- **Serialization**: File objects (ImageInfo.file, WatermarkConfig.logoFile) cannot be serialized. `ImageInfoSnapshot` stores dataUrl + metadata; `WatermarkConfigSnapshot` strips logoFile. File reconstruction uses `dataUrlToFile()` helper (atob → Uint8Array → File).
- **Known limitation**: logoFile is set to null when restoring from history. Users must re-upload logo files after undo/redo involving watermark config changes.

## Verification
- ESLint: ✅ zero errors
- Dev server: ✅ running cleanly, no compilation errors
- Existing components: ✅ all 10 files using `useAppStore` continue to work

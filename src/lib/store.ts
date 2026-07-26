import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ProcessingStep = "upload" | "preview" | "processing" | "result";

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type WatermarkMode = "remove" | "add";

export type LastAction =
  | "upload"
  | "remove-watermark"
  | "add-watermark"
  | "transform"
  | "optimize"
  | "reset";

export interface ImageInfo {
  file: File;
  name: string;
  originalName: string;
  width: number;
  height: number;
  size: number;
  type: string;
  dataUrl: string;
}

/**
 * Serializable snapshot of ImageInfo, excluding the File object.
 * The File can be reconstructed from dataUrl + metadata when needed.
 */
export interface ImageInfoSnapshot {
  name: string;
  originalName: string;
  width: number;
  height: number;
  size: number;
  type: string;
  dataUrl: string;
}

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

export interface WatermarkConfig {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
  rotation: number;
  shadow: boolean;
  repeat: boolean;
  logoFile: File | null;
  logoOpacity: number;
  logoSize: number;
  logoPosition: WatermarkPosition;
}

/**
 * Serializable snapshot of WatermarkConfig, excluding the logoFile (File object).
 * logoFile cannot be serialized and will be null when restored from history.
 */
export interface WatermarkConfigSnapshot {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
  rotation: number;
  shadow: boolean;
  repeat: boolean;
  logoOpacity: number;
  logoSize: number;
  logoPosition: WatermarkPosition;
}

export interface QualityConfig {
  quality: number;
  format: "jpeg" | "png" | "webp";
  maxWidth: number;
  maxHeight: number;
}

export interface TransformConfig {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

export interface AdjustConfig {
  brightness: number; // 0.5 - 2, 1 = no change
  contrast: number; // 0 - 2, 1 = no change
  saturation: number; // 0 - 2, 1 = no change
  blur: number; // 0 - 10, 0 = no blur
  sharpen: number; // 0 - 5, 0 = no sharpen
  hue: number; // -180 to 180, 0 = no change
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
}

export interface ResizeConfig {
  width: number;
  height: number;
  mode: 'fit' | 'fill' | 'stretch' | 'exact';
  lockAspectRatio: boolean;
}

/**
 * A reusable watermark preset. When applied, the preset's config values
 * override the corresponding fields in `watermarkConfig`.
 * `logoFile` is intentionally excluded (File objects cannot be serialized).
 */
export interface WatermarkPreset {
  id: string;
  label: string;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  shadow: boolean;
  repeat: boolean;
}

/**
 * A history snapshot captures the key state at a point in time.
 * Used for undo/redo: history[historyIndex] always represents the current state.
 */
export interface HistorySnapshot {
  originalImage: ImageInfoSnapshot | null;
  processedImage: ProcessedImage | null;
  step: ProcessingStep;
  transformConfig: TransformConfig;
  watermarkConfig: WatermarkConfigSnapshot;
  lastAction: LastAction | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a serializable snapshot of ImageInfo, stripping the File object. */
function createImageInfoSnapshot(image: ImageInfo | null): ImageInfoSnapshot | null {
  if (!image) return null;
  return {
    name: image.name,
    originalName: image.originalName,
    width: image.width,
    height: image.height,
    size: image.size,
    type: image.type,
    dataUrl: image.dataUrl,
  };
}

/** Create a serializable snapshot of WatermarkConfig, stripping the logoFile. */
function createWatermarkConfigSnapshot(config: WatermarkConfig): WatermarkConfigSnapshot {
  return {
    text: config.text,
    fontSize: config.fontSize,
    color: config.color,
    opacity: config.opacity,
    position: config.position,
    rotation: config.rotation,
    shadow: config.shadow,
    repeat: config.repeat,
    logoOpacity: config.logoOpacity,
    logoSize: config.logoSize,
    logoPosition: config.logoPosition,
  };
}

/** Reconstruct a File object from a dataUrl string. */
function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new File([u8arr], filename, { type: mimeType });
}

/** Restore ImageInfo from an ImageInfoSnapshot by reconstructing the File object. */
function restoreImageInfo(snapshot: ImageInfoSnapshot | null): ImageInfo | null {
  if (!snapshot) return null;
  const file = dataUrlToFile(snapshot.dataUrl, snapshot.originalName, snapshot.type);
  return {
    file,
    name: snapshot.name,
    originalName: snapshot.originalName,
    width: snapshot.width,
    height: snapshot.height,
    size: snapshot.size,
    type: snapshot.type,
    dataUrl: snapshot.dataUrl,
  };
}

/** Restore WatermarkConfig from a WatermarkConfigSnapshot. logoFile is lost (set to null). */
function restoreWatermarkConfig(snapshot: WatermarkConfigSnapshot): WatermarkConfig {
  return {
    ...snapshot,
    logoFile: null, // File objects cannot be restored from serialized history
  };
}

/** Create a HistorySnapshot from the current app state. */
function createSnapshotFromState(state: AppState): HistorySnapshot {
  return {
    originalImage: createImageInfoSnapshot(state.originalImage),
    processedImage: state.processedImage ? { ...state.processedImage } : null,
    step: state.step,
    transformConfig: { ...state.transformConfig },
    watermarkConfig: createWatermarkConfigSnapshot(state.watermarkConfig),
    lastAction: state.lastAction,
  };
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultWatermarkConfig: WatermarkConfig = {
  text: "",
  fontSize: 24,
  color: "#ffffff",
  opacity: 50,
  position: "bottom-right",
  rotation: 0,
  shadow: true,
  repeat: false,
  logoFile: null,
  logoOpacity: 50,
  logoSize: 100,
  logoPosition: "bottom-right",
};

const defaultQualityConfig: QualityConfig = {
  quality: 90,
  format: "png",
  maxWidth: 4096,
  maxHeight: 4096,
};

const defaultTransformConfig: TransformConfig = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

const defaultAdjustConfig: AdjustConfig = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
  sharpen: 0,
  hue: 0,
  grayscale: false,
  sepia: false,
  invert: false,
};

const defaultResizeConfig: ResizeConfig = {
  width: 0,
  height: 0,
  mode: 'fit',
  lockAspectRatio: true,
};

/**
 * Built-in watermark preset templates. Users can click a preset chip in the
 * WatermarkAdder to apply a pre-configured text watermark (text + size +
 * color + opacity + rotation + shadow + repeat). Custom user presets are
 * stored in `customPresets` in the store and merged with these at render time.
 */
export const BUILT_IN_PRESETS: WatermarkPreset[] = [
  {
    id: "copyright",
    label: "© 2025",
    text: "© 2025 Zeminai",
    fontSize: 28,
    color: "#ffffff",
    opacity: 80,
    rotation: 0,
    shadow: true,
    repeat: false,
  },
  {
    id: "draft",
    label: "DRAFT",
    text: "DRAFT",
    fontSize: 48,
    color: "#ff4444",
    opacity: 35,
    rotation: -30,
    shadow: false,
    repeat: true,
  },
  {
    id: "confidential",
    label: "CONFIDENTIAL",
    text: "CONFIDENTIAL",
    fontSize: 36,
    color: "#ff4444",
    opacity: 45,
    rotation: -30,
    shadow: true,
    repeat: true,
  },
  {
    id: "sample",
    label: "SAMPLE",
    text: "SAMPLE",
    fontSize: 42,
    color: "#888888",
    opacity: 50,
    rotation: -30,
    shadow: false,
    repeat: true,
  },
  {
    id: "do-not-copy",
    label: "DO NOT COPY",
    text: "DO NOT COPY",
    fontSize: 32,
    color: "#000000",
    opacity: 40,
    rotation: -25,
    shadow: true,
    repeat: true,
  },
  {
    id: "zeminai",
    label: "Zeminai",
    text: "Zeminai",
    fontSize: 24,
    color: "#ffffff",
    opacity: 60,
    rotation: 0,
    shadow: true,
    repeat: false,
  },
];

const initialSnapshot: HistorySnapshot = {
  originalImage: null,
  processedImage: null,
  step: "upload",
  transformConfig: defaultTransformConfig,
  watermarkConfig: createWatermarkConfigSnapshot(defaultWatermarkConfig),
  lastAction: null,
};

// ─── Store Interface ─────────────────────────────────────────────────────────

interface AppState {
  step: ProcessingStep;
  setStep: (step: ProcessingStep) => void;

  originalImage: ImageInfo | null;
  setOriginalImage: (image: ImageInfo | null, action?: LastAction) => void;

  processedImage: ProcessedImage | null;
  setProcessedImage: (image: ProcessedImage | null, action?: LastAction) => void;

  mode: WatermarkMode;
  setMode: (mode: WatermarkMode) => void;

  maskData: string | null;
  setMaskData: (data: string | null) => void;

  autoDetect: boolean;
  setAutoDetect: (auto: boolean) => void;

  watermarkConfig: WatermarkConfig;
  setWatermarkConfig: (config: Partial<WatermarkConfig>) => void;

  qualityConfig: QualityConfig;
  setQualityConfig: (config: Partial<QualityConfig>) => void;

  transformConfig: TransformConfig;
  setTransformConfig: (config: Partial<TransformConfig>) => void;

  adjustConfig: AdjustConfig;
  setAdjustConfig: (config: Partial<AdjustConfig>) => void;

  resizeConfig: ResizeConfig;
  setResizeConfig: (config: Partial<ResizeConfig>) => void;

  outputFileName: string;
  setOutputFileName: (name: string) => void;

  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  sliderPosition: number;
  setSliderPosition: (pos: number) => void;

  showComparison: boolean;
  setShowComparison: (show: boolean) => void;

  // ─── Crop overlay state (UI-only, not part of history) ────────────────────
  // Shared between CropPanel (numeric inputs + ratio presets) and ImagePreview
  // (visual draggable/resizable rectangle overlay).
  cropRect: { x: number; y: number; width: number; height: number };
  setCropRect: (rect: { x: number; y: number; width: number; height: number }) => void;

  isCropOverlayActive: boolean;
  setCropOverlayActive: (active: boolean) => void;

  // ─── User presets ──────────────────────────────────────────────────────
  // Custom watermark presets saved by the user (in addition to BUILT_IN_PRESETS).
  // Persisted to localStorage so they survive page reloads.
  customPresets: WatermarkPreset[];
  /** Add a new custom preset. If a preset with the same id exists, it is replaced. */
  addCustomPreset: (preset: WatermarkPreset) => void;
  /** Remove a custom preset by id. Built-in presets cannot be removed. */
  removeCustomPreset: (id: string) => void;
  /** Apply a preset to the current watermarkConfig (text + style fields). logoFile is preserved. */
  applyPreset: (preset: WatermarkPreset) => void;

  // ─── History / Undo / Redo ──────────────────────────
  history: HistorySnapshot[];
  historyIndex: number;
  lastAction: LastAction | null;
  canUndo: boolean;
  canRedo: boolean;

  /** Push the current state to history as a new entry. Truncates any redo future. */
  pushHistory: (action?: LastAction) => void;

  /** Go back one step in history. Restores originalImage, processedImage, step, transformConfig, watermarkConfig. */
  undo: () => void;

  /** Go forward one step in history. Restores originalImage, processedImage, step, transformConfig, watermarkConfig. */
  redo: () => void;

  /**
   * Jump to a specific index in the history timeline.
   * Validates `0 <= index < history.length`; no-ops otherwise.
   * Restores state from `history[index]` using the same logic as undo/redo.
   */
  jumpTo: (index: number) => void;

  reset: () => void;
}

// ─── Store Implementation ────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  step: "upload",
  setStep: (step) => set({ step }),

  originalImage: null,
  setOriginalImage: (image, action) =>
    set((state) => {
      // Truncate any redo future before pushing new state
      const truncatedHistory = state.history.slice(0, state.historyIndex + 1);

      const newStep = image ? "preview" : "upload";
      const newOutputFileName = image
        ? image.name.replace(/\.[^.]+$/, "")
        : "";
      // Use the provided action label, or default to "upload" when an image is
      // being set, or null when clearing.
      const newLastAction: LastAction | null = action ?? (image ? "upload" : null);

      // Create snapshot of the state AFTER this change
      const newSnapshot: HistorySnapshot = {
        originalImage: createImageInfoSnapshot(image),
        processedImage: state.processedImage ? { ...state.processedImage } : null,
        step: newStep,
        transformConfig: { ...state.transformConfig },
        watermarkConfig: createWatermarkConfigSnapshot(state.watermarkConfig),
        lastAction: newLastAction,
      };

      const newHistory = [...truncatedHistory, newSnapshot];
      const newHistoryIndex = newHistory.length - 1;

      return {
        originalImage: image,
        step: newStep,
        outputFileName: newOutputFileName,
        lastAction: newLastAction,
        history: newHistory,
        historyIndex: newHistoryIndex,
        canUndo: newHistoryIndex > 0,
        canRedo: false,
      };
    }),

  processedImage: null,
  setProcessedImage: (image, action) =>
    set((state) => {
      // Truncate any redo future before pushing new state
      const truncatedHistory = state.history.slice(0, state.historyIndex + 1);

      const newStep = image ? "result" : "preview";
      // Use the provided action label, or fall back to the existing lastAction
      const newLastAction = action ?? state.lastAction;

      // Create snapshot of the state AFTER this change
      const newSnapshot: HistorySnapshot = {
        originalImage: createImageInfoSnapshot(state.originalImage),
        processedImage: image ? { ...image } : null,
        step: newStep,
        transformConfig: { ...state.transformConfig },
        watermarkConfig: createWatermarkConfigSnapshot(state.watermarkConfig),
        lastAction: newLastAction,
      };

      const newHistory = [...truncatedHistory, newSnapshot];
      const newHistoryIndex = newHistory.length - 1;

      return {
        processedImage: image,
        step: newStep,
        lastAction: newLastAction,
        history: newHistory,
        historyIndex: newHistoryIndex,
        canUndo: newHistoryIndex > 0,
        canRedo: false,
      };
    }),

  mode: "remove",
  setMode: (mode) => set({ mode }),

  maskData: null,
  setMaskData: (data) => set({ maskData: data }),

  autoDetect: true,
  setAutoDetect: (auto) => set({ autoDetect: auto }),

  watermarkConfig: defaultWatermarkConfig,
  setWatermarkConfig: (config) =>
    set((state) => ({
      watermarkConfig: { ...state.watermarkConfig, ...config },
    })),

  qualityConfig: defaultQualityConfig,
  setQualityConfig: (config) =>
    set((state) => ({
      qualityConfig: { ...state.qualityConfig, ...config },
    })),

  transformConfig: defaultTransformConfig,
  setTransformConfig: (config) =>
    set((state) => ({
      transformConfig: { ...state.transformConfig, ...config },
    })),

  adjustConfig: defaultAdjustConfig,
  setAdjustConfig: (config) =>
    set((state) => ({
      adjustConfig: { ...state.adjustConfig, ...config },
    })),

  resizeConfig: defaultResizeConfig,
  setResizeConfig: (config) =>
    set((state) => ({
      resizeConfig: { ...state.resizeConfig, ...config },
    })),

  outputFileName: "",
  setOutputFileName: (name) => set({ outputFileName: name }),

  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  sliderPosition: 50,
  setSliderPosition: (pos) => set({ sliderPosition: pos }),

  showComparison: false,
  setShowComparison: (show) => set({ showComparison: show }),

  // Crop overlay state — UI-only, not persisted into history snapshots.
  cropRect: { x: 0, y: 0, width: 0, height: 0 },
  setCropRect: (rect) => set({ cropRect: { ...rect } }),

  isCropOverlayActive: false,
  setCropOverlayActive: (active) => set({ isCropOverlayActive: active }),

  // ─── User presets ──────────────────────────────────────────────────────
  customPresets: [],
  addCustomPreset: (preset) =>
    set((state) => {
      // Replace if id exists, otherwise append
      const exists = state.customPresets.some((p) => p.id === preset.id);
      const next = exists
        ? state.customPresets.map((p) => (p.id === preset.id ? preset : p))
        : [...state.customPresets, preset];
      return { customPresets: next };
    }),
  removeCustomPreset: (id) =>
    set((state) => ({
      customPresets: state.customPresets.filter((p) => p.id !== id),
    })),
  applyPreset: (preset) =>
    set((state) => ({
      watermarkConfig: {
        ...state.watermarkConfig,
        text: preset.text,
        fontSize: preset.fontSize,
        color: preset.color,
        opacity: preset.opacity,
        rotation: preset.rotation,
        shadow: preset.shadow,
        repeat: preset.repeat,
        // logoFile and logo* fields are intentionally preserved
      },
    })),

  // ─── History / Undo / Redo ──────────────────────────

  history: [initialSnapshot],
  historyIndex: 0,
  lastAction: null,
  canUndo: false,
  canRedo: false,

  pushHistory: (action) =>
    set((state) => {
      // Truncate any redo future
      const truncatedHistory = state.history.slice(0, state.historyIndex + 1);

      const effectiveAction = action ?? state.lastAction;

      // Snapshot the current state with the provided (or existing) action label
      const newSnapshot: HistorySnapshot = {
        originalImage: createImageInfoSnapshot(state.originalImage),
        processedImage: state.processedImage ? { ...state.processedImage } : null,
        step: state.step,
        transformConfig: { ...state.transformConfig },
        watermarkConfig: createWatermarkConfigSnapshot(state.watermarkConfig),
        lastAction: effectiveAction,
      };

      const newHistory = [...truncatedHistory, newSnapshot];
      const newHistoryIndex = newHistory.length - 1;

      return {
        history: newHistory,
        historyIndex: newHistoryIndex,
        lastAction: effectiveAction,
        canUndo: newHistoryIndex > 0,
        canRedo: false,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state; // nothing to undo

      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];

      return {
        originalImage: restoreImageInfo(snapshot.originalImage),
        processedImage: snapshot.processedImage ? { ...snapshot.processedImage } : null,
        step: snapshot.step,
        transformConfig: { ...snapshot.transformConfig },
        watermarkConfig: restoreWatermarkConfig(snapshot.watermarkConfig),
        lastAction: snapshot.lastAction,
        outputFileName: snapshot.originalImage
          ? snapshot.originalImage.name.replace(/\.[^.]+$/, "")
          : "",
        isProcessing: false,
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: newIndex < state.history.length - 1,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state; // nothing to redo

      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];

      return {
        originalImage: restoreImageInfo(snapshot.originalImage),
        processedImage: snapshot.processedImage ? { ...snapshot.processedImage } : null,
        step: snapshot.step,
        transformConfig: { ...snapshot.transformConfig },
        watermarkConfig: restoreWatermarkConfig(snapshot.watermarkConfig),
        lastAction: snapshot.lastAction,
        outputFileName: snapshot.originalImage
          ? snapshot.originalImage.name.replace(/\.[^.]+$/, "")
          : "",
        isProcessing: false,
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: newIndex < state.history.length - 1,
      };
    }),

  jumpTo: (index) =>
    set((state) => {
      if (index < 0 || index >= state.history.length) return state; // invalid index
      if (index === state.historyIndex) return state; // no-op: same index

      const snapshot = state.history[index];

      return {
        originalImage: restoreImageInfo(snapshot.originalImage),
        processedImage: snapshot.processedImage ? { ...snapshot.processedImage } : null,
        step: snapshot.step,
        transformConfig: { ...snapshot.transformConfig },
        watermarkConfig: restoreWatermarkConfig(snapshot.watermarkConfig),
        lastAction: snapshot.lastAction,
        outputFileName: snapshot.originalImage
          ? snapshot.originalImage.name.replace(/\.[^.]+$/, "")
          : "",
        isProcessing: false,
        historyIndex: index,
        canUndo: index > 0,
        canRedo: index < state.history.length - 1,
      };
    }),

  reset: () =>
    set({
      step: "upload",
      originalImage: null,
      processedImage: null,
      mode: "remove",
      maskData: null,
      autoDetect: true,
      watermarkConfig: defaultWatermarkConfig,
      qualityConfig: defaultQualityConfig,
      transformConfig: defaultTransformConfig,
      adjustConfig: defaultAdjustConfig,
      resizeConfig: defaultResizeConfig,
      outputFileName: "",
      isProcessing: false,
      sliderPosition: 50,
      showComparison: false,
      // Reset crop overlay UI state as well
      cropRect: { x: 0, y: 0, width: 0, height: 0 },
      isCropOverlayActive: false,
      // Reset history to initial snapshot
      history: [initialSnapshot],
      historyIndex: 0,
      lastAction: null,
      canUndo: false,
      canRedo: false,
    }),
    }),
    {
      name: "zeminai-preferences",
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences — never persist images, history, or
      // transient processing state (those would blow past the ~5MB localStorage
      // quota and would also leak the previous session's image into a new visit).
      partialize: (state) => ({
        qualityConfig: state.qualityConfig,
        transformConfig: state.transformConfig,
        watermarkConfig: {
          // Persist style preferences but NOT the logoFile (File cannot serialize)
          ...state.watermarkConfig,
          logoFile: null,
        },
        adjustConfig: state.adjustConfig,
        resizeConfig: state.resizeConfig,
        customPresets: state.customPresets,
        autoDetect: state.autoDetect,
        mode: state.mode,
      }),
      version: 1,
    }
  )
);

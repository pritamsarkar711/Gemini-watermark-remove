import { create } from "zustand";

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

  outputFileName: string;
  setOutputFileName: (name: string) => void;

  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  sliderPosition: number;
  setSliderPosition: (pos: number) => void;

  showComparison: boolean;
  setShowComparison: (show: boolean) => void;

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

export const useAppStore = create<AppState>((set, get) => ({
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

  outputFileName: "",
  setOutputFileName: (name) => set({ outputFileName: name }),

  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  sliderPosition: 50,
  setSliderPosition: (pos) => set({ sliderPosition: pos }),

  showComparison: false,
  setShowComparison: (show) => set({ showComparison: show }),

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
      outputFileName: "",
      isProcessing: false,
      sliderPosition: 50,
      showComparison: false,
      // Reset history to initial snapshot
      history: [initialSnapshot],
      historyIndex: 0,
      lastAction: null,
      canUndo: false,
      canRedo: false,
    }),
}));

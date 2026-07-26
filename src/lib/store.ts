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
  logoFile: File | null;
  logoOpacity: number;
  logoSize: number;
  logoPosition: WatermarkPosition;
}

export interface QualityConfig {
  quality: number; // 1-100
  format: "jpeg" | "png" | "webp";
  maxWidth: number;
  maxHeight: number;
}

interface AppState {
  // Current step
  step: ProcessingStep;
  setStep: (step: ProcessingStep) => void;

  // Original image
  originalImage: ImageInfo | null;
  setOriginalImage: (image: ImageInfo | null) => void;

  // Processed result
  processedImage: ProcessedImage | null;
  setProcessedImage: (image: ProcessedImage | null) => void;

  // Mode: remove or add watermark
  mode: WatermarkMode;
  setMode: (mode: WatermarkMode) => void;

  // Watermark removal mask (coordinates for manual selection)
  maskData: string | null; // base64 mask image
  setMaskData: (data: string | null) => void;

  // Auto-detect mode
  autoDetect: boolean;
  setAutoDetect: (auto: boolean) => void;

  // Watermark add config
  watermarkConfig: WatermarkConfig;
  setWatermarkConfig: (config: Partial<WatermarkConfig>) => void;

  // Quality config
  qualityConfig: QualityConfig;
  setQualityConfig: (config: Partial<QualityConfig>) => void;

  // Rename
  outputFileName: string;
  setOutputFileName: (name: string) => void;

  // Processing state
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  // Comparison slider position
  sliderPosition: number; // 0-100
  setSliderPosition: (pos: number) => void;

  // Before/After view enabled
  showComparison: boolean;
  setShowComparison: (show: boolean) => void;

  // Reset all
  reset: () => void;
}

const defaultWatermarkConfig: WatermarkConfig = {
  text: "",
  fontSize: 24,
  color: "#ffffff",
  opacity: 50,
  position: "bottom-right",
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

export const useAppStore = create<AppState>((set) => ({
  step: "upload",
  setStep: (step) => set({ step }),

  originalImage: null,
  setOriginalImage: (image) => set({ originalImage: image, step: image ? "preview" : "upload", outputFileName: image ? image.name.replace(/\.[^.]+$/, "") : "" }),

  processedImage: null,
  setProcessedImage: (image) => set({ processedImage: image, step: image ? "result" : "preview" }),

  mode: "remove",
  setMode: (mode) => set({ mode }),

  maskData: null,
  setMaskData: (data) => set({ maskData: data }),

  autoDetect: true,
  setAutoDetect: (auto) => set({ autoDetect: auto }),

  watermarkConfig: defaultWatermarkConfig,
  setWatermarkConfig: (config) => set((state) => ({
    watermarkConfig: { ...state.watermarkConfig, ...config },
  })),

  qualityConfig: defaultQualityConfig,
  setQualityConfig: (config) => set((state) => ({
    qualityConfig: { ...state.qualityConfig, ...config },
  })),

  outputFileName: "",
  setOutputFileName: (name) => set({ outputFileName: name }),

  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  sliderPosition: 50,
  setSliderPosition: (pos) => set({ sliderPosition: pos }),

  showComparison: false,
  setShowComparison: (show) => set({ showComparison: show }),

  reset: () => set({
    step: "upload",
    originalImage: null,
    processedImage: null,
    mode: "remove",
    maskData: null,
    autoDetect: true,
    watermarkConfig: defaultWatermarkConfig,
    qualityConfig: defaultQualityConfig,
    outputFileName: "",
    isProcessing: false,
    sliderPosition: 50,
    showComparison: false,
  }),
}));

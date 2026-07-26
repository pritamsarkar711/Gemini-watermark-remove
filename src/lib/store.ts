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
  rotation: number;
  shadow: boolean;
  repeat: boolean;
  logoFile: File | null;
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

interface AppState {
  step: ProcessingStep;
  setStep: (step: ProcessingStep) => void;

  originalImage: ImageInfo | null;
  setOriginalImage: (image: ImageInfo | null) => void;

  processedImage: ProcessedImage | null;
  setProcessedImage: (image: ProcessedImage | null) => void;

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

  outputFileName: string;
  setOutputFileName: (name: string) => void;

  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  sliderPosition: number;
  setSliderPosition: (pos: number) => void;

  showComparison: boolean;
  setShowComparison: (show: boolean) => void;

  reset: () => void;
}

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

  transformConfig: defaultTransformConfig,
  setTransformConfig: (config) => set((state) => ({
    transformConfig: { ...state.transformConfig, ...config },
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
    transformConfig: defaultTransformConfig,
    outputFileName: "",
    isProcessing: false,
    sliderPosition: 50,
    showComparison: false,
  }),
}));

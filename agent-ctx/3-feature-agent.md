---
Task ID: 3
Agent: feature-agent
Task: Add resize tool, auto-enhance, and native color picker

Work Log:
- Added ResizeConfig interface to store.ts with fields: width, height, mode ('fit'|'fill'|'stretch'|'exact'), lockAspectRatio
- Added resizeConfig state + setResizeConfig method to Zustand store, with defaultResizeConfig
- Added resizeConfig to persist partialize config and reset function
- Created /api/resize/route.ts endpoint using sharp's resize() method with fit modes (inside/cover/fill/outside), clamped dimensions 16-8192px
- Created ResizePanel.tsx component with collapsible panel (starts collapsed), width/height inputs, lock/unlock aspect ratio toggle, 4 resize mode buttons, 6 size presets, dimension preview, apply/reset buttons
- Added ResizePanel import and render to page.tsx between CropPanel and AdjustPanel
- Added Auto Enhance button to ControlPanel.tsx below the Transform section (before Tabs), using /api/adjust with preset values (brightness:1.15, contrast:1.1, saturation:1.2, sharpen:1.0), styled as size-7 rounded-lg with Sparkles icon and gradient background
- Replaced color Input in WatermarkAdder.tsx with native HTML5 <input type="color"> picker, kept color preview square next to picker, kept preset color swatches, removed text hex input

Stage Summary:
- Resize feature: full resize tool with API endpoint, panel component, store integration, and page integration
- Auto Enhance: one-click button in ControlPanel that applies optimal brightness/contrast/saturation via /api/adjust
- Color Picker: native HTML5 color picker replaces text input for watermark color selection
- All changes pass lint with zero errors, dev server compiles successfully

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width!;
    const imgHeight = metadata.height!;

    // Parse resize parameters
    const width = parseInt(formData.get("width") as string) || imgWidth;
    const height = parseInt(formData.get("height") as string) || imgHeight;
    const mode = (formData.get("mode") as string) || "fit"; // fit | fill | stretch | exact

    // Clamp dimensions to reasonable bounds
    const MIN_DIM = 16;
    const MAX_DIM = 8192;
    const targetWidth = Math.max(MIN_DIM, Math.min(width, MAX_DIM));
    const targetHeight = Math.max(MIN_DIM, Math.min(height, MAX_DIM));

    // Determine sharp fit mode
    let fit: sharp.FitEnum[keyof sharp.FitEnum];
    switch (mode) {
      case "fill":
        fit = "cover";
        break;
      case "stretch":
        fit = "fill";
        break;
      case "exact":
        fit = "outside";
        break;
      case "fit":
        fit = "inside";
        break;
      default:
        fit = "inside";
    }

    // For "exact" mode, we don't want to preserve aspect ratio
    // sharp's "outside" fit still preserves aspect ratio, so for true exact
    // we use "fill" (which ignores aspect ratio) with force resize
    const resizeOptions: sharp.ResizeOptions = {
      fit,
      withoutEnlargement: true, // Don't upscale
    };

    // "stretch" and "exact" modes should ignore aspect ratio
    if (mode === "stretch" || mode === "exact") {
      resizeOptions.fit = mode === "stretch" ? "fill" : "fill";
    }

    const resultBuffer = await sharp(imageBuffer, { failOn: "none" })
      .resize(targetWidth, targetHeight, resizeOptions)
      .png({ quality: 100 })
      .toBuffer();

    const resultMeta = await sharp(resultBuffer).metadata();
    const size = resultBuffer.byteLength;
    const dataUrl = `data:image/png;base64,${resultBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: resultMeta.width ?? targetWidth,
        height: resultMeta.height ?? targetHeight,
        size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Resize error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

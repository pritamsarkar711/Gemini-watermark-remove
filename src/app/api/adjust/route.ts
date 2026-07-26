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

    // Parse adjustment parameters (all optional, with sensible defaults)
    const brightness = parseFloat(formData.get("brightness") as string) || 1; // 0.5 - 2, 1 = no change
    const contrast = parseFloat(formData.get("contrast") as string) || 1; // 0 - 2, 1 = no change
    const saturation = parseFloat(formData.get("saturation") as string) || 1; // 0 - 2, 1 = no change
    const blur = parseFloat(formData.get("blur") as string) || 0; // 0.3 - 100, 0 = no blur
    const sharpen = parseFloat(formData.get("sharpen") as string) || 0; // 0 - 10, 0 = no sharpen
    const grayscale = formData.get("grayscale") === "true";
    const sepia = formData.get("sepia") === "true";
    const invert = formData.get("invert") === "true";
    const hue = parseInt(formData.get("hue") as string) || 0; // -180 to 180

    let pipeline = sharp(imageBuffer, { failOn: "none" });

    // Apply modulate (brightness, saturation, hue)
    const modulateOpts: sharp.Modulate = {};
    if (brightness !== 1) modulateOpts.brightness = brightness;
    if (saturation !== 1) modulateOpts.saturation = saturation;
    if (hue !== 0) modulateOpts.hue = hue;
    if (Object.keys(modulateOpts).length > 0) {
      pipeline = pipeline.modulate(modulateOpts);
    }

    // Apply contrast (linear contrast stretch)
    if (contrast !== 1) {
      pipeline = pipeline.linear(contrast, -(128 * (contrast - 1)));
    }

    // Apply blur
    if (blur > 0) {
      pipeline = pipeline.blur(Math.min(Math.max(blur, 0.3), 100));
    }

    // Apply sharpen
    if (sharpen > 0) {
      pipeline = pipeline.sharpen({
        sigma: Math.min(Math.max(sharpen, 0.01), 10),
      });
    }

    // Apply grayscale
    if (grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Apply sepia (using recombination matrix)
    if (sepia) {
      pipeline = pipeline.recomb([
        [0.393, 0.769, 0.189],
        [0.349, 0.686, 0.168],
        [0.272, 0.534, 0.131],
      ]);
    }

    // Apply invert
    if (invert) {
      pipeline = pipeline.negate();
    }

    // Output as PNG (lossless for adjustments)
    const resultBuffer = await pipeline.png({ quality: 100 }).toBuffer();

    const metadata = await sharp(resultBuffer).metadata();
    const size = resultBuffer.byteLength;
    const dataUrl = `data:image/png;base64,${resultBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Adjust error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

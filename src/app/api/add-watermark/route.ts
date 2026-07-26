import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const logoFile = formData.get("logo") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    const { addWatermark, bufferToDataUrl, getImageInfo } = await import("@/lib/image-processing");

    const options = {
      text: (formData.get("text") as string) || "",
      fontSize: parseInt(formData.get("fontSize") as string) || 24,
      color: (formData.get("color") as string) || "#ffffff",
      opacity: parseInt(formData.get("opacity") as string) || 50,
      position: (formData.get("position") as string) || "bottom-right",
      logoBuffer: logoFile ? Buffer.from(await logoFile.arrayBuffer()) : undefined,
      logoOpacity: parseInt(formData.get("logoOpacity") as string) || 50,
      logoSize: parseInt(formData.get("logoSize") as string) || 100,
      logoPosition: (formData.get("logoPosition") as string) || "bottom-right",
    };

    const resultBuffer = await addWatermark(imageBuffer, options);

    const dataUrl = bufferToDataUrl(resultBuffer);
    const info = await getImageInfo(resultBuffer);

    return NextResponse.json({
      success: true,
      result: {
        dataUrl,
        width: info.width,
        height: info.height,
        size: info.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Watermark addition error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

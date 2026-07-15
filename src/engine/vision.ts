/**
 * Evolved — photo-to-quote estimator.
 *
 * With ANTHROPIC_API_KEY set, Claude vision reads the customer's photo and
 * estimates surface type, area, condition, and required blast depth. Without
 * a key, a deterministic offline estimator parses the image's real pixel
 * dimensions (JPEG SOF / PNG IHDR headers) and combines them with caller
 * hints — clearly labeled lower-confidence, so the demo runs with zero
 * credentials but never pretends.
 */

import type { BlastDepth, SurfaceKind } from "../types.js";

export interface VisionEstimate {
  surface: SurfaceKind;
  sqft: number;
  depth: BlastDepth;
  condition: string;
  confidence: number;
  source: "claude-vision" | "offline-heuristic";
  imagePixels?: { width: number; height: number };
  notes: string[];
}

/** Parse pixel dimensions from JPEG (SOF0/2) or PNG (IHDR) headers. */
export function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then IHDR
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan markers for SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
  }
  return null;
}

const SURFACE_DEFAULT_SQFT: Record<string, { sqft: number; depth: BlastDepth }> = {
  driveway: { sqft: 550, depth: "medium" },
  sidewalk: { sqft: 220, depth: "light" },
  patio: { sqft: 300, depth: "light" },
  "garage-pad": { sqft: 440, depth: "light" },
  "exposed-aggregate": { sqft: 600, depth: "medium" },
  trailer: { sqft: 190, depth: "heavy" },
  equipment: { sqft: 120, depth: "heavy" },
  fence: { sqft: 350, depth: "light" },
  brick: { sqft: 280, depth: "light" },
  other: { sqft: 300, depth: "medium" },
};

export interface VisionHints {
  surface?: SurfaceKind;
  approxWidthFt?: number;
  approxLengthFt?: number;
  conditionNote?: string;
}

function offlineEstimate(imageBase64: string | undefined, hints: VisionHints): VisionEstimate {
  const notes: string[] = [
    "Offline heuristic estimate — set ANTHROPIC_API_KEY for real vision analysis.",
  ];
  let pixels: { width: number; height: number } | undefined;
  if (imageBase64) {
    try {
      const dim = imageDimensions(Buffer.from(imageBase64, "base64"));
      if (dim) {
        pixels = dim;
        notes.push(`Image parsed: ${dim.width}×${dim.height} px.`);
      }
    } catch {
      notes.push("Image could not be parsed — estimating from hints only.");
    }
  }

  const surface = hints.surface ?? "driveway";
  const defaults = SURFACE_DEFAULT_SQFT[surface] ?? SURFACE_DEFAULT_SQFT.other;

  let sqft = defaults.sqft;
  if (hints.approxWidthFt && hints.approxLengthFt) {
    sqft = Math.round(hints.approxWidthFt * hints.approxLengthFt);
    notes.push(`Area from caller dimensions: ${hints.approxWidthFt} × ${hints.approxLengthFt} ft.`);
  } else if (pixels) {
    // Aspect-ratio-informed nudge on the surface default.
    const aspect = pixels.width / Math.max(1, pixels.height);
    sqft = Math.round(defaults.sqft * Math.min(1.4, Math.max(0.7, aspect / 1.33)));
    notes.push("Area nudged by image aspect ratio around the surface-type baseline.");
  } else {
    notes.push(`No dimensions available — using the ${surface} baseline.`);
  }

  return {
    surface,
    sqft,
    depth: defaults.depth,
    condition: hints.conditionNote ?? "assumed weathered sealer / moderate soiling",
    confidence: hints.approxWidthFt ? 0.7 : 0.45,
    source: "offline-heuristic",
    imagePixels: pixels,
    notes: [...notes, "Site measure before work is mandatory — photo quotes carry a measure-to-confirm clause."],
  };
}

export async function estimateFromPhoto(
  imageBase64: string | undefined,
  mediaType: string | undefined,
  hints: VisionHints,
): Promise<VisionEstimate> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !imageBase64) return offlineEstimate(imageBase64, hints);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType ?? "image/jpeg", data: imageBase64 },
              },
              {
                type: "text",
                text: `You estimate abrasive-blasting jobs from photos. Return strict JSON: {"surface": one of ${Object.keys(SURFACE_DEFAULT_SQFT).join("|")}, "sqft": number, "depth": "very-light"|"light"|"medium"|"heavy", "condition": string, "confidence": 0-1}. Hints: ${JSON.stringify(hints)}`,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return offlineEstimate(imageBase64, hints);
    const body = (await res.json()) as { content: { type: string; text?: string }[] };
    const raw = body.content.find((c) => c.type === "text")?.text ?? "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      surface: (json.surface ?? hints.surface ?? "driveway") as SurfaceKind,
      sqft: Math.round(Number(json.sqft) || 300),
      depth: (json.depth ?? "medium") as BlastDepth,
      condition: String(json.condition ?? "unknown"),
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.75)),
      source: "claude-vision",
      notes: ["Claude vision estimate.", "Site measure before work is mandatory — photo quotes carry a measure-to-confirm clause."],
    };
  } catch {
    return offlineEstimate(imageBase64, hints);
  }
}

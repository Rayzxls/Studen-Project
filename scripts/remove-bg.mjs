import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(__dirname, "../public/brand/student-mascot.png");
const outputPath = path.resolve(__dirname, "../public/brand/student-mascot-transparent.png");

const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  // Detect near-white pixels and make them transparent
  const minChannel = Math.min(r, g, b);
  if (minChannel >= 230) {
    // Smooth alpha falloff: 230→semi-transparent, 255→fully transparent
    const alpha = Math.max(0, Math.round((255 - minChannel) * (255 / 25)));
    data[i + 3] = alpha;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(outputPath);

console.log("✅ Transparent mascot saved to", outputPath);

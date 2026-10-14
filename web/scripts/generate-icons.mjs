// Generates the PWA / iOS PNG icons in public/ from the SVG sources in scripts/icons/.
// Usage: npm run icons   (the generated PNGs are committed, so this only runs when the logo changes)
import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = new URL('..', import.meta.url)
const src = (name) => fileURLToPath(new URL(`scripts/icons/${name}`, root))
const out = (name) => fileURLToPath(new URL(`public/${name}`, root))

const rounded = await readFile(src('icon.svg'))
const fullBleed = await readFile(src('icon-full-bleed.svg'))

/** @type {Array<{ file: string; size: number; svg: Buffer; flatten?: boolean }>} */
const targets = [
  { file: 'favicon-48x48.png', size: 48, svg: rounded },
  { file: 'pwa-64x64.png', size: 64, svg: rounded },
  { file: 'pwa-192x192.png', size: 192, svg: rounded },
  { file: 'pwa-512x512.png', size: 512, svg: rounded },
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  { file: 'maskable-icon-512x512.png', size: 512, svg: fullBleed, flatten: true },
  // iOS rounds the corners itself and shows transparency as black: opaque, full-bleed.
  { file: 'apple-touch-icon-180x180.png', size: 180, svg: fullBleed, flatten: true },
]

for (const { file, size, svg, flatten } of targets) {
  let image = sharp(svg, { density: Math.ceil((72 * size) / 512) * 4 }).resize(size, size)
  if (flatten) image = image.flatten({ background: '#047857' })
  await image.png({ compressionLevel: 9 }).toFile(out(file))
  console.log(`✓ public/${file}`)
}

await copyFile(src('icon.svg'), out('favicon.svg'))
console.log('✓ public/favicon.svg')

/**
 * Turns a dump of iPhone photos into web-ready assets.
 *
 *   1. Drop originals into assets-raw/photos/
 *   2. npm run prep:assets
 *
 * Reads from assets-raw/ (gitignored — originals never reach the repo) and
 * writes stripped, resized copies into public/finale/, plus a generated
 * manifest the Finale imports.
 *
 * Three reasons this exists rather than just committing the originals:
 *
 *   - HEIC. iPhones shoot it by default and Chrome cannot display it at all.
 *     Safari can, so this is exactly the bug that looks fine on your phone and
 *     is broken on hers.
 *   - Size. Full-resolution originals are several MB each over cellular.
 *   - GPS. Every iPhone photo embeds the coordinates it was taken at, and this
 *     repo is public.
 *
 * On stripping location: re-encoding through sips does NOT reliably drop it.
 * Measured on this project's own photos, 2 of 8 still carried a GPS IFD after
 * conversion. An `mdls` check missed it too — mdls reads Spotlight's index, so
 * on a freshly written file it reports nothing found, which is indistinguishable
 * from "no location" unless you check the exit status. Both the strip and the
 * verification below therefore work on the JPEG bytes directly.
 *
 * Orientation has to be handled before stripping, not after. iPhones store
 * rotation as EXIF tag 0x112 rather than rotating the pixels, so deleting EXIF
 * from a photo that relies on it lays the image on its side. Rotation is baked
 * into the pixels first; then there's nothing left for the tag to say.
 *
 * Uses sips, which ships with macOS — no dependencies to install.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extname, join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RAW = join(ROOT, 'assets-raw')
const OUT = join(ROOT, 'public', 'finale')
const MANIFEST = join(ROOT, 'src', 'content', 'finale-assets.gen.ts')

const MAX_EDGE = 1400
const QUALITY = 80

const SOURCE_EXTS = new Set(['.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.gif'])

const sips = (args) =>
  execFileSync('sips', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

function dimensions(file) {
  const out = sips(['-g', 'pixelWidth', '-g', 'pixelHeight', file])
  const w = /pixelWidth:\s*(\d+)/.exec(out)
  const h = /pixelHeight:\s*(\d+)/.exec(out)
  return { w: w ? Number(w[1]) : 0, h: h ? Number(h[1]) : 0 }
}

/* --------------------------------------------------------------- JPEG bytes */

/**
 * Walks JPEG segments, handing each to `visit`.
 *
 * Everything from the start-of-scan marker onwards is entropy-coded image data
 * with no segment structure, so parsing stops there.
 */
function eachSegment(buf, visit) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return
  let i = 2
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) return
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      if (visit(marker, i, 2) === false) return
      i += 2
      continue
    }
    if (marker === 0xda) {
      visit(marker, i, buf.length - i)
      return
    }
    const length = (buf[i + 2] << 8) | buf[i + 3]
    if (visit(marker, i, 2 + length) === false) return
    i += 2 + length
  }
}

/** Tag id → value for EXIF IFD0, or an empty map if there's no EXIF. */
function readIfd0(buf) {
  const tags = new Map()
  eachSegment(buf, (marker, offset) => {
    if (marker !== 0xe1) return
    if (buf.subarray(offset + 4, offset + 8).toString('latin1') !== 'Exif') return

    const tiff = offset + 10
    const big = buf.subarray(tiff, tiff + 2).toString('latin1') === 'MM'
    const u16 = (at) => (big ? buf.readUInt16BE(at) : buf.readUInt16LE(at))
    const u32 = (at) => (big ? buf.readUInt32BE(at) : buf.readUInt32LE(at))

    const ifd = tiff + u32(tiff + 4)
    const count = u16(ifd)
    for (let n = 0; n < count; n++) {
      const entry = ifd + 2 + n * 12
      tags.set(u16(entry), u16(entry + 8))
    }
    return false // found it; stop walking
  })
  return tags
}

const GPS_IFD_TAG = 0x8825
const ORIENTATION_TAG = 0x112

const hasLocation = (buf) => readIfd0(buf).has(GPS_IFD_TAG)

/**
 * Rewrites the JPEG without APP1 (EXIF and XMP) or APP13 (IPTC) — the three
 * places a photo can carry coordinates.
 *
 * APP0 (JFIF) and APP2 (ICC colour profile) are kept: neither can hold
 * location, and dropping the colour profile would visibly shift colours.
 */
function stripMetadata(buf) {
  const keep = []
  eachSegment(buf, (marker, offset, length) => {
    const isMetadata = marker === 0xe1 || marker === 0xed
    if (!isMetadata) keep.push(buf.subarray(offset, offset + length))
  })
  return Buffer.concat([buf.subarray(0, 2), ...keep])
}

/** EXIF orientation → the sips arguments that bake it into the pixels. */
const ORIENTATION_FIX = {
  2: [['-f', 'horizontal']],
  3: [['-r', '180']],
  4: [['-f', 'vertical']],
  5: [['-f', 'horizontal'], ['-r', '90']],
  6: [['-r', '90']],
  7: [['-f', 'horizontal'], ['-r', '270']],
  8: [['-r', '270']],
}

/* --------------------------------------------------------------------- main */

if (!existsSync(RAW)) {
  console.log(
    `No assets-raw/ directory yet — nothing to process.\n\n` +
      `When you're ready:\n` +
      `  mkdir -p assets-raw/photos\n` +
      `then drag photos in and re-run.\n`,
  )
}

const sourceDir = join(RAW, 'photos')
const outDir = join(OUT, 'photos')
const photos = []
let leaked = 0

if (!existsSync(sourceDir)) {
  console.log('photos : no assets-raw/photos/, skipping')
} else {
  // Rebuild from scratch so deleting a source file actually removes it.
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const files = readdirSync(sourceDir)
    .filter((f) => SOURCE_EXTS.has(extname(f).toLowerCase()))
    .sort()

  files.forEach((file, i) => {
    const source = join(sourceDir, file)
    const stem = String(i + 1).padStart(2, '0')
    const target = join(outDir, `${stem}.jpg`)

    // -Z fits within the box while preserving aspect ratio.
    sips([
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(QUALITY),
      '-Z', String(MAX_EDGE),
      source,
      '--out', target,
    ])

    // Bake rotation into the pixels before the tag describing it is removed.
    const orientation = readIfd0(readFileSync(target)).get(ORIENTATION_TAG) ?? 1
    const rotated = orientation !== 1
    for (const args of ORIENTATION_FIX[orientation] ?? []) {
      sips([...args, target])
    }

    const stripped = stripMetadata(readFileSync(target))
    writeFileSync(target, stripped)

    if (hasLocation(stripped)) {
      console.error(`  !! ${stem}.jpg still carries GPS coordinates`)
      leaked++
    }

    const { w, h } = dimensions(target)
    const kb = Math.round(stripped.length / 1024)
    photos.push({ src: `photos/${stem}.jpg`, w, h })
    console.log(
      `  ${file} → ${stem}.jpg  ${w}x${h}  ${kb}KB` +
        (rotated ? `  (rotated, was orientation ${orientation})` : ''),
    )
  })

  const totalKb = Math.round(
    photos.reduce((n, _, i) => n + readFileSync(join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`)).length, 0) / 1024,
  )
  console.log(`photos : ${files.length} file(s), ${totalKb}KB total`)
}

writeFileSync(
  MANIFEST,
  `// GENERATED by scripts/prep-assets.mjs — do not edit by hand.
// Re-run \`npm run prep:assets\` after changing anything in assets-raw/.

export interface FinaleAsset {
  /** Relative to the site base URL, under finale/. */
  src: string
  w: number
  h: number
}

export const PHOTOS: FinaleAsset[] = ${JSON.stringify(photos, null, 2)}
`,
)

console.log('\nwrote src/content/finale-assets.gen.ts')

if (leaked > 0) {
  console.error(
    `\nERROR: ${leaked} file(s) kept their location data. Do not push.\n` +
      `  brew install exiftool\n` +
      `  exiftool -gps:all= -xmp:geotag= -overwrite_original public/finale/photos/*.jpg\n`,
  )
  process.exit(1)
}

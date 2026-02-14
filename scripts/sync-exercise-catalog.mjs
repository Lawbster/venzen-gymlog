import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DATASET_URL =
  'https://raw.githubusercontent.com/exercemus/exercises/minified/minified-exercises.json'

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toCatalogEntries(payload) {
  const source = Array.isArray(payload) ? payload : payload?.exercises
  if (!Array.isArray(source)) {
    throw new Error('Unexpected dataset format: expected array or { exercises: [] }')
  }

  const seenNames = new Set()
  const slugCounts = new Map()
  const entries = []

  for (const item of source) {
    const name = normalizeText(item?.name)
    if (!name) {
      continue
    }

    const dedupeKey = name.toLowerCase()
    if (seenNames.has(dedupeKey)) {
      continue
    }
    seenNames.add(dedupeKey)

    const baseSlug = slugify(name) || 'exercise'
    const slugCount = (slugCounts.get(baseSlug) || 0) + 1
    slugCounts.set(baseSlug, slugCount)
    const id = slugCount === 1 ? baseSlug : `${baseSlug}-${slugCount}`

    entries.push({
      id,
      name,
      category: normalizeText(item?.category) || null,
      equipment: asArray(item?.equipment).map(normalizeText).filter(Boolean),
      primaryMuscles: asArray(item?.primary_muscles)
        .map(normalizeText)
        .filter(Boolean),
    })
  }

  entries.sort((left, right) => left.name.localeCompare(right.name))
  return entries
}

async function run() {
  const response = await fetch(DATASET_URL)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText})`)
  }

  const payload = await response.json()
  const catalog = toCatalogEntries(payload)

  const outPath = resolve(process.cwd(), 'src', 'data', 'exercise-catalog.json')
  await writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  console.log(`Synced ${catalog.length} exercises to src/data/exercise-catalog.json`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

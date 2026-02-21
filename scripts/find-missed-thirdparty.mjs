#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

// Usage: node scripts/find-missed-thirdparty.mjs [dataRoot]
// Example: node scripts/find-missed-thirdparty.mjs data

const dataRootArg = process.argv[2] || path.join('data')
const dataRoot = path.isAbsolute(dataRootArg) ? dataRootArg : path.resolve(process.cwd(), dataRootArg)
const missingTcgDir = path.resolve(process.cwd(), 'missing-tcgplayer')
const missingCardmarketDir = path.resolve(process.cwd(), 'missing-cardmarket')

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...await walk(full))
    else if (e.isFile() && full.endsWith('.ts')) files.push(full)
  }
  return files
}

function hasThirdParty(content) {
  return /thirdParty\s*:/m.test(content)
}

function hasTcgplayer(content) {
  return /thirdParty\s*:\s*{[\s\S]*?tcgplayer\s*:/m.test(content)
}

function hasCardmarket(content) {
  return /thirdParty\s*:\s*{[\s\S]*?cardmarket\s*:/m.test(content)
}

function extractNameEn(content) {
  // try to capture name: { en: "..." }
  const m = /name\s*:\s*\{[\s\S]*?en\s*:\s*["'`](.*?)["'`]/m.exec(content)
  return m ? m[1] : null
}

function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function run() {
  try {
    await fs.access(dataRoot)
  } catch (err) {
    console.error(`Data root not found: ${dataRoot}`)
    process.exit(2)
  }

  const allFiles = await walk(dataRoot)
  // group files by the directory that directly contains the .ts files (set folder)
  const dirs = new Map()
  for (const f of allFiles) {
    const dir = path.dirname(f)
    if (!dirs.has(dir)) dirs.set(dir, [])
    dirs.get(dir).push(f)
  }

  await fs.mkdir(missingTcgDir, { recursive: true })
  await fs.mkdir(missingCardmarketDir, { recursive: true })

  let totalTcgMissing = 0
  let totalCardmarketMissing = 0

  for (const [dir, files] of dirs.entries()) {
    const setName = path.basename(dir)
    const tcgMissing = []
    const cardmarketMissing = []

    for (const f of files) {
      const content = await fs.readFile(f, 'utf8')
      const rel = path.relative(process.cwd(), f)
      const id = path.basename(f, '.ts')
      const name = extractNameEn(content)

      if (!hasTcgplayer(content)) {
        tcgMissing.push({ file: rel, id, name })
      }
      if (!hasCardmarket(content)) {
        cardmarketMissing.push({ file: rel, id, name })
      }
    }

    if (tcgMissing.length) {
      totalTcgMissing += tcgMissing.length
      const outPath = path.join(missingTcgDir, `${sanitizeName(setName)}.json`)
      await fs.writeFile(outPath, JSON.stringify({ set: setName, missing: tcgMissing }, null, 2), 'utf8')
      console.log(`Wrote ${tcgMissing.length} missing tcgplayer to ${path.relative(process.cwd(), outPath)}`)
    }

    if (cardmarketMissing.length) {
      totalCardmarketMissing += cardmarketMissing.length
      const outPath = path.join(missingCardmarketDir, `${sanitizeName(setName)}.json`)
      await fs.writeFile(outPath, JSON.stringify({ set: setName, missing: cardmarketMissing }, null, 2), 'utf8')
      console.log(`Wrote ${cardmarketMissing.length} missing cardmarket to ${path.relative(process.cwd(), outPath)}`)
    }
  }

  console.log(`Scanned ${allFiles.length} .ts files under '${path.relative(process.cwd(), dataRoot)}'`)
  console.log(`Total missing tcgplayer: ${totalTcgMissing}`)
  console.log(`Total missing cardmarket: ${totalCardmarketMissing}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

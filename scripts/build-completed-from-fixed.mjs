#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

const fixedPath = path.resolve(process.cwd(), 'missing-cardmarket', 'ancient-origins-fixed.json')
const outPath = path.resolve(process.cwd(), 'missing-cardmarket', 'ancient-origins-completed.json')

async function run() {
  try {
    const raw = await fs.readFile(fixedPath, 'utf8')
    const data = JSON.parse(raw)

    const byCardId = data.byCardId || {}
    const entries = []

    for (const [cardId, info] of Object.entries(byCardId)) {
      const baseIds = info.ids && info.ids.base ? info.ids.base : []
      const cardmarketId = baseIds.length ? baseIds[0] : null
      entries.push({ cardId, cardmarketId, rawCardIds: info.rawCardIds || [] })
    }

    const out = {
      generatedFrom: path.relative(process.cwd(), fixedPath),
      generatedAt: new Date().toISOString(),
      total: entries.length,
      cards: entries
    }

    await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8')
    console.log(`Wrote ${outPath}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()

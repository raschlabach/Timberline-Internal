import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

interface CsvRow {
  activeStatus: string
  item: string
  description: string
  price: string
  width: string
  length: string
  linealFt: string
  boardFt: string
  itemCode: string
  layupWidth: string
  layupLength: string
  customer: string
  specie: string
  product: string
  profile: string
  thickness: string
  itemClass: string
  pcsPerLayup: string
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

function parseDecimal(val: string): number | null {
  if (!val || val === '0.00' || val === '0') return null
  const parsed = parseFloat(val)
  return isNaN(parsed) ? null : parsed
}

function parseInt2(val: string): number | null {
  if (!val) return null
  const parsed = parseInt(val)
  return isNaN(parsed) ? null : parsed
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })
    }

    const rows: CsvRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i])
      if (fields.length < 34) continue

      const customer = fields[28]
      const itemCode = fields[24]
      if (!customer && !itemCode) continue

      rows.push({
        activeStatus: fields[1],
        item: fields[3],
        description: fields[4],
        price: fields[17],
        width: fields[20],
        length: fields[21],
        linealFt: fields[22],
        boardFt: fields[23],
        itemCode: fields[24],
        layupWidth: fields[26],
        layupLength: fields[27],
        customer: fields[28],
        specie: fields[29],
        product: fields[30],
        profile: fields[31],
        thickness: fields[32],
        itemClass: fields[33],
        pcsPerLayup: fields[34] || '',
      })
    }

    const uniqueSpecies = Array.from(new Set(rows.map(r => r.specie).filter(Boolean)))
    const uniqueProducts = Array.from(new Set(rows.map(r => r.product).filter(Boolean)))
    const uniqueProfiles = Array.from(new Set(rows.map(r => r.profile).filter(Boolean)))
    const uniqueCustomers = Array.from(new Set(rows.map(r => r.customer).filter(Boolean)))

    // Step 1: Insert species (check existing first, insert missing)
    const speciesMap = new Map<string, number>()
    const existingSpecies = await query(`SELECT id, name FROM rnr_species`)
    for (const row of existingSpecies.rows) {
      speciesMap.set(row.name, row.id)
    }
    for (const name of uniqueSpecies) {
      if (speciesMap.has(name)) continue
      const code = name.substring(0, 10).toUpperCase().replace(/\s+/g, '')
      const res = await query(
        `INSERT INTO rnr_species (name, code) VALUES ($1, $2) RETURNING id`,
        [name, code]
      )
      speciesMap.set(name, res.rows[0].id)
    }

    // Step 2: Insert product types
    const productTypeMap = new Map<string, number>()
    const existingPT = await query(`SELECT id, name FROM rnr_product_types`)
    for (const row of existingPT.rows) {
      productTypeMap.set(row.name, row.id)
    }
    for (const name of uniqueProducts) {
      if (productTypeMap.has(name)) continue
      const code = name.substring(0, 10).toUpperCase().replace(/\s+/g, '')
      const res = await query(
        `INSERT INTO rnr_product_types (name, code) VALUES ($1, $2) RETURNING id`,
        [name, code]
      )
      productTypeMap.set(name, res.rows[0].id)
    }

    // Step 3: Insert profiles
    const profileMap = new Map<string, number>()
    const existingProfiles = await query(`SELECT id, name FROM rnr_profiles`)
    for (const row of existingProfiles.rows) {
      profileMap.set(row.name, row.id)
    }
    for (const name of uniqueProfiles) {
      if (profileMap.has(name)) continue
      const res = await query(
        `INSERT INTO rnr_profiles (name) VALUES ($1) RETURNING id`,
        [name]
      )
      profileMap.set(name, res.rows[0].id)
    }

    // Step 4: Match customers
    const customerMap = new Map<string, number>()
    for (const custName of uniqueCustomers) {
      const displayName = custName.replace(/_/g, ' ')
      const existing = await query(
        `SELECT id FROM customers WHERE LOWER(REPLACE(customer_name, ' ', '_')) = LOWER($1)
         OR LOWER(customer_name) = LOWER($2)
         LIMIT 1`,
        [custName, displayName]
      )
      if (existing.rows.length > 0) {
        customerMap.set(custName, existing.rows[0].id)
      }
    }

    // Step 5: Check which item codes already exist
    const existingParts = await query(`SELECT qb_item_code FROM rnr_parts WHERE qb_item_code IS NOT NULL`)
    const existingCodes = new Set(existingParts.rows.map((r: { qb_item_code: string }) => r.qb_item_code))

    // Step 6: Insert parts in batches
    let imported = 0
    let skipped = 0
    const unmatchedCustomers: string[] = []

    const partsToInsert = []
    for (const row of rows) {
      if (!row.itemCode) {
        skipped++
        continue
      }

      if (existingCodes.has(row.itemCode)) {
        skipped++
        continue
      }

      const customerId = row.customer ? customerMap.get(row.customer) || null : null
      if (row.customer && !customerId && !unmatchedCustomers.includes(row.customer)) {
        unmatchedCustomers.push(row.customer)
      }

      partsToInsert.push({
        ...row,
        customerId,
        speciesId: row.specie ? speciesMap.get(row.specie) || null : null,
        productTypeId: row.product ? productTypeMap.get(row.product) || null : null,
        profileId: row.profile ? profileMap.get(row.profile) || null : null,
        isActive: row.activeStatus === 'Active',
      })
    }

    // Batch insert 100 at a time to avoid timeout
    const BATCH_SIZE = 100
    for (let i = 0; i < partsToInsert.length; i += BATCH_SIZE) {
      const batch = partsToInsert.slice(i, i + BATCH_SIZE)

      const values: (string | number | boolean | null)[] = []
      const placeholders: string[] = []

      for (let j = 0; j < batch.length; j++) {
        const p = batch[j]
        const base = j * 19
        placeholders.push(
          `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18},$${base+19})`
        )
        values.push(
          p.itemCode,
          p.itemCode,
          p.customerId,
          p.description || null,
          p.speciesId,
          p.productTypeId,
          p.profileId,
          parseDecimal(p.thickness),
          parseDecimal(p.width),
          parseDecimal(p.length),
          parseDecimal(p.boardFt),
          parseDecimal(p.linealFt),
          parseDecimal(p.layupWidth),
          parseDecimal(p.layupLength),
          parseInt2(p.pcsPerLayup),
          p.itemClass || null,
          p.itemCode,
          parseDecimal(p.price),
          p.isActive,
        )
      }

      await query(
        `INSERT INTO rnr_parts (
          rnr_part_number, customer_part_number, customer_id, description,
          species_id, product_type_id, profile_id,
          thickness, width, length, board_feet, lineal_feet,
          layup_width, layup_length, pieces_per_layup,
          item_class, qb_item_code, price, is_active
        ) VALUES ${placeholders.join(',')}`,
        values
      )
      imported += batch.length
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      totalRows: rows.length,
      species: uniqueSpecies.length,
      productTypes: uniqueProducts.length,
      profiles: uniqueProfiles.length,
      unmatchedCustomers,
    })
  } catch (error: unknown) {
    console.error('Error importing parts:', error)
    return NextResponse.json({
      error: 'Failed to import parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

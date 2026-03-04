import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, getClient } from '@/lib/db'

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

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const speciesMap = new Map<string, number>()
      for (const name of uniqueSpecies) {
        const code = name.substring(0, 10).toUpperCase().replace(/\s+/g, '')
        const res = await client.query(
          `INSERT INTO rnr_species (name, code) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [name, code]
        )
        if (res.rows.length > 0) {
          speciesMap.set(name, res.rows[0].id)
        } else {
          const existing = await client.query(
            `SELECT id FROM rnr_species WHERE name = $1`, [name]
          )
          if (existing.rows.length > 0) {
            speciesMap.set(name, existing.rows[0].id)
          }
        }
      }

      const productTypeMap = new Map<string, number>()
      for (const name of uniqueProducts) {
        const code = name.substring(0, 10).toUpperCase().replace(/\s+/g, '')
        const res = await client.query(
          `INSERT INTO rnr_product_types (name, code) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [name, code]
        )
        if (res.rows.length > 0) {
          productTypeMap.set(name, res.rows[0].id)
        } else {
          const existing = await client.query(
            `SELECT id FROM rnr_product_types WHERE name = $1`, [name]
          )
          if (existing.rows.length > 0) {
            productTypeMap.set(name, existing.rows[0].id)
          }
        }
      }

      const profileMap = new Map<string, number>()
      for (const name of uniqueProfiles) {
        const productTypeId = null
        const res = await client.query(
          `INSERT INTO rnr_profiles (name, product_type_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [name, productTypeId]
        )
        if (res.rows.length > 0) {
          profileMap.set(name, res.rows[0].id)
        } else {
          const existing = await client.query(
            `SELECT id FROM rnr_profiles WHERE name = $1`, [name]
          )
          if (existing.rows.length > 0) {
            profileMap.set(name, existing.rows[0].id)
          }
        }
      }

      const customerMap = new Map<string, number>()
      for (const custName of uniqueCustomers) {
        const displayName = custName.replace(/_/g, ' ')
        const existing = await client.query(
          `SELECT id FROM customers WHERE LOWER(REPLACE(name, ' ', '_')) = LOWER($1)
           OR LOWER(name) = LOWER($2)`,
          [custName, displayName]
        )
        if (existing.rows.length > 0) {
          customerMap.set(custName, existing.rows[0].id)
        }
      }

      let imported = 0
      let skipped = 0
      const unmatchedCustomers: string[] = []

      for (const row of rows) {
        if (!row.itemCode) {
          skipped++
          continue
        }

        const customerId = row.customer ? customerMap.get(row.customer) || null : null
        if (row.customer && !customerId && !unmatchedCustomers.includes(row.customer)) {
          unmatchedCustomers.push(row.customer)
        }

        const speciesId = row.specie ? speciesMap.get(row.specie) || null : null
        const productTypeId = row.product ? productTypeMap.get(row.product) || null : null
        const profileId = row.profile ? profileMap.get(row.profile) || null : null
        const isActive = row.activeStatus === 'Active'

        const existing = await client.query(
          `SELECT id FROM rnr_parts WHERE qb_item_code = $1`,
          [row.itemCode]
        )
        if (existing.rows.length > 0) {
          skipped++
          continue
        }

        await client.query(
          `INSERT INTO rnr_parts (
            rnr_part_number, customer_part_number, customer_id, description,
            species_id, product_type_id, profile_id,
            thickness, width, length, board_feet, lineal_feet,
            layup_width, layup_length, pieces_per_layup,
            item_class, qb_item_code, price, is_active
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            row.itemCode,
            row.itemCode,
            customerId,
            row.description || null,
            speciesId,
            productTypeId,
            profileId,
            parseDecimal(row.thickness),
            parseDecimal(row.width),
            parseDecimal(row.length),
            parseDecimal(row.boardFt),
            parseDecimal(row.linealFt),
            parseDecimal(row.layupWidth),
            parseDecimal(row.layupLength),
            parseInt2(row.pcsPerLayup),
            row.itemClass || null,
            row.itemCode,
            parseDecimal(row.price),
            isActive,
          ]
        )
        imported++
      }

      await client.query('COMMIT')

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
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    console.error('Error importing parts:', error)
    return NextResponse.json({
      error: 'Failed to import parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

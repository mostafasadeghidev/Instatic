import { describe, expect, it, beforeEach } from 'bun:test'
import { createSqliteClient } from '../../../db/sqlite'
import { sqliteMigrations } from '../../../db/migrations-sqlite'
import { runMigrations } from '../../../db/runMigrations'
import type { DbClient } from '../../../db/client'
import { createDataTable, getDataTable, getDataTableBySlug, listDataTables } from '../tables'

async function freshDb(): Promise<DbClient> {
  const db = createSqliteClient(':memory:')
  await runMigrations(db, sqliteMigrations)
  return db
}

describe('data_tables.system column', () => {
  let db: DbClient

  beforeEach(async () => {
    db = await freshDb()
  })

  it('is not-null with a false default — a custom table reads system=false', async () => {
    // createDataTable never sets `system`, so it relies on the column default.
    const table = await createDataTable(db, {
      name: 'Products',
      slug: 'products',
      kind: 'data',
      singularLabel: 'Product',
      pluralLabel: 'Products',
    })
    expect(table.system).toBe(false)

    const reread = await getDataTable(db, table.id)
    expect(reread?.system).toBe(false)
  })

  it('reads system=true for the seeded system tables', async () => {
    for (const id of ['pages', 'posts', 'components', 'layouts']) {
      const table = await getDataTable(db, id)
      expect(table).not.toBeNull()
      expect(table?.system).toBe(true)
    }
  })

  it('stores the column as not-null (no null sneaks through)', async () => {
    // Read the raw column straight from SQLite for every row and assert the
    // value is a concrete 0/1, never null.
    const { rows } = await db<{ system: number | null }>`select system from data_tables`
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.system === 0 || row.system === 1).toBe(true)
    }
  })

  it('list and read agree on system flags', async () => {
    const tables = await listDataTables(db)
    const systemSlugs = tables.filter((t) => t.system).map((t) => t.slug).sort()
    expect(systemSlugs).toEqual(['components', 'layouts', 'pages', 'posts'])
  })
})

describe('data_tables.created_by_plugin_id column', () => {
  let db: DbClient

  beforeEach(async () => {
    db = await freshDb()
  })

  it('defaults to null for user-created tables (and the seeded system tables)', async () => {
    const table = await createDataTable(db, {
      name: 'Products',
      slug: 'products',
      kind: 'data',
      singularLabel: 'Product',
      pluralLabel: 'Products',
    })
    expect(table.createdByPluginId).toBeNull()

    for (const id of ['pages', 'posts', 'components', 'layouts']) {
      const system = await getDataTable(db, id)
      expect(system?.createdByPluginId).toBeNull()
    }
  })

  it('persists the creating plugin id and surfaces it on every read path', async () => {
    const created = await createDataTable(db, {
      name: 'Imported Products',
      slug: 'imported-products',
      kind: 'data',
      singularLabel: 'Imported product',
      pluralLabel: 'Imported products',
      createdByPluginId: 'acme.importer',
    })
    expect(created.createdByPluginId).toBe('acme.importer')

    const byId = await getDataTable(db, created.id)
    expect(byId?.createdByPluginId).toBe('acme.importer')

    const bySlug = await getDataTableBySlug(db, 'imported-products')
    expect(bySlug?.createdByPluginId).toBe('acme.importer')

    const listed = await listDataTables(db)
    expect(listed.find((t) => t.slug === 'imported-products')?.createdByPluginId).toBe('acme.importer')
  })
})

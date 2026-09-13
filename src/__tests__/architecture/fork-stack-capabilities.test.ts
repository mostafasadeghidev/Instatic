/**
 * FORK GATE — every fix this branch exists for is still here.
 *
 * `stack/all-fixes` is what real servers are cloned from, and its whole job is
 * to be upstream `main` PLUS a set of changes that are still awaiting review.
 * Merging upstream is routine, and every merge is a chance for one of those
 * changes to be quietly reverted by a conflict resolution — the failure would
 * be invisible until a live site behaved wrong months later.
 *
 * So each one is pinned to a marker in the source that cannot survive its
 * removal. This is a coarse check on purpose: the real behaviour is covered by
 * each fix's own tests, and what this catches is the different, nastier case
 * of a fix vanishing wholesale during a merge.
 *
 * NOT UPSTREAM. This file belongs to the fork and should never be part of a PR
 * to CoreBunch/Instatic.
 *
 * When a PR merges upstream, delete its row — the capability then arrives with
 * `main` and pinning it here would just be noise.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pgMigrations } from '../../../server/db/migrations-pg'
import { sqliteMigrations } from '../../../server/db/migrations-sqlite'

const root = join(import.meta.dir, '../../..')

interface Capability {
  pr: string
  what: string
  file: string
  marker: string
}

const CAPABILITIES: Capability[] = [
  {
    pr: '#334',
    what: 'a format:media binding resolves an asset id to its served URL',
    file: 'src/core/templates/dynamicBindings.ts',
    marker: "format === 'media'",
  },
  {
    pr: '#335',
    what: '@own-created lets a plugin use tables it created at runtime',
    file: 'src/core/data/schemas.ts',
    marker: '@own-created',
  },
  {
    pr: '#336',
    what: 'the install consent dialog renders the contentAccess table list',
    file: 'src/admin/pages/plugins/components/PermissionReviewSection/computeContentAccessDiff.ts',
    marker: 'computeContentAccessDiff',
  },
  {
    pr: '#357',
    what: 'a node can be shown only on the rows where a field is filled in',
    file: 'src/core/page-tree/baseNode.ts',
    marker: 'visibleWhen',
  },
  {
    pr: '#497',
    what: 'a permanent media delete asks before it happens',
    file: 'src/admin/pages/media/components/MediaViewerWindow/MediaViewerWindow.tsx',
    marker: 'purgeConfirmOpen',
  },
  {
    pr: '#499',
    what: "the settings modal's Esc keycap closes the modal it advertises",
    file: 'src/admin/modals/Settings/SettingsModal.tsx',
    marker: 'stops the affordance lying about itself',
  },
  {
    pr: '#500',
    what: 'only the topmost floating surface answers Escape',
    file: 'src/admin/shared/FloatingWindow/useTopmostEscape.ts',
    marker: 'useTopmostEscape',
  },
  {
    pr: '#501',
    what: 'a floating window can be minimized instead of dismissed',
    file: 'src/admin/shared/FloatingWindow/FloatingWindow.tsx',
    marker: 'minimizable',
  },
  {
    pr: '#505',
    what: 'media records what depends on an asset, so a delete can warn',
    file: 'server/repositories/media.ts',
    marker: 'setMediaUsageRef',
  },
  {
    pr: '#507',
    what: 'the permanent-delete confirmation names what still depends on a file',
    file: 'src/admin/pages/media/utils/usageWarning.ts',
    marker: 'resolveUsageWarning',
  },
]

describe('fork stack — every pending fix is still present', () => {
  for (const cap of CAPABILITIES) {
    test(`${cap.pr} — ${cap.what}`, () => {
      let source: string
      try {
        source = readFileSync(join(root, cap.file), 'utf-8')
      } catch {
        throw new Error(
          `[fork-stack] ${cap.pr} lost its file: ${cap.file}\n`
          + `This branch exists to carry that fix. If the PR merged upstream, delete its row here.`,
        )
      }
      if (!source.includes(cap.marker)) {
        throw new Error(
          `[fork-stack] ${cap.pr} is gone from ${cap.file} — "${cap.marker}" not found.\n`
          + `Most likely a merge resolution dropped it. If the PR merged upstream, delete its row here.`,
        )
      }
      expect(source).toContain(cap.marker)
    })
  }

  test('no column is added by two different migrations', () => {
    // The one merge mistake that takes a live server down on boot. This branch
    // carries some migrations under ids installations have already recorded,
    // while the matching upstream PR has to use a different number — #335 is
    // `025_data_tables_created_by_plugin` here and `031_…` upstream. When the
    // PR lands and main merges in, keeping both entries makes every recorded
    // installation run the ALTER a second time, and SQLite has no
    // `add column if not exists` to absorb it. Idempotent migrations (an
    // insert guarded by `not exists`) may be renumbered freely; an ALTER may
    // not, and this is the check that says so.
    for (const [dialect, migrations] of [['sqlite', sqliteMigrations], ['pg', pgMigrations]] as const) {
      const addedBy = new Map<string, string>()
      const duplicates: string[] = []
      for (const migration of migrations) {
        for (const m of migration.sql.matchAll(/alter\s+table\s+(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)) {
          const column = `${m[1]!.toLowerCase()}.${m[2]!.toLowerCase()}`
          const first = addedBy.get(column)
          if (first && first !== migration.id) duplicates.push(`${column}: ${first} and ${migration.id}`)
          else addedBy.set(column, migration.id)
        }
      }
      if (duplicates.length > 0) {
        throw new Error(
          `[fork-stack] ${dialect} migrations add the same column twice:\n  ${duplicates.join('\n  ')}\n`
          + `Keep the id installations already recorded and delete the incoming copy.`,
        )
      }
      expect(duplicates).toEqual([])
    }
  })

  test('the publish failure still tells the author what went wrong', () => {
    // Ours (#358) was superseded by upstream's `RuntimeScriptBuildError`,
    // which reports `path:line:column` where ours reported only the message.
    // The capability has to survive even though our implementation did not —
    // that is precisely the case a file-presence check would miss.
    const source = readFileSync(join(root, 'server/handlers/cms/publish.ts'), 'utf-8')
    expect(source).toContain('RuntimeScriptBuildError')
  })
})

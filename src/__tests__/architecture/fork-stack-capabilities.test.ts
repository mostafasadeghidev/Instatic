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

const root = join(import.meta.dir, '../../..')

interface Capability {
  pr: string
  what: string
  file: string
  marker: string
}

const CAPABILITIES: Capability[] = [
  {
    pr: '#333',
    what: 'definePlugin carries contentAccess into the built manifest',
    file: 'src/core/plugin-sdk/builders/definePlugin.ts',
    marker: 'contentAccess',
  },
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
    pr: '#337',
    what: 'entry tokens interpolate in the published meta title/description',
    file: 'src/core/publisher/render.ts',
    marker: 'interpolateTokens',
  },
  {
    pr: '#348',
    what: "loops filter and sort by a row's own cell",
    file: 'src/core/loops/cellFilter.ts',
    marker: 'cellFilterSql',
  },
  {
    pr: '#349',
    what: 'Site Import reports asset references the archive cannot satisfy',
    file: 'src/core/siteImport/types.ts',
    marker: 'unresolved-asset',
  },
  {
    pr: '#350',
    what: 'a loop can carry custom HTML attributes',
    file: 'src/modules/base/loop/index.ts',
    marker: 'htmlAttributes',
  },
  {
    pr: '#353',
    what: 'tokens interpolate inside htmlAttributes, not just string props',
    file: 'src/core/templates/dynamicBindings.ts',
    marker: 'HTML_ATTRIBUTES_PROP_KEY',
  },
  {
    pr: '#354',
    what: 'published pages may load cross-origin video/audio',
    file: 'src/core/publisher/cspPlan.ts',
    marker: 'media-src',
  },
  {
    pr: '#357',
    what: 'a node can be shown only on the rows where a field is filled in',
    file: 'src/core/page-tree/baseNode.ts',
    marker: 'visibleWhen',
  },
  {
    pr: '#359',
    what: 'a plugin upgrade no longer 404s the assets published pages link',
    file: 'server/publish/stalePluginAssets.ts',
    marker: 'sweepStalePluginVersionAssets',
  },
  {
    pr: '#497',
    what: 'a permanent media delete asks before it happens',
    file: 'src/admin/pages/media/components/MediaViewerWindow/MediaViewerWindow.tsx',
    marker: 'purgeConfirmOpen',
  },
  {
    pr: '#498',
    what: 'a same-version plugin upload is a reinstall, not a first install',
    file: 'server/handlers/cms/plugins/install.ts',
    // #359 removed the old-version asset deletion this fix also had to guard,
    // so what is left to pin is the rollback guard: on a reinstall the "new"
    // version dir IS the restored one, and deleting it would 404 every page.
    marker: "newManifest.version !== existing.version",
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

  test('the publish failure still tells the author what went wrong', () => {
    // Ours (#358) was superseded by upstream's `RuntimeScriptBuildError`,
    // which reports `path:line:column` where ours reported only the message.
    // The capability has to survive even though our implementation did not —
    // that is precisely the case a file-presence check would miss.
    const source = readFileSync(join(root, 'server/handlers/cms/publish.ts'), 'utf-8')
    expect(source).toContain('RuntimeScriptBuildError')
  })
})

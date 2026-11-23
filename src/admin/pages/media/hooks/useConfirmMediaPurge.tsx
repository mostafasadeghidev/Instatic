import { useConfirmDelete } from '@admin/shared/dialogs/ConfirmDeleteDialog'
import type { CmsMediaAsset, CmsMediaUsageRef } from '@core/persistence/cmsMedia'
import { UsageWarningNotice } from '../components/UsageWarningNotice'
import { resolveUsageWarning } from '../utils/usageWarning'

/**
 * Confirm, then purge. `ids` defaults to the one asset; the media canvas's
 * context menu passes the whole selection it acts on, and the dialog then
 * counts the files instead of naming one. What still uses the files is looked
 * up BEFORE the dialog opens, so the warning is part of what the operator
 * reads rather than something that shows up after they have decided.
 */
export function useConfirmMediaPurge(
  purgeAsset: (id: string) => Promise<void>,
  lookupUsage: (assetIds: string[]) => Promise<CmsMediaUsageRef[]>,
) {
  const confirmDelete = useConfirmDelete()
  return (asset: Pick<CmsMediaAsset, 'id' | 'filename'>, ids: readonly string[] = [asset.id]) => {
    const many = ids.length > 1
    void (async () => {
      const warning = await resolveUsageWarning(lookupUsage, [...ids])
      confirmDelete({
        title: many ? `Delete ${ids.length} files permanently?` : `Delete "${asset.filename}" permanently?`,
        description: many
          ? 'This removes every one of these files and all their generated sizes from disk. It cannot be undone.'
          : 'This removes the file and every generated size from disk. It cannot be undone.',
        details: <UsageWarningNotice warning={warning} />,
        confirmLabel: many ? `Delete ${ids.length} files` : 'Delete permanently',
        alwaysConfirm: true,
        commit: () => {
          for (const id of ids) void purgeAsset(id)
        },
      })
    })()
  }
}

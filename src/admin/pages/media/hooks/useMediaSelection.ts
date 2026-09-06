/**
 * Which assets an action acts on, and how a click changes that.
 *
 * Media's selection rules are the file-manager conventions — modifier-aware
 * click, Select All over what is on screen, "act on the selection when you
 * act on something inside it" — and they are shared by three different
 * surfaces: the click handler, the drag payload, and the context menu. They
 * lived inline in `MediaCanvas`, which is a rendering component; every rule
 * added here grew the god-file it was already close to being.
 *
 * The canvas still owns presentation. This owns the answer to "what is
 * selected, and what does this gesture mean".
 */
import { useEffect, useEffectEvent, type DragEvent, type MouseEvent } from 'react'
import type { CmsMediaAsset } from '@core/persistence/cmsMedia'
import type { UseMediaWorkspaceResult } from './useMediaWorkspace'
import { writeMediaAssetDragData } from '../utils/mediaDragDrop'

/**
 * Mac reports the Command key as `metaKey`; everywhere else the same gesture
 * is Control. Read at call time rather than module load so a test can drive
 * either platform.
 */
function isMacLike(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

interface UseMediaSelectionOptions {
  workspace: UseMediaWorkspaceResult
  /** Drag-out is a write; a reader gets the grid but not the payload. */
  canWrite: boolean
  /** Picker mode: plain click toggles assets instead of replacing selection. */
  selectionMode: 'standard' | 'multiple'
}

export interface UseMediaSelectionResult {
  handleAssetClick: (asset: CmsMediaAsset, event: MouseEvent<HTMLButtonElement>) => void
  handleAssetDragStart: (asset: CmsMediaAsset, event: DragEvent<HTMLButtonElement>) => void
  /** Which assets a right-click on `asset` acts on. */
  contextMenuTargets: (asset: CmsMediaAsset) => string[]
  toggleSelectAllVisible: () => void
  /** True when every asset currently on screen is selected. */
  allVisibleSelected: boolean
}

export function useMediaSelection({
  workspace,
  canWrite,
  selectionMode,
}: UseMediaSelectionOptions): UseMediaSelectionResult {
  // Modifier-aware click dispatch:
  //   - plain click → set primary selection (collapses to one)
  //   - Cmd/Ctrl-click → toggle in/out of the multi-selection
  //   - Shift-click → range-select between the current primary and this row
  // Mirrors the convention every grid-style file manager (Finder, Explorer,
  // Photos, Drive, …) uses, so the muscle memory is free.
  function handleAssetClick(asset: CmsMediaAsset, event: MouseEvent<HTMLButtonElement>) {
    if (selectionMode === 'multiple' && !event.shiftKey) {
      event.preventDefault()
      workspace.toggleAssetInSelection(asset.id)
      return
    }
    const meta = isMacLike() ? event.metaKey : event.ctrlKey
    if (event.shiftKey && workspace.selectedAssetId) {
      event.preventDefault()
      workspace.selectRange(workspace.selectedAssetId, asset.id)
      return
    }
    if (meta) {
      event.preventDefault()
      workspace.toggleAssetInSelection(asset.id)
      return
    }
    workspace.setSelectedAssetId(asset.id)
  }

  /**
   * Which assets a gesture acts on.
   *
   * The Finder rule: acting on an item inside the selection acts on the whole
   * selection; acting on one outside it acts on that item alone. The context
   * menu used to ignore the selection entirely, so right-clicking one of five
   * selected files and choosing Delete trashed exactly one and left the other
   * four selected.
   *
   * Deliberately does NOT adopt the clicked asset into the selection the way
   * the site explorer does. Media's floating windows are derived from the
   * selection during render — `viewerOpen` at <= 1, `bulkEditOpen` at >= 2
   * (MediaPage.tsx) — so writing the selection here would pop a window open
   * underneath the menu.
   */
  function targetsFor(asset: CmsMediaAsset): string[] {
    const selectedIds = Array.from(workspace.selectedAssetIds)
    return workspace.selectedAssetIds.has(asset.id) && selectedIds.length > 0
      ? selectedIds
      : [asset.id]
  }

  function handleAssetDragStart(asset: CmsMediaAsset, event: DragEvent<HTMLButtonElement>) {
    if (!canWrite) {
      event.preventDefault()
      return
    }
    writeMediaAssetDragData(event.dataTransfer, targetsFor(asset))
  }

  /**
   * Select everything currently on screen.
   *
   * "Everything" is `visibleAssets` — what the active folder, filter, search
   * and trash toggle have already narrowed to — not the whole library. That is
   * what every file manager means by Select All, and it is the only reading
   * that makes the trash view's "select all, then delete" safe: it cannot
   * reach past the filter into live assets.
   */
  const allVisibleSelected =
    workspace.visibleAssets.length > 0
    && workspace.visibleAssets.every((asset) => workspace.selectedAssetIds.has(asset.id))

  /** Select every visible asset, or clear the selection when it already covers them. */
  function toggleSelectAllVisible() {
    if (workspace.visibleAssets.length === 0) return
    if (allVisibleSelected) {
      workspace.clearSelection()
      return
    }
    workspace.addToSelection(workspace.visibleAssets.map((asset) => asset.id))
  }

  // Ctrl/Cmd+A, the shortcut people try first. Document-level because the grid
  // is a plain div with no tabindex, so a React `onKeyDown` would only fire
  // while focus happened to sit on a tile.
  //
  // Ignored while focus is in a text field — the browser's own select-all is
  // what someone typing in the search box means — and while any dialog is
  // open, so a rename or a delete confirmation keeps its own select-all.
  const selectAllEvent = useEffectEvent(() => toggleSelectAllVisible())
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'a' && event.key !== 'A') return
      if (!(isMacLike() ? event.metaKey : event.ctrlKey)) return
      const target = event.target
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return
      // Only a real MODAL takes the shortcut away. `aria-modal` is what marks
      // one: `Dialog` sets it, the floating windows do not. Matching
      // `role="dialog"` instead disabled the shortcut almost everywhere in
      // Media, because selecting a single asset opens the viewer window — and
      // that carries `role="dialog"` while deliberately leaving the grid
      // usable behind it.
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      selectAllEvent()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    handleAssetClick,
    handleAssetDragStart,
    contextMenuTargets: targetsFor,
    toggleSelectAllVisible,
    allVisibleSelected,
  }
}

/**
 * ModelSelect: the composer's named model seat (`conversation.input.model`).
 *
 * Menu shape (ZCode's model picker, adapted to this house style):
 * - the top bar names the provider currently scoping the list; hovering it
 *   (or ←, Enter, tap) expands a provider column to its LEFT, so the panel
 *   itself never moves or resizes;
 * - the middle is a fixed-height, scrollable model list with its search box —
 *   switching models never grows or shrinks the card;
 * - the bottom row is the thinking-effort control, with its own column;
 * - "Manage models" sits at the bottom of the provider column.
 *
 * Choosing a model (or an effort level) submits through the same session
 * ModelDirectory as the /model popup; the trigger shows the pending selection
 * as a spinner in place of its chevron, and the in-menu strip remains the
 * catalog-load surface. A rejected selection announces through the shared
 * toast anchored to the composer card.
 */
import { MenuSurface, observeStickyMenuGroups } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type FocusEvent, type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { ModelReasoningEffort, ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconCloseFillRegular,
  IconDataOutlineRegular, IconSettingsOutlineMedium, IconWarningOutlineRegular, Input, rankByName,
  StateDot, Tag, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelLabelOwner, ModelSelectInjected } from './slots.ts'
import { css } from './styles.ts'
import { orderModelProviders } from './provider-order.ts'

/** The provider column, opened from the top bar (hover / ← / click). */
type Flyout = 'providers' | null

/** Where keyboard focus goes after a surface/column swap. */
type FocusIntent = 'search' | 'list' | 'provider-first' | 'provider-current'
  | 'header' | null

/** One dynamic effort row; undefined means preserve the provider default. */
interface EffortChoice {
  key: string
  effort: string | undefined
  label: string
}

/** Hover dwell before the provider/effort column opens. */
const HOVER_OPEN_MS = 90
/** Grace period after the pointer leaves the top bar / column. */
const HOVER_CLOSE_MS = 200
/** Rendered width of a side column (measured again after mount). */
const FLYOUT_WIDTH = 240

/** Native thumb diameter; the track's usable span is inset by half of it. */
const SLIDER_THUMB = 26

/** Provider → model → declared input modalities, fetched once per page. */
type CapabilityTable = Record<string, Record<string, readonly string[]>>
let capabilityCache: CapabilityTable | null = null
let capabilityRequest: Promise<CapabilityTable | null> | undefined

/**
 * Read the Host's capability table (served by this plugin's host half).
 * Failures stay uncached so a menu opened before the host route is ready can
 * still show the pills on the next open.
 * @returns the table, or null when the route is unavailable.
 */
function loadCapabilities(): Promise<CapabilityTable | null> {
  if (capabilityCache !== null) return Promise.resolve(capabilityCache)
  capabilityRequest ??= fetch('/model-deck/capabilities', { credentials: 'same-origin' })
    .then(response => response.ok ? response.json() as Promise<CapabilityTable> : null)
    .then((table) => {
      if (table !== null) capabilityCache = table
      return table
    })
    .catch(() => null)
    .finally(() => { capabilityRequest = undefined })
  return capabilityRequest
}

/**
 * Render the composer model seat.
 * @param props - owner share (locked) + injected face (shared directory
 * store/verbs) + the standard locale seat.
 * @returns the trigger and, while open, the model card with its side columns.
 */
export function ModelSelect(
  { locked, available, directory, load, select, resolveText, manageModels, t, renderSlot }:
  ModelSelectInjected & Pick<PropsRuntime<'conversation.input.model'>, 'locked'> & PropsLocale<'model'>
    & Omit<PropsRenderSlots<'conversation.input.model.label' | 'conversation.input.model.options'>, 'SessionProvider'>,
) {
  const state = useSyncExternalStore(
    fn => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [flyout, setFlyout] = useState<Flyout>(null)
  const [scopeProviderId, setScopeProviderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [selectionFocus, setSelectionFocus] = useState(false)
  // The in-menu error strip serves catalog loads (its Retry re-runs the
  // load); a rejected SELECTION announces through the transient toast
  // instead, so the strip renders only while the latest failure-capable
  // action was a load.
  const lastActionRef = useRef<'load' | 'select'>('load')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const flyoutRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const flyoutItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const focusIntent = useRef<FocusIntent>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const [flyoutPos, setFlyoutPos] = useState<{ left: number; top: number } | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityTable | null>(null)
  const id = useId()
  const anchorStyle: CSSProperties & Record<'--dsh-model-anchor', string> = {
    '--dsh-model-anchor': `--dsh-model-${id.replaceAll(':', '')}`,
  }

  const accountProviderName = t('provider.account')
  const groups = useMemo(() => orderModelProviders(state.groups).map(group => ({
    ...group,
    provider: {
      id: group.id,
      name: group.id === 'deepseek-account' ? accountProviderName : group.name,
    },
  })), [state.groups, accountProviderName])
  const multiProvider = groups.length > 1
  const scopedGroup = groups.find(group => group.id === scopeProviderId)
    ?? groups.find(group => group.id === state.current?.provider)
    ?? groups[0]

  // The list is always one provider's models; the search filters that same
  // provider so the top bar stays truthful about what the list contains.
  const models = useMemo(() => rankByName(scopedGroup?.models ?? [], query.trim()), [scopedGroup, query])
  const currentVisibleIndex = models.findIndex(model => model.id === state.current?.model && scopedGroup?.id === state.current.provider)
  const activeModelIndex = models.length === 0
    ? -1
    : Math.min(highlightedIndex ?? Math.max(0, currentVisibleIndex), models.length - 1)

  const currentChoice = state.current === null
    ? undefined
    : groups.flatMap(group => group.models.map(model => ({ group, model })))
      .find(choice => choice.group.id === state.current?.provider && choice.model.id === state.current?.model)

  // Efforts are validated by the Host against THIS route's declaration, so the
  // column may only offer levels the selected route supports. A route without
  // metadata gets a read-only state row instead of a slider that would fail.
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortLabel = currentChoice === undefined
    ? undefined
    : reasoning === undefined
      ? state.retainedEffort ?? state.current?.reasoningEffort
      : effectiveEffort === undefined
        ? t('effort.providerDefault')
        : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort
  const effortChoices = useMemo<readonly EffortChoice[]>(() => reasoning === undefined
    ? []
    : [
      ...reasoning.defaultEffort === undefined
        ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
        : [],
      ...reasoning.efforts.map((effort: ModelReasoningEffort) => ({
        key: `effort:${effort.id}`,
        effort: effort.id,
        label: effort.name,
      })),
    ], [reasoning, t])
  const { pending } = state
  const busy = pending !== null

  // The effort slider is a live control inside the card: dragging previews,
  // releasing applies through the session directory without closing the card.
  const [draftEffortIndex, setDraftEffortIndex] = useState<number | null>(null)
  const effortStops = effortChoices
  // Display-only: tell the reader when the very same model *is* adjustable on
  // another route, so a route without metadata does not read as "no thinking".
  const adjustableElsewhere = useMemo(() => {
    if (state.current === null || reasoning !== undefined) return undefined
    return groups.find(group => group.id !== state.current?.provider
      && group.models.some(model => model.id === state.current?.model && model.reasoning !== undefined))
      ?.provider.name
  }, [groups, reasoning, state.current?.provider, state.current?.model])
  const effortMode = reasoning === undefined
    ? 'unavailable' as const
    : effortChoices.length <= 1 ? 'fixed' as const : 'slider' as const
  // The stop list belongs to the CURRENT model; the saved effort may name a
  // level from a previous model, in which case fall back to this model's
  // default before the lowest stop.
  const declaredEffortIndex = effortStops.findIndex(choice => choice.effort === effectiveEffort)
  const defaultEffortIndex = effortStops.findIndex(choice => choice.effort === reasoning?.defaultEffort)
  const effectiveEffortIndex = declaredEffortIndex >= 0
    ? declaredEffortIndex
    : Math.max(0, defaultEffortIndex)
  const sliderIndex = Math.min(draftEffortIndex ?? effectiveEffortIndex, Math.max(0, effortStops.length - 1))
  const sliderRatio = effortStops.length > 1 ? sliderIndex / (effortStops.length - 1) : 0
  const sliderPercent = sliderRatio * 100
  // One dot per detent; the two tick layers are clipped at the thumb so the
  // filled side gets light dots and the unfilled side dark ones.
  const sliderDots = String(effortStops.length > 1
    ? Array.from({ length: effortStops.length }, (_, index) => {
      const ratio = index / (effortStops.length - 1)
      // Center the end dots half a thumb inside the track: a dot centered on
      // the tick layer's edge paints only half a circle.
      const at = `calc(${SLIDER_THUMB / 2}px + (100% - ${SLIDER_THUMB}px) * ${ratio})`
      return `radial-gradient(circle at ${at} 50%, currentColor 0 2.5px, transparent 2.7px)`
    }).join(', ')
    : 'none')
  const sliderFill = `calc(${SLIDER_THUMB / 2}px + (100% - ${SLIDER_THUMB}px) * ${sliderRatio})`

  const commitEffort = (index: number): void => {
    const stop = effortStops[index]
    if (busy || stop === undefined || state.current === null) {
      setDraftEffortIndex(null)
      return
    }
    if (stop.effort === effectiveEffort) {
      setDraftEffortIndex(null)
      return
    }
    // Keep the picked stop on screen until the saved projection echoes it, so
    // the knob never jumps back to the previous level in between.
    setDraftEffortIndex(index)
    lastActionRef.current = 'select'
    void select({
      provider: state.current.provider,
      model: state.current.model,
      ...stop.effort === undefined ? {} : { reasoningEffort: stop.effort },
    }).then((result) => {
      if (result === undefined || result.ok) return
      setDraftEffortIndex(null)
      toastSeq.current += 1
      setToast({
        seq: toastSeq.current,
        text: result.error.code === 'session/writer-held'
          ? t('error.sessionInUse')
          : t('error.action', { message: `${result.error.code}: ${result.error.message}` }),
      })
    })
  }

  // A different model owns a different stop list: drop any optimistic index
  // left over from the previous one so the knob cannot point at a level the
  // new model does not have.
  useEffect(() => {
    setDraftEffortIndex(null)
  }, [state.current?.provider, state.current?.model])

  // Release the optimistic knob once the durable selection matches it.
  useEffect(() => {
    if (draftEffortIndex === null) return
    const stop = effortStops[draftEffortIndex]
    if (stop !== undefined && stop.effort === effectiveEffort) setDraftEffortIndex(null)
  }, [draftEffortIndex, effectiveEffort, effortStops])

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  const clearTimers = (): void => {
    if (openTimer.current !== undefined) {
      window.clearTimeout(openTimer.current)
      openTimer.current = undefined
    }
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = undefined
    }
  }

  /** Open a side column after a short dwell; hovering must not steal focus. */
  const hoverOpen = (next: Exclude<Flyout, null>): void => {
    clearTimers()
    openTimer.current = window.setTimeout(() => {
      openTimer.current = undefined
      setFlyout(current => current === next ? current : next)
    }, HOVER_OPEN_MS)
  }

  /** Close the side column shortly after the pointer leaves it. */
  const hoverClose = (): void => {
    clearTimers()
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined
      setFlyout(null)
    }, HOVER_CLOSE_MS)
  }

  useEffect(() => () => { clearTimers() }, [])

  // Capabilities are host registry metadata the browser catalog omits; read
  // them once per page and reuse them for every opening.
  useEffect(() => {
    if (!open || capabilities !== null) return
    let cancelled = false
    void loadCapabilities().then((table) => {
      if (!cancelled && table !== null) setCapabilities(table)
    })
    return () => { cancelled = true }
  }, [open, capabilities])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      // Both surfaces are portaled outside the trigger subtree; check each.
      if (rootRef.current?.contains(event.target as Node) === true) return
      if (menuRef.current?.contains(event.target as Node) === true) return
      if (flyoutRef.current?.contains(event.target as Node) === true) return
      setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  // Keep the side column glued to the top bar (providers) or to the effort
  // row's bottom edge (effort), beside the card and inside the viewport.
  useLayoutEffect(() => {
    if (!open || flyout === null) {
      setFlyoutPos(null)
      return
    }
    const place = (): void => {
      const menu = menuRef.current?.getBoundingClientRect()
      if (menu === undefined) return
      const column = flyoutRef.current?.getBoundingClientRect()
      const anchorRow = menuRef.current?.querySelector<HTMLElement>('[data-model-panel-header]')?.getBoundingClientRect()
      const width = column?.width ?? FLYOUT_WIDTH
      const height = column?.height ?? 0
      const gap = 10
      const margin = 8
      // The composer trigger sits at the bottom-right, so the column always
      // opens to the left of the card; only an extremely narrow viewport
      // clamps it to the page margin.
      const left = Math.max(margin, menu.left - width - gap)
      let top = anchorRow?.top ?? menu.top
      if (height > 0) top = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
      const next = { left: Math.round(left), top: Math.round(top) }
      setFlyoutPos(previous => previous !== null
        && previous.left === next.left && previous.top === next.top ? previous : next)
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    if (flyoutRef.current !== null) observer?.observe(flyoutRef.current)
    if (menuRef.current !== null) observer?.observe(menuRef.current)
    window.addEventListener('resize', place)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [open, flyout, scopeProviderId, models])

  // Apply the keyboard intent of a column swap after the new rows mount.
  useEffect(() => {
    if (!open) return
    const intent = focusIntent.current
    focusIntent.current = null
    if (intent === null) return
    if (intent === 'search') {
      searchRef.current?.focus()
      return
    }
    if (intent === 'header') {
      menuRef.current?.querySelector<HTMLElement>('[data-model-panel-header]')?.focus()
      return
    }
    if (intent === 'list') {
      if (models.length > 0) itemRefs.current[0]?.focus()
      return
    }
    const rows = Array.from(flyoutRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]:not([disabled]), button[role="menuitemradio"]:not([disabled])',
    ) ?? [])
    if (intent === 'provider-current') {
      const checked = rows.find(row => row.getAttribute('aria-checked') === 'true')
      ;(checked ?? rows[0])?.focus()
      return
    }
    rows[0]?.focus()
  }, [open, flyout, scopeProviderId, models])

  useEffect(() => {
    const viewport = listRef.current
    if (viewport === null) return
    return observeStickyMenuGroups(viewport)
  }, [available, open, models])

  // Keep the highlighted model visible when the keyboard moves it.
  useLayoutEffect(() => {
    if (open && activeModelIndex >= 0) {
      itemRefs.current[activeModelIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeModelIndex, models])

  if (!available) return null

  const show = (): void => {
    setSelectionFocus(false)
    triggerRef.current?.focus()
    setQuery('')
    setHighlightedIndex(null)
    setFlyout(null)
    setDraftEffortIndex(null)
    clearTimers()
    const provider = state.current?.provider ?? groups[0]?.id ?? null
    setScopeProviderId(provider)
    setOpen(true)
    reload()
  }

  const changeQuery = (next: string): void => {
    setQuery(next)
    setHighlightedIndex(0)
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setFlyout(null)
    setQuery('')
    clearTimers()
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const closeAfterSelection = (): void => {
    setSelectionFocus(true)
    close(true)
  }

  /** Open/toggle a side column from the top bar or effort row. */
  const toggleFlyout = (next: Exclude<Flyout, null>, intent: FocusIntent = null): void => {
    clearTimers()
    if (flyout === next && intent === null) {
      setFlyout(null)
      return
    }
    setFlyout(next)
    if (intent !== null) focusIntent.current = intent
  }

  const closeFlyout = (returnTo: FocusIntent): void => {
    setFlyout(null)
    focusIntent.current = returnTo
  }

  /** Scope the list to one provider (the top bar stays the only provider level). */
  const scopeProvider = (providerId: string): void => {
    setScopeProviderId(providerId)
    setQuery('')
    setHighlightedIndex(0)
    setFlyout(null)
    focusIntent.current = 'header'
  }

  const moveFocus = (offset: number): void => {
    const scope = document.activeElement instanceof Element
      && document.activeElement.closest('[data-model-panel-flyout]') !== null ? flyoutRef : menuRef
    const items = Array.from(scope?.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]:not([disabled]), button[role="menuitemradio"]:not([disabled])',
    ) ?? [])
    if (items.length === 0) return
    const active = items.findIndex(item => item === document.activeElement)
    const next = active === -1
      ? (offset > 0 ? 0 : items.length - 1)
      : (active + offset + items.length) % items.length
    items[next]?.focus()
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      // Escape leaves a side column first, then closes back to the trigger.
      if (flyout !== null) closeFlyout('header')
      else close(true)
      return
    }
    if (!open) return
    const target = event.target instanceof Element ? event.target : null

    if (event.key === 'ArrowLeft' && !(target instanceof HTMLInputElement)) {
      const header = target?.closest<HTMLElement>('[data-model-panel-header]')
      if (header !== null && header !== undefined) {
        event.preventDefault()
        toggleFlyout('providers', 'provider-current')
        return
      }
      if (flyout !== null) {
        event.preventDefault()
        closeFlyout('header')
        return
      }
    }
    if (event.key === 'ArrowRight' && flyout !== null && !(target instanceof HTMLInputElement)) {
      event.preventDefault()
      closeFlyout('header')
      return
    }
    if (target instanceof HTMLInputElement && target.type === 'range') return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (target instanceof HTMLInputElement && target === searchRef.current) {
        event.preventDefault()
        if (!busy && models.length > 0) {
          const direction = event.key === 'ArrowDown' ? 1 : -1
          setHighlightedIndex((activeModelIndex + direction + models.length) % models.length)
        }
        return
      }
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' && target instanceof HTMLInputElement && target === searchRef.current) {
      event.preventDefault()
      const highlighted = models[activeModelIndex]
      if (!busy && highlighted !== undefined && scopedGroup !== undefined) {
        choose({ provider: scopedGroup.id, model: highlighted.id })
      }
      return
    }
    // Tab settles like Enter and Shift+Tab leaves like Escape, so the card's
    // keys mean what they mean in the composer.
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        event.preventDefault()
        if (flyout !== null) closeFlyout('header')
        else close(true)
        return
      }
      const focused = document.activeElement
      if (focused instanceof HTMLButtonElement) {
        event.preventDefault()
        focused.click()
        return
      }
      if (focused !== triggerRef.current) return
      event.preventDefault()
      if (models.length > 0 && !multiProvider) {
        itemRefs.current[activeModelIndex >= 0 ? activeModelIndex : 0]?.focus()
        return
      }
      menuRef.current?.querySelector<HTMLElement>('[data-model-panel-header]')?.focus()
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && (
      rootRef.current?.contains(event.relatedTarget) === true
      || menuRef.current?.contains(event.relatedTarget) === true
      || flyoutRef.current?.contains(event.relatedTarget) === true
    )) return
    close()
  }

  const settleSelection = (result: Awaited<ReturnType<ModelSelectInjected['select']>>, closeOnSuccess: boolean): void => {
    if (result === undefined) return
    if (result.ok) {
      if (closeOnSuccess && rootRef.current !== null) closeAfterSelection()
      return
    }
    const { error } = result
    toastSeq.current += 1
    setToast({
      seq: toastSeq.current,
      text: error.code === 'session/writer-held'
        ? t('error.sessionInUse')
        : t('error.action', { message: `${error.code}: ${error.message}` }),
    })
  }

  const submit = (selection: ModelSelection, closeOnSuccess = false): void => {
    lastActionRef.current = 'select'
    if (closeOnSuccess) {
      // Disabled option rows cannot retain focus while a selection is pending.
      setSelectionFocus(true)
      triggerRef.current?.focus()
    }
    void select(selection).then(result => settleSelection(result, closeOnSuccess))
  }

  // Picking a model updates the card in place; only an outside press or
  // Escape closes it. Clicking the model already in use is a no-op.
  const choose = (selection: ModelSelection): void => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) return
    submit(selection, false)
  }

  const chooseEffort = (effort: string | undefined): void => {
    if (state.current === null) return
    if (effectiveEffort === effort) {
      closeAfterSelection()
      return
    }
    const selection: ModelSelection = {
      provider: state.current.provider,
      model: state.current.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    }
    submit(selection)
  }

  const waiting = currentChoice === undefined && state.status === 'loading'
  const modelLabel = waiting
    ? t('trigger.loading')
    : currentChoice?.model.name
      ?? t('trigger.fallback')
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = waiting
    ? t('trigger.loading')
    : currentChoice === undefined
      ? t('trigger.selectAria')
      : effortLabel === undefined
        ? t('trigger.aria', { model: modelLabel })
        : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
  const renderModelLabel = (
    provider: ModelLabelOwner['provider'], model: ModelLabelOwner['model'],
    placement: ModelLabelOwner['placement'], selected: boolean,
  ) => (
    <span data-provider-id={provider.id} data-model-id={model.id}>
      {renderSlot('conversation.input.model.label', {
        provider, model, placement, selected,
      }, {
        fallback: model.badge === undefined ? model.name : (
          <span className={css.badgedName}>
            {placement === 'trigger' ? <><Tag className={css.badge} tone={model.badge.tone}>{resolveText(model.badge.text)}</Tag>{' '}</> : null}
            <span className={css.badgedNameText}>{model.name}</span>
            {placement === 'trigger' ? null : <>{' '}<Tag className={css.badge} tone={model.badge.tone}>{resolveText(model.badge.text)}</Tag></>}
          </span>
        ),
      })}
    </span>
  )
  let itemIndex = 0
  itemRefs.current = []
  let flyoutIndex = 0
  flyoutItemRefs.current = []
  const flyoutItemRef = () => {
    const at = flyoutIndex++
    return (node: HTMLButtonElement | null) => { flyoutItemRefs.current[at] = node }
  }

  const statusBlock = (
    <>
      {state.status === 'loading' && (
        <div className={css.status}>{t('status.loading')}</div>
      )}
      {state.error !== null && lastActionRef.current === 'load' && (
        <div className={css.error}>
          <span>{t('error.action', { message: state.error })}</span>
          <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
        </div>
      )}
      {state.failures.map(failure => (
        <div className={css.warning} key={failure.id}>
          <span>{t('warning.groupLoad', { name: failure.id === 'deepseek-account' ? t('provider.account') : failure.name, message: failure.message })}</span>
          <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
        </div>
      ))}
    </>
  )

  const modelRows = models.map((model) => {
    const index = itemIndex++
    const selected = scopedGroup?.id === state.current?.provider && model.id === state.current?.model
    const modalities = capabilities?.[scopedGroup?.id ?? '']?.[model.id] ?? []
    return (
      <button
        ref={(node) => { itemRefs.current[index] = node }}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        id={`${id}-model-${index}`}
        tabIndex={0}
        onFocus={() => { setHighlightedIndex(index) }}
        data-highlighted={index === activeModelIndex ? '' : undefined}
        className={clsx(
          css.option, css.modelOption, selected && css.selected, index === activeModelIndex && css.optionActive,
        )}
        onPointerEnter={() => {
          if (!busy && index !== activeModelIndex) setHighlightedIndex(index)
        }}
        key={model.id}
        title={model.name}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (busy) return
          if (scopedGroup !== undefined) choose({ provider: scopedGroup.id, model: model.id })
        }}
      >
        <span className={css.optionCopy}>
          <span className={css.modelName}>
            {scopedGroup === undefined ? model.name : renderModelLabel(scopedGroup.provider, model, 'option', selected)}
          </span>
        </span>
        {modalities.length > 0 && (
          <span className={css.caps}>
            {(modalities.includes('text') ? ['text'] : []).concat(modalities.includes('image') ? ['image'] : [])
              .map(modality => (
                <span key={modality} className={css.cap}>
                  {t(modality === 'image' ? 'capability.image' : 'capability.text')}
                </span>
              ))}
          </span>
        )}
        <span className={css.check}>
          {pending?.provider === scopedGroup?.id && pending.model === model.id
            ? <StateDot state="ongoing" />
            : selected ? <IconCheckOutlineRegular /> : null}
        </span>
      </button>
    )
  })

  const providerRows = groups.map(group => {
    const current = group.id === state.current?.provider
    return (
      <button
        ref={flyoutItemRef()}
        key={group.id}
        type="button"
        role="menuitemradio"
        aria-checked={group.id === scopedGroup?.id}
        className={clsx(css.option, group.id === scopedGroup?.id && css.optionActive)}
        data-provider-id={group.id}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (busy) return
          scopeProvider(group.id)
        }}
      >
        <span className={css.optionCopy}>
          <span className={css.modelName}>{group.provider.name}</span>
        </span>
        <span className={css.check}>
          {current ? <IconCheckOutlineRegular /> : null}
        </span>
      </button>
    )
  })

  const showHeader = multiProvider
  const showManageInPanel = !multiProvider && manageModels !== undefined

  return (
    <div
      ref={rootRef}
      className={css.root}
      onKeyDown={onRootKeyDown}
      onBlur={onBlur}
      onMouseDown={(event) => {
        // WebKit blurs a focused row before click unless the button's mousedown keeps focus.
        if (event.target instanceof Element && event.target.closest('button') !== null) event.preventDefault()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        style={anchorStyle}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        aria-busy={busy}
        data-selection-focus={selectionFocus ? '' : undefined}
        onBlur={() => { setSelectionFocus(false) }}
        disabled={locked}
        onClick={() => {
          if (open) {
            close(true)
          } else {
            show()
          }
        }}
      >
        <IconDataOutlineRegular className={css.triggerIcon} size={16} />
        <span className={css.triggerLabel}>
          {currentChoice === undefined ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, 'trigger', true)}
        </span>
        {effortLabel !== undefined && <span className={css.triggerEffort}>{effortLabel}</span>}
        {busy
          ? <StateDot state="ongoing" />
          : <IconChevronDownOutlineRegular className={clsx(css.chevron, open && css.chevronOpen)} />}
      </button>

      {/* Portaled to body so the sidebar and column overflow clips cannot crop
          the card; synthetic events still bubble through this React subtree,
          keeping onKeyDown/onBlur live. */}
      {open && createPortal(
        <MenuSurface
          ref={menuRef}
          id={`${id}-menu`}
          className={clsx(css.menu, !showHeader && css.menuSingle)}
          style={anchorStyle}
          role="group"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {showHeader && (
            <button
              type="button"
              role="menuitem"
              className={clsx(css.header, flyout === 'providers' && css.headerOpen)}
              data-model-panel-header
              aria-haspopup="menu"
              aria-expanded={flyout === 'providers'}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse') return
                if (flyout === 'providers') { clearTimers(); return }
                hoverOpen('providers')
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== 'mouse') return
                hoverClose()
              }}
              onClick={() => {
                // Hover already opened it on a mouse; a click must not close
                // the column under the pointer. Keyboard/touch users still
                // toggle, because no hover preceded the click.
                if (flyout === 'providers') return
                toggleFlyout('providers', 'provider-current')
              }}
            >
              <span className={css.headerLabel}>
                {scopedGroup === undefined ? t('trigger.fallback') : scopedGroup.provider.name}
              </span>
              <span className={css.headerCount}>{scopedGroup?.models.length ?? 0}</span>
              <IconChevronDownOutlineRegular className={clsx(css.headerChevron, flyout === 'providers' && css.chevronOpen)} />
            </button>
          )}

          <div className={css.searchRow}>
            <Input
              ref={searchRef}
              className={clsx(css.search, query !== '' && css.searchWithQuery)}
              type="text"
              role="searchbox"
              aria-label={t('search.placeholder')}
              aria-controls={`${id}-models`}
              aria-activedescendant={activeModelIndex < 0 ? undefined : `${id}-model-${activeModelIndex}`}
              placeholder={t('search.placeholder')}
              value={query}
              readOnly={busy}
              onChange={(event) => { changeQuery(event.target.value) }}
            />
            {query !== '' && (
              <button
                type="button"
                className={css.searchClear}
                aria-label={t('search.clear')}
                disabled={busy}
                onClick={() => {
                  changeQuery('')
                  searchRef.current?.focus()
                }}
              >
                <IconCloseFillRegular />
              </button>
            )}
          </div>

          {statusBlock}

          <div
            ref={listRef}
            id={`${id}-models`}
            className={clsx(css.list, 'scrollable')}
            role="menu"
            aria-label={scopedGroup?.provider.name ?? t('menu.model')}
            hidden={models.length === 0}
          >
            {modelRows}
          </div>
          {state.status === 'ready' && models.length === 0 && (
            <div className={css.empty} role="status">{t(query.trim() === '' ? 'empty.models' : 'search.empty')}</div>
          )}

          {state.current !== null && (currentChoice !== undefined || state.status === 'ready') && (
            <div className={css.effortPanel}>
              <div className={css.effortHead}>
                <span className={css.effortLabel}>{t('menu.effort')}</span>
                <span
                  className={css.effortValue}
                  title={effortMode === 'unavailable' ? t('effort.unsupportedHint') : undefined}
                >
                  {effortMode === 'unavailable'
                    ? effortLabel ?? t('effort.unsupported')
                    : effortStops[sliderIndex]?.label ?? effortLabel}
                </span>
              </div>
              {effortMode !== 'slider' && (
                <div className={css.effortNote}>
                  {effortMode === 'unavailable'
                    ? `${t('effort.unsupportedHint')}${adjustableElsewhere === undefined ? '' : ` ${t('effort.otherRouteHint', { provider: adjustableElsewhere })}`}`
                    : t('effort.fixedHint')}
                </div>
              )}
              {effortMode === 'slider' && (
                <div className={css.sliderWrap}>
                  <div
                    className={css.sliderTrack}
                    style={{ '--msm-fill': sliderFill } as CSSProperties}
                    aria-hidden="true"
                  >
                    <div className={css.sliderBase} />
                    <div className={css.sliderRest} />
                    <span
                      className={clsx(css.sliderTicks, css.sliderTicksOn)}
                      style={{
                        backgroundImage: sliderDots,
                        clipPath: 'inset(0 calc(100% - var(--msm-fill)) 0 0)',
                      }}
                    />
                    <span
                      className={clsx(css.sliderTicks, css.sliderTicksOff)}
                      style={{
                        backgroundImage: sliderDots,
                        clipPath: 'inset(0 0 0 var(--msm-fill))',
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className={css.effortSlider}
                    min={0}
                    max={Math.max(0, effortStops.length - 1)}
                    step={1}
                    value={sliderIndex}
                    disabled={effortStops.length < 2}
                    aria-label={t('menu.effort')}
                    aria-valuetext={effortStops[sliderIndex]?.label}
                    onChange={(event) => {
                      if (!busy) setDraftEffortIndex(Number(event.target.value))
                    }}
                    onPointerUp={(event) => { commitEffort(Number(event.currentTarget.value)) }}
                    onTouchEnd={(event) => { commitEffort(Number(event.currentTarget.value)) }}
                    onKeyUp={(event) => {
                      if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
                        commitEffort(Number(event.currentTarget.value))
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {renderSlot('conversation.input.model.options', {
            locked,
            dismiss: () => {
              close()
              triggerRef.current?.focus()
            },
            reportFailure: (message) => { setToast({ seq: ++toastSeq.current, text: message }) },
          })}

          {showManageInPanel && (
            <button
              type="button"
              role="menuitem"
              className={css.cell}
              onClick={() => {
                close()
                manageModels?.()
              }}
            >
              <span className={css.cellLabel}>{t('menu.manageModels')}</span>
              <span className={css.cellValue} aria-hidden="true">
                <IconSettingsOutlineMedium className={css.manageIcon} size={14} />
              </span>
            </button>
          )}
        </MenuSurface>,
        document.body,
      )}

      {open && flyout !== null && createPortal(
        <MenuSurface
          ref={flyoutRef}
          id={`${id}-${flyout}`}
          className={css.flyout}
          style={flyoutPos ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="menu"
          aria-label={t('menu.providers')}
          data-model-panel-flyout="providers"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'mouse') return
            clearTimers()
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'mouse') return
            hoverClose()
          }}
        >
          <div className={css.flyoutScroll}>{providerRows}</div>
          {manageModels !== undefined && (
            <div className={css.flyoutFooter}>
              <button
                type="button"
                role="menuitem"
                className={css.cell}
                onClick={() => {
                  close()
                  manageModels()
                }}
              >
                <span className={css.cellLabel}>{t('menu.manageModels')}</span>
                <span className={css.cellValue} aria-hidden="true">
                  <IconSettingsOutlineMedium className={css.manageIcon} size={14} />
                </span>
              </button>
            </div>
          )}
        </MenuSurface>,
        document.body,
      )}

      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutlineRegular />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}

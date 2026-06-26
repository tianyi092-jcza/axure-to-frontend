import { Button, Checkbox, Input, List, Radio, Select } from 'antd'
import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CloseOutlined,
  CopyOutlined,
  CreditCardOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HomeOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MoonOutlined,
  PlusCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { CSSProperties, MouseEvent } from 'react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxureAction, AxurePageData, AxureRepeaterColumn, AxureSharedChrome, AxureWidget } from '../types/axure'
import './AxureRenderer.css'

type Props = {
  page: AxurePageData
  pages: readonly AxurePageData[]
  embedded?: boolean
  onEmbeddedNavigate?: (html: string) => void
}

type ChoiceSelection = {
  checked: boolean
  onChange: (checked: boolean) => void
}

const htmlToRoute = (html: string, pages: readonly AxurePageData[] = []) => {
  const pageKey = html.replace(/\.html(?:$|[?#].*)/i, '').toLowerCase()
  return pages.find((page) => page.pageKey === pageKey || page.html.toLowerCase() === `${pageKey}.html`)?.route ?? `/${pageKey}`
}

const actionIntentText = (action: AxureAction) => `${action.action ?? ''} ${action.description ?? ''}`

const actionWantsHide = (action: AxureAction) =>
  /hide|隐藏/i.test(actionIntentText(action))

const actionWantsShow = (action: AxureAction) =>
  /show|显示/i.test(actionIntentText(action))

const normalizeStateName = (value: string | null | undefined) =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()

const decodeEntities = (value: string | null | undefined) =>
  String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const normalizeDataKey = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase()

const rowValue = (row: Record<string, string>, key: string) => row[normalizeDataKey(key)] ?? row[key] ?? ''

const optionGroupName = (input: { name?: string | null; groupName?: string | null } | null | undefined) =>
  String(input?.groupName || input?.name || '').trim()

const resolveTemplateText = (value: string | null | undefined, row?: Record<string, string>) =>
  decodeEntities(value).replace(/\[\[Item\.([^\]]+)\]\]/gi, (_, key) => rowValue(row ?? {}, key))

const conditionMatches = (conditionString: string | null | undefined, row: Record<string, string>) => {
  const text = decodeEntities(conditionString)
  if (!text.trim()) return true
  const match = text.match(/\[\[Item\.([^\]]+)\]\]\s*==\s*"([^"]*)"/i)
  if (!match) return true
  return rowValue(row, match[1]) === match[2]
}

const parseUpdateAssignments = (description: string | null | undefined) => {
  const text = decodeEntities(description)
  const body = text.match(/\bSet\s+(.+?)\s+for\s+/i)?.[1]
  if (!body) return null
  const updates: Record<string, string> = {}
  for (const part of body.split(/\s*,\s*/)) {
    const match = part.match(/([A-Za-z0-9_\-\u4e00-\u9fa5]+)\s+to\s+"([^"]*)"/i)
    if (match) updates[normalizeDataKey(match[1])] = match[2]
  }
  return Object.keys(updates).length ? updates : null
}

const cssPxToNumber = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

const cssAdd = (base: string | null | undefined, margin: string | null | undefined, offset: number) => {
  const baseValue = base || '0px'
  const marginValue = cssPxToNumber(margin) ?? 0
  const pixelOffset = Number((marginValue + offset).toFixed(3))
  return `calc(${baseValue} + ${pixelOffset}px)`
}

const textAlignMap: Record<string, CSSProperties['textAlign']> = {
  left: 'left',
  center: 'center',
  right: 'right',
}

const alignItemsFor = (widget: AxureWidget): CSSProperties['alignItems'] => {
  if (widget.style.verticalAlign === 'bottom') return 'flex-end'
  if (widget.style.verticalAlign === 'middle') return 'center'
  return 'flex-start'
}

const normalizeFontFamily = (fontFamily: string | null) => {
  if (!fontFamily) return undefined
  return fontFamily.replace(/Applied font/g, 'Inter')
}

const iconMap: Record<string, typeof AppstoreOutlined> = {
  bell: BellOutlined,
  book: BookOutlined,
  calendar: CalendarOutlined,
  close: CloseOutlined,
  contacts: TeamOutlined,
  copy: CopyOutlined,
  create: PlusCircleOutlined,
  delete: DeleteOutlined,
  dashboard: AppstoreOutlined,
  down: DownOutlined,
  download: DownloadOutlined,
  edit: EditOutlined,
  file: FileTextOutlined,
  generic: AppstoreOutlined,
  global: GlobalOutlined,
  help: QuestionCircleOutlined,
  home: HomeOutlined,
  link: LinkOutlined,
  menu: MenuFoldOutlined,
  moon: MoonOutlined,
  search: SearchOutlined,
  setting: SettingOutlined,
  share: ShareAltOutlined,
  summary: FileTextOutlined,
  team: TeamOutlined,
  transaction: CreditCardOutlined,
  upload: UploadOutlined,
  user: UserOutlined,
  video: VideoCameraOutlined,
  'customer-service': CustomerServiceOutlined,
}

const transparentColor = (value: string | null | undefined) => {
  if (!value) return true
  const rgba = value.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i)
  return rgba ? Number(rgba[1]) === 0 : false
}

function useVisibleWidgets(page: AxurePageData) {
  const initialVisibleIds = useMemo(
    () => new Set(page.widgets.filter((widget) => widget.initiallyVisible).map((widget) => widget.id)),
    [page],
  )
  const defaultPanelStateByPanelId = useMemo(() => {
    const stateByPanel = new Map<string, { id: string; index: number }>()
    page.widgets.forEach((widget) => {
      if (!widget.targetPanelId || !widget.panelStateId) return
      const index = widget.panelStateIndex ?? Number.MAX_SAFE_INTEGER
      const current = stateByPanel.get(widget.targetPanelId)
      if (!current || index < current.index || widget.panelStateIsDefault) {
        stateByPanel.set(widget.targetPanelId, { id: widget.panelStateId, index })
      }
    })
    return new Map(Array.from(stateByPanel.entries()).map(([panelId, state]) => [panelId, state.id]))
  }, [page])
  const panelStateIdByLabel = useMemo(() => {
    const stateByPanel = new Map<string, Map<string, string>>()
    page.widgets.forEach((widget) => {
      if (!widget.targetPanelId || !widget.panelStateId) return
      const labels = [widget.panelStateLabel, widget.panelStateId]
      labels.forEach((label) => {
        const normalized = normalizeStateName(label)
        if (!normalized) return
        if (!stateByPanel.has(widget.targetPanelId!)) stateByPanel.set(widget.targetPanelId!, new Map())
        stateByPanel.get(widget.targetPanelId!)!.set(normalized, widget.panelStateId!)
      })
    })
    return stateByPanel
  }, [page])
  const [forcedVisible, setForcedVisible] = useState<Set<string>>(new Set())
  const [forcedHidden, setForcedHidden] = useState<Set<string>>(new Set())
  const [panelStates, setPanelStates] = useState<Map<string, string>>(new Map())

  const resolvePanelStateId = (panelId: string, stateName: string | null) => {
    const normalized = normalizeStateName(stateName)
    if (!normalized) return null
    return panelStateIdByLabel.get(panelId)?.get(normalized) ?? null
  }

  const isVisible = (widget: AxureWidget) => {
    if (widget.coveredBySharedChrome) return false
    if (widget.coveredByRepeaterId) return false
    if (forcedHidden.has(widget.id)) return false
    if (widget.targetPanelId && forcedHidden.has(widget.targetPanelId)) return false
    if (widget.htmlHidden && !initialVisibleIds.has(widget.id) && !forcedVisible.has(widget.id)) return false
    if (
      widget.hiddenAncestorPanelIds.some(
        (panelId) => forcedHidden.has(panelId) || (!initialVisibleIds.has(panelId) && !forcedVisible.has(panelId)),
      )
    ) {
      return false
    }
    if (widget.targetPanelId && widget.panelStateId) {
      const activeStateId = panelStates.get(widget.targetPanelId) || defaultPanelStateByPanelId.get(widget.targetPanelId)
      if (activeStateId && widget.panelStateId !== activeStateId) return false
    }
    if (initialVisibleIds.has(widget.id) || forcedVisible.has(widget.id)) return true
    if (widget.targetPanelId) {
      const panelIsVisible = initialVisibleIds.has(widget.targetPanelId) || forcedVisible.has(widget.targetPanelId)
      if (panelIsVisible && widget.panelStateId && panelStates.get(widget.targetPanelId) === widget.panelStateId) return true
      if (forcedVisible.has(widget.targetPanelId)) return true
    }
    return false
  }

  const showTargets = (ids: string[]) => {
    setForcedHidden((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setForcedVisible((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const hideTargets = (ids: string[]) => {
    setForcedVisible((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setForcedHidden((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const setPanelStateTargets = (updates: Array<{ panelId: string; stateId: string }>) => {
    if (!updates.length) return
    setPanelStates((current) => {
      const next = new Map(current)
      updates.forEach(({ panelId, stateId }) => next.set(panelId, stateId))
      return next
    })
  }

  return { isVisible, showTargets, hideTargets, resolvePanelStateId, setPanelStateTargets }
}

function widgetStyle(widget: AxureWidget, zIndex: number): CSSProperties {
  const { absoluteBounds, style } = widget
  const choiceControl = widget.kind === 'checkbox' || widget.kind === 'radio'
  const imageLike = widget.kind === 'image' || widget.kind === 'icon'
  const estimatedChoiceWidth = choiceControl && widget.text ? 30 + Array.from(widget.text).length * 8 : 0
  const layoutWidth = cssPxToNumber(widget.layout.width)
  const layoutHeight = cssPxToNumber(widget.layout.height)
  const width = Math.max(layoutWidth ?? absoluteBounds.width, estimatedChoiceWidth, 1)
  const height = Math.max(layoutHeight ?? absoluteBounds.height, choiceControl ? 20 : 1)
  const backgroundColor = widget.kind === 'text' || imageLike ? 'transparent' : style.fill ?? 'transparent'
  const borderColor = style.border ?? 'transparent'
  const color = style.color && style.color !== 'rgba(0, 0, 0, 1)' ? style.color : undefined
  const fixedDescendant = widget.fixedAncestor && widget.fixedOffset
  const fixedSelf = widget.layout.position === 'fixed'
  const positionStyle: CSSProperties = fixedDescendant
    ? {
        position: 'fixed',
        left: cssAdd(widget.fixedAncestor?.left, widget.fixedAncestor?.marginLeft, widget.fixedOffset?.x ?? 0),
        top: cssAdd(widget.fixedAncestor?.top, widget.fixedAncestor?.marginTop, widget.fixedOffset?.y ?? 0),
        zIndex: 1000 + zIndex,
      }
    : fixedSelf
      ? {
          position: 'fixed',
          left: widget.layout.left ?? absoluteBounds.x,
          top: widget.layout.top ?? absoluteBounds.y,
          marginLeft: widget.layout.marginLeft ?? undefined,
          marginTop: widget.layout.marginTop ?? undefined,
          zIndex: 1000 + zIndex,
        }
      : {
          position: 'absolute',
          left: absoluteBounds.x,
          top: absoluteBounds.y,
          zIndex,
        }

  return {
    ...positionStyle,
    width,
    height,
    boxSizing: 'border-box',
    overflow: widget.kind === 'panel' || choiceControl ? 'visible' : 'hidden',
    display: 'flex',
    alignItems: alignItemsFor(widget),
    justifyContent: widget.style.textAlign === 'center' ? 'center' : 'flex-start',
    padding: widget.text && !choiceControl ? '2px' : 0,
    fontFamily: normalizeFontFamily(style.fontFamily),
    fontSize: style.fontSize ?? undefined,
    fontWeight: style.fontWeight ?? undefined,
    textAlign: style.textAlign ? textAlignMap[style.textAlign] ?? 'left' : 'left',
    color,
    backgroundColor,
    borderStyle: style.borderWidth > 0 ? 'solid' : 'none',
    borderWidth: style.borderWidth || 0,
    borderColor,
    borderRadius: style.radius || 0,
    opacity: style.opacity ?? undefined,
  }
}

function AxureInput({ widget }: { widget: AxureWidget }) {
  const value = widget.input?.value || widget.text
  const placeholder = widget.input?.placeholder || undefined
  const type = widget.input?.type === 'password' ? 'password' : 'text'
  return (
    <Input
      className="ax-control ax-input"
      type={type}
      defaultValue={value}
      placeholder={placeholder}
      disabled={widget.input?.disabled}
      size="small"
    />
  )
}

function AxureSelect({ widget }: { widget: AxureWidget }) {
  const options = widget.options.length
    ? widget.options.map((option) => ({ value: option.value || option.text, label: option.text }))
    : widget.text
      ? [{ value: widget.text, label: widget.text }]
      : []
  const selected = widget.options.find((option) => option.selected)
  return (
    <Select
      className="ax-control ax-select"
      defaultValue={selected?.value || options[0]?.value}
      options={options}
      disabled={widget.input?.disabled}
      size="small"
    />
  )
}

function AxureChoice({ widget, selection }: { widget: AxureWidget; selection: ChoiceSelection }) {
  if (widget.kind === 'radio') {
    return (
      <Radio
        className="ax-choice ax-radio"
        checked={selection.checked}
        disabled={widget.input?.disabled}
        name={widget.input?.name || widget.input?.groupName || undefined}
        onChange={(event) => selection.onChange(event.target.checked)}
      >
        {widget.text}
      </Radio>
    )
  }
  return (
    <Checkbox
      className="ax-choice ax-checkbox"
      checked={selection.checked}
      disabled={widget.input?.disabled}
      name={widget.input?.name || widget.input?.groupName || undefined}
      onChange={(event) => selection.onChange(event.target.checked)}
    >
      {widget.text}
    </Checkbox>
  )
}

function AxureIcon({ widget }: { widget: AxureWidget }) {
  const Icon = iconMap[widget.iconRole || 'generic'] || AppstoreOutlined
  const size = Math.max(12, Math.min(28, Math.max(widget.absoluteBounds.width, widget.absoluteBounds.height)))
  const fillColor = widget.style.fill
  const textColor = widget.style.color
  const color =
    fillColor && !transparentColor(fillColor)
      ? fillColor
      : textColor && textColor !== 'rgba(51, 51, 51, 1)'
        ? textColor
        : 'rgba(242, 242, 242, 0.92)'
  return <Icon className="ax-icon" style={{ color, fontSize: size }} />
}

type RunAxureAction = (action: AxureAction, row?: Record<string, string>) => void

function SharedSideNav({
  sharedChrome,
  currentRoute,
  onAction,
  onNavigate,
}: {
  sharedChrome: AxureSharedChrome | null | undefined
  currentRoute: string
  onAction: RunAxureAction
  onNavigate: (route: string) => void
}) {
  if (!sharedChrome?.items.length) return null
  const { railBounds } = sharedChrome

  return (
    <nav
      className="ax-shared-side-nav"
      data-shared-chrome-kind={sharedChrome.kind}
      style={{
        left: railBounds.x,
        top: railBounds.y,
        width: railBounds.width,
        height: railBounds.height,
      }}
    >
      {sharedChrome.items.map((item) => {
        const Icon = iconMap[item.role || 'generic'] || AppstoreOutlined
        const active = Boolean(item.route && item.route === currentRoute)
        const hasClickAction = item.interactions.some((interaction) => /click|onClick/i.test(interaction.eventKey))
        const disabled = !hasClickAction && !item.route
        return (
          <button
            aria-label={item.label}
            className={`ax-shared-nav-item${active ? ' is-active' : ''}`}
            data-shared-nav-item={item.key}
            data-icon-role={item.role}
            data-nav-label={item.label}
            data-nav-route={item.route ?? undefined}
            disabled={disabled}
            key={item.key}
            onClick={(event) => {
              event.stopPropagation()
              let handled = false
              for (const interaction of item.interactions) {
                if (!/click|onClick/i.test(interaction.eventKey)) continue
                for (const caseItem of interaction.cases) {
                  if (caseItem.disabled || !conditionMatches(caseItem.conditionString, {})) continue
                  caseItem.actions.forEach((action) => onAction(action))
                  handled = true
                }
              }
              if (!handled && item.route) onNavigate(item.route)
            }}
            style={{
              left: item.bounds.x - railBounds.x,
              top: item.bounds.y - railBounds.y,
              width: item.bounds.width,
              height: item.bounds.height,
            }}
            title={item.label}
            type="button"
          >
            <Icon className="ax-shared-nav-icon" />
          </button>
        )
      })}
    </nav>
  )
}

function fallbackRows(widget: AxureWidget) {
  if (!Array.isArray(widget.data)) return []
  return widget.data.map((row, index) => {
    const normalized: Record<string, string> = { index: String(index + 1) }
    for (const [key, value] of Object.entries((row ?? {}) as Record<string, unknown>)) {
      if (value && typeof value === 'object' && 'text' in value) {
        normalized[normalizeDataKey(key)] = String((value as { text?: unknown }).text ?? '')
      } else {
        normalized[normalizeDataKey(key)] = String(value ?? '')
      }
    }
    return normalized
  })
}

function fallbackColumns(rows: Array<Record<string, string>>): AxureRepeaterColumn[] {
  const keys = Object.keys(rows[0] ?? {})
  return keys.map((key, index) => ({
    key,
    sourceKey: key,
    label: key,
    scriptId: null,
    text: '',
    kind: 'text',
    bounds: { x: index * 120, y: 0, width: 120, height: 32 },
    textAlign: key === 'index' ? 'center' : 'left',
    verticalAlign: 'middle',
    fontSize: null,
    fontWeight: null,
    color: null,
    fill: null,
    border: null,
    radius: 0,
    borderWidth: 0,
    input: null,
    assetRefs: [],
    interactive: false,
    interactions: [],
    rowActions: [],
  }))
}

function cssTextAlign(value: string | null | undefined): CSSProperties['textAlign'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'right' || normalized === 'far') return 'right'
  if (normalized === 'center' || normalized === 'middle') return 'center'
  return 'left'
}

function cssAlignItems(value: string | null | undefined): CSSProperties['alignItems'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'top') return 'flex-start'
  if (normalized === 'bottom') return 'flex-end'
  return 'center'
}

function cssJustifyContent(value: string | null | undefined): CSSProperties['justifyContent'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'right' || normalized === 'far') return 'flex-end'
  if (normalized === 'center' || normalized === 'middle') return 'center'
  return 'flex-start'
}

function RepeaterRows({ widget, onAction }: { widget: AxureWidget; onAction: RunAxureAction }) {
  const sourceRows = widget.repeater?.rows.length ? widget.repeater.rows : fallbackRows(widget)
  const [rows, setRows] = useState(sourceRows)
  const [choiceState, setChoiceState] = useState<Record<string, boolean>>({})
  const columns = widget.repeater?.columns.length ? widget.repeater.columns : fallbackColumns(rows)
  const layout = widget.repeater?.layout
  const itemWidth = Math.max(24, layout?.itemWidth || widget.repeater?.templateWidth || widget.bounds.width || 120)
  const itemHeight = Math.max(24, layout?.itemHeight || widget.repeater?.rowHeight || 32)
  const horizontalSpacing = Math.max(0, layout?.horizontalSpacing ?? 0)
  const verticalSpacing = Math.max(0, layout?.verticalSpacing ?? 0)
  const wrap = layout?.wrap && layout.wrap > 0 ? layout.wrap : 1
  const isHorizontalWrap = Boolean(layout && layout.vertical === false && wrap > 1)
  const rowHeight = Math.max(itemHeight, widget.repeater?.rowHeight ?? itemHeight)
  const templateWidth =
    widget.repeater?.templateWidth ?? columns.reduce((max, column) => Math.max(max, column.bounds.x + column.bounds.width), 0)
  const constrainedWidth = Math.max(0, widget.absoluteBounds.width || widget.bounds.width || templateWidth)
  const widthScale = templateWidth > constrainedWidth && constrainedWidth > 0 ? constrainedWidth / templateWidth : 1
  const itemWidthScale = !isHorizontalWrap && itemWidth > constrainedWidth && constrainedWidth > 0 ? constrainedWidth / itemWidth : 1
  const contentHeight = isHorizontalWrap
    ? Math.ceil(rows.length / wrap) * itemHeight + Math.max(0, Math.ceil(rows.length / wrap) - 1) * verticalSpacing
    : rows.length * itemHeight + Math.max(0, rows.length - 1) * verticalSpacing
  if (!rows.length) return null

  const runColumnInteractions = (column: AxureRepeaterColumn, row: Record<string, string>, rowIndex: number) => {
    let changed = false
    let nextRow = row
    for (const rowAction of column.rowActions || []) {
      if (rowAction.condition && rowValue(row, rowAction.condition.key) !== rowAction.condition.value) continue
      nextRow = { ...nextRow, ...rowAction.updates }
      changed = true
      break
    }
    for (const interaction of column.interactions || []) {
      if (!/click|onClick/i.test(interaction.eventKey)) continue
      for (const caseItem of interaction.cases || []) {
        if (caseItem.disabled || !conditionMatches(caseItem.conditionString, row)) continue
        for (const action of caseItem.actions) {
          if (action.action === 'updateItemsInDataSet') {
            const updates = parseUpdateAssignments(action.description)
            if (updates) {
              nextRow = { ...nextRow, ...updates }
              changed = true
            }
          } else {
            onAction(action, row)
          }
        }
      }
    }
    if (changed) {
      setRows((current) => current.map((item, index) => (index === rowIndex ? nextRow : item)))
    }
  }

  const choiceKey = (rowIndex: number, column: AxureRepeaterColumn) => `${rowIndex}:${column.key}`
  const radioGroupKey = (rowIndex: number, column: AxureRepeaterColumn) => {
    const group = optionGroupName(column.input) || column.sourceKey || column.key
    return `${widget.scriptId}:${layout?.isolateRadio ? rowIndex : 'all'}:${group}`
  }
  const isChoiceChecked = (rowIndex: number, column: AxureRepeaterColumn) => {
    const key = choiceKey(rowIndex, column)
    if (key in choiceState) return choiceState[key]
    return Boolean(column.input?.checked)
  }
  const setChoiceChecked = (
    rowIndex: number,
    column: AxureRepeaterColumn,
    checked: boolean,
    row: Record<string, string>,
  ) => {
    if (column.kind === 'radio') {
      const groupKey = radioGroupKey(rowIndex, column)
      setChoiceState((current) => {
        const next = { ...current }
        rows.forEach((_, candidateIndex) => {
          columns
            .filter((candidate) => candidate.kind === 'radio' && radioGroupKey(candidateIndex, candidate) === groupKey)
            .forEach((candidate) => {
              next[choiceKey(candidateIndex, candidate)] = false
            })
        })
        next[choiceKey(rowIndex, column)] = true
        return next
      })
    } else {
      setChoiceState((current) => ({ ...current, [choiceKey(rowIndex, column)]: checked }))
    }
    if (column.interactive || column.rowActions.length > 0) runColumnInteractions(column, row, rowIndex)
  }

  return (
    <List
      className="ax-repeater"
      data-repeater-component="antd-list"
      data-repeater-row-count={rows.length}
      dataSource={rows}
      renderItem={(row, index) => (
        <List.Item
          className="ax-repeater-row"
          key={index}
          style={{
            left: isHorizontalWrap ? (index % wrap) * (itemWidth + horizontalSpacing) : 0,
            top: isHorizontalWrap
              ? Math.floor(index / wrap) * (itemHeight + verticalSpacing)
              : index * (itemHeight + verticalSpacing),
            width: isHorizontalWrap ? itemWidth : Math.min(itemWidth, constrainedWidth || itemWidth),
            minHeight: itemHeight,
            height: itemHeight,
          }}
        >
          {columns.map((column) => {
            const value = rowValue(row, column.key) || column.text
            const interactive = column.interactive || column.rowActions.length > 0
            const partScale = isHorizontalWrap ? 1 : itemWidthScale || widthScale
            const left = Math.max(0, column.bounds.x * partScale)
            const top = Math.max(0, column.bounds.y)
            const width = Math.max(1, column.bounds.width * partScale)
            const height = Math.max(1, column.bounds.height)
            const isChoice = column.kind === 'radio' || column.kind === 'checkbox'
            const isBackgroundOnly = !interactive && !value && !isChoice && !column.assetRefs.length
            return (
              <span
                className={`ax-repeater-cell ax-repeater-part-${column.kind}${interactive ? ' is-interactive' : ''}${isBackgroundOnly ? ' is-background' : ''}`}
                data-script-id={column.scriptId ?? undefined}
                data-repeater-column={column.key}
                key={column.key}
                style={{
                  left,
                  top,
                  width,
                  height,
                  textAlign: cssTextAlign(column.textAlign),
                  justifyContent: cssJustifyContent(column.textAlign),
                  alignItems: cssAlignItems(column.verticalAlign),
                  fontSize: column.fontSize ?? undefined,
                  fontWeight: column.fontWeight ?? undefined,
                  color: column.color ?? undefined,
                  background: column.fill ?? undefined,
                  borderColor: column.border ?? undefined,
                  borderWidth: column.borderWidth ? column.borderWidth : undefined,
                  borderStyle: column.borderWidth ? 'solid' : undefined,
                  borderRadius: column.radius || undefined,
                }}
                onClick={interactive ? (event) => {
                  event.stopPropagation()
                  runColumnInteractions(column, row, index)
                } : undefined}
              >
                {isChoice ? (
                  column.kind === 'radio' ? (
                    <Radio
                      className="ax-choice ax-radio ax-repeater-choice"
                      checked={isChoiceChecked(index, column)}
                      disabled={column.input?.disabled}
                      onChange={(event) => setChoiceChecked(index, column, event.target.checked, row)}
                    />
                  ) : (
                    <Checkbox
                      className="ax-choice ax-checkbox ax-repeater-choice"
                      checked={isChoiceChecked(index, column)}
                      disabled={column.input?.disabled}
                      onChange={(event) => setChoiceChecked(index, column, event.target.checked, row)}
                    />
                  )
                ) : value}
              </span>
            )
          })}
        </List.Item>
      )}
      style={{
        ['--ax-repeater-template-width' as string]: `${Math.min(templateWidth, constrainedWidth || templateWidth)}px`,
        ['--ax-repeater-content-height' as string]: `${contentHeight}px`,
      }}
    />
  )
}

function pageForHtml(pages: readonly AxurePageData[], html: string | null | undefined) {
  const pageKey = String(html ?? '').replace(/\.html(?:$|[?#].*)/i, '').toLowerCase()
  if (!pageKey) return null
  return pages.find((page) => page.pageKey === pageKey || page.html.toLowerCase() === `${pageKey}.html`) ?? null
}

function AxureInlineFrame({
  widget,
  pages,
  targetHtml,
  onFrameNavigate,
}: {
  widget: AxureWidget
  pages: readonly AxurePageData[]
  targetHtml: string | null
  onFrameNavigate: (widgetId: string, html: string) => void
}) {
  const framePage = pageForHtml(pages, targetHtml)
  if (!framePage) {
    return (
      <div className="ax-inline-frame is-empty" data-frame-target={targetHtml ?? undefined}>
        {targetHtml ?? widget.label ?? widget.scriptId}
      </div>
    )
  }

  return (
    <div className="ax-inline-frame" data-frame-target={framePage.html}>
      <AxureRenderer
        embedded
        page={framePage}
        pages={pages}
        onEmbeddedNavigate={(html) => onFrameNavigate(widget.id, html)}
      />
    </div>
  )
}

function WidgetContent({
  widget,
  text,
  onAction,
  pages,
  frameTargetHtml,
  onFrameNavigate,
  choiceSelection,
}: {
  widget: AxureWidget
  text: string
  onAction: RunAxureAction
  pages: readonly AxurePageData[]
  frameTargetHtml: string | null
  onFrameNavigate: (widgetId: string, html: string) => void
  choiceSelection: ChoiceSelection
}) {
  const textWidget = { ...widget, text }
  if (widget.kind === 'iframe') {
    return <AxureInlineFrame widget={widget} pages={pages} targetHtml={frameTargetHtml} onFrameNavigate={onFrameNavigate} />
  }
  if (widget.kind === 'input') return <AxureInput widget={textWidget} />
  if (widget.kind === 'select') return <AxureSelect widget={textWidget} />
  if (widget.kind === 'checkbox' || widget.kind === 'radio') return <AxureChoice widget={textWidget} selection={choiceSelection} />
  if (widget.kind === 'repeater') return <RepeaterRows widget={widget} onAction={onAction} />
  if (widget.kind === 'icon') return <AxureIcon widget={widget} />
  if (widget.kind === 'image' && widget.assetRefs[0]) {
    return <img className="ax-image" src={widget.assetRefs[0]} alt={widget.label || text || widget.scriptId} />
  }

  if (widget.kind === 'button') {
    return (
      <Button className="ax-button" size="small" type="text">
        {text}
      </Button>
    )
  }

  if (text) return <span className="ax-text">{text}</span>
  return null
}

export function AxureRenderer({ page, pages, embedded = false, onEmbeddedNavigate }: Props) {
  const navigate = useNavigate()
  const { isVisible, showTargets, hideTargets, resolvePanelStateId, setPanelStateTargets } = useVisibleWidgets(page)
  const [textOverrides, setTextOverrides] = useState<Map<string, string>>(new Map())
  const [frameTargets, setFrameTargets] = useState<Map<string, string>>(new Map())
  const [choiceState, setChoiceState] = useState<Map<string, boolean>>(new Map())

  const updateFrameTarget = (widgetId: string, html: string) => {
    setFrameTargets((current) => {
      const next = new Map(current)
      next.set(widgetId, html)
      return next
    })
  }

  const runAction = (action: AxureAction, row?: Record<string, string>) => {
    const objectIds = action.targets.filter((target) => target.kind === 'object').map((target) => target.value)
    const link = action.targets.find((target) => target.kind === 'link')

    if (action.action === 'linkWindow' && link) {
      if (embedded && onEmbeddedNavigate) {
        onEmbeddedNavigate(link.value)
      } else {
        navigate(htmlToRoute(link.value, pages))
      }
      return
    }

    if (action.action === 'linkFrame' && link) {
      if (objectIds.length) objectIds.forEach((id) => updateFrameTarget(id, link.value))
      else if (embedded && onEmbeddedNavigate) onEmbeddedNavigate(link.value)
      return
    }

    if (action.action === 'setPanelState') {
      const updates = objectIds
        .map((panelId) => {
          const stateId = resolvePanelStateId(panelId, action.targetStateName)
          return stateId ? { panelId, stateId } : null
        })
        .filter((item): item is { panelId: string; stateId: string } => Boolean(item))
      setPanelStateTargets(updates)
    }
    if (action.action === 'setFunction' && /设置文本|set text|SetWidgetRichText|文本/i.test(`${action.displayName ?? ''} ${action.description ?? ''}`)) {
      const description = decodeEntities(action.description)
      const value =
        description.match(/\bequal to\s+"([^"]*)"/i)?.[1] ??
        description.match(/\bto\s+"([^"]*)"/i)?.[1] ??
        null
      if (value != null && objectIds.length) {
        const resolved = resolveTemplateText(value, row)
        setTextOverrides((current) => {
          const next = new Map(current)
          objectIds.forEach((id) => next.set(id, resolved))
          return next
        })
      }
    }
    if (actionWantsHide(action)) hideTargets(objectIds)
    if (actionWantsShow(action)) showTargets(objectIds)

    if (action.action === 'fadeWidget' && actionWantsShow(action) && /复制提示/.test(action.description ?? '')) {
      window.setTimeout(() => hideTargets(objectIds), 3000)
    }
  }

  const handleClick = (widget: AxureWidget, event: MouseEvent) => {
    if (!widget.interactions.length) return
    event.stopPropagation()
    for (const interaction of widget.interactions) {
      if (!/click|onClick/i.test(interaction.eventKey)) continue
      for (const caseItem of interaction.cases) {
        if (caseItem.disabled || !conditionMatches(caseItem.conditionString, {})) continue
        caseItem.actions.forEach((action) => runAction(action))
      }
    }
  }

  const choiceKey = (widget: AxureWidget) => {
    const group = optionGroupName(widget.input)
    return widget.kind === 'radio' && group ? `radio:${group}:${widget.id}` : `${widget.kind}:${widget.id}`
  }

  const choiceSelectionFor = (widget: AxureWidget): ChoiceSelection => {
    const key = choiceKey(widget)
    const checked = choiceState.has(key) ? Boolean(choiceState.get(key)) : Boolean(widget.input?.checked)
    return {
      checked,
      onChange: (nextChecked) => {
        setChoiceState((current) => {
          const next = new Map(current)
          if (widget.kind === 'radio') {
            const group = optionGroupName(widget.input)
            if (group) {
              for (const candidate of page.widgets) {
                if (candidate.kind !== 'radio') continue
                if (optionGroupName(candidate.input) === group) next.set(choiceKey(candidate), false)
              }
            }
            next.set(key, true)
          } else {
            next.set(key, nextChecked)
          }
          return next
        })
      },
    }
  }

  return (
    <main className="ax-page" data-page={page.pageKey} data-shared-chrome={page.sharedChrome?.kind ?? undefined}>
      <div className="ax-canvas" style={{ width: page.canvas.width, minHeight: page.canvas.height }}>
        <SharedSideNav
          sharedChrome={page.sharedChrome}
          currentRoute={page.route}
          onAction={runAction}
          onNavigate={(route) => navigate(route)}
        />
        {page.widgets.map((widget, index) => {
          if (!isVisible(widget)) return null
          const interactive = widget.interactions.length > 0
          const text = textOverrides.get(widget.id) ?? widget.text
          return (
            <div
              key={`${page.pageKey}-${widget.scriptId}`}
              className={`ax-widget ax-kind-${widget.kind}${interactive ? ' is-interactive' : ''}`}
              data-script-id={widget.scriptId}
              data-axure-id={widget.id}
              data-icon-role={widget.iconRole ?? undefined}
              data-target-panel-id={widget.targetPanelId ?? undefined}
              data-panel-state-id={widget.panelStateId ?? undefined}
              data-panel-state-label={widget.panelStateLabel ?? undefined}
              data-position-mode={widget.fixedAncestor || widget.layout.position === 'fixed' ? 'fixed' : widget.layout.position ?? undefined}
              data-repeater-row-count={widget.repeater?.rows.length || undefined}
              style={widgetStyle(widget, index + 1)}
              onClick={interactive ? (event) => handleClick(widget, event) : undefined}
              title={widget.label || text || widget.scriptId}
            >
              <WidgetContent
                widget={widget}
                text={text}
                onAction={runAction}
                pages={pages}
                frameTargetHtml={frameTargets.get(widget.id) ?? widget.frameTargetHtml}
                onFrameNavigate={updateFrameTarget}
                choiceSelection={choiceSelectionFor(widget)}
              />
            </div>
          )
        })}
      </div>
    </main>
  )
}

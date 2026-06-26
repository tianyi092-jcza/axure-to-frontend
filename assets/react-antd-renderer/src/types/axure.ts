export type AxureBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type AxureStyle = {
  fill: string | null
  border: string | null
  color: string | null
  opacity: number | null
  radius: number
  borderWidth: number
  fontFamily: string | null
  fontSize: string | null
  fontWeight: string | null
  textAlign: string | null
  verticalAlign: string | null
}

export type AxureLayout = {
  position: string | null
  left: string | null
  top: string | null
  marginLeft: string | null
  marginTop: string | null
  width: string | null
  height: string | null
}

export type AxureFixedAncestor = {
  panelId: string
  left: string | null
  top: string | null
  marginLeft: string | null
  marginTop: string | null
}

export type AxureInput = {
  tag: string
  type: string
  name?: string
  groupName?: string
  value: string
  placeholder: string
  checked: boolean
  disabled: boolean
}

export type AxureOption = {
  value: string
  text: string
  selected: boolean
}

export type AxureActionTarget = {
  kind: 'link' | 'object'
  value: string
}

export type AxureAction = {
  action: string | null
  displayName: string | null
  description: string | null
  targetStateName: string | null
  targets: AxureActionTarget[]
}

export type AxureInteraction = {
  eventKey: string
  eventType: string | null
  cases: Array<{
    conditionString: string | null
    disabled: boolean
    actions: AxureAction[]
  }>
}

export type AxureRepeaterColumn = {
  key: string
  sourceKey: string
  label: string | null
  scriptId: string | null
  text: string
  kind:
    | 'shape'
    | 'text'
    | 'button'
    | 'input'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'image'
    | 'icon'
    | 'panel'
    | 'repeater'
    | 'table'
    | 'iframe'
  bounds: AxureBounds
  textAlign: string | null
  verticalAlign: string | null
  fontSize: string | null
  fontWeight: string | null
  color: string | null
  fill: string | null
  border: string | null
  radius: number
  borderWidth: number
  input: AxureInput | null
  assetRefs: string[]
  interactive: boolean
  interactions: AxureInteraction[]
  rowActions: Array<{
    condition: { key: string; value: string } | null
    updates: Record<string, string>
  }>
}

export type AxureRepeaterData = {
  rows: Array<Record<string, string>>
  dataProps: string[]
  columns: AxureRepeaterColumn[]
  rowHeight: number
  templateWidth: number
  layout: {
    itemWidth: number
    itemHeight: number
    wrap: number
    vertical: boolean
    horizontalSpacing: number
    verticalSpacing: number
    fitToContent: boolean
    isolateRadio: boolean
    isolateSelection: boolean
  }
}

export type AxureSharedNavItem = {
  key: string
  label: string
  role: string
  route: string | null
  html: string | null
  bounds: AxureBounds
  iconBounds: AxureBounds | null
  interactions: AxureInteraction[]
  sourceScriptIds: string[]
  coveredWidgetIds: string[]
  evidence?: {
    slotY: number
    localLabel: string
    canonicalLabel: string
    canonicalPages: string[]
    resolvedFrom: string
    unresolved: boolean
  }
}

export type AxureSharedChrome = {
  kind: 'left-icon-rail'
  source: string
  railBounds: AxureBounds
  coveredWidgetIds: string[]
  items: AxureSharedNavItem[]
}

export type AxureWidget = {
  id: string
  scriptId: string
  ancestorScriptIds: string[]
  type: string | null
  friendlyType: string | null
  kind:
    | 'shape'
    | 'text'
    | 'button'
    | 'input'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'image'
    | 'icon'
    | 'panel'
    | 'repeater'
    | 'table'
    | 'iframe'
  iconRole: string | null
  label: string | null
  text: string
  bounds: AxureBounds
  absoluteBounds: AxureBounds
  layout: AxureLayout
  fixedAncestor: AxureFixedAncestor | null
  fixedOffset: { x: number; y: number } | null
  initiallyVisible: boolean
  htmlHidden: boolean
  hiddenInteractionTarget: boolean
  proxiedInteractionSourceScriptId: string | null
  targetPanelId: string | null
  targetPanelScriptId: string | null
  hiddenAncestorPanelIds: string[]
  coveredBySharedChrome: boolean
  coveredByRepeaterId: string | null
  panelStateId: string | null
  panelStateLabel: string | null
  panelStateIndex: number | null
  panelStateIsDefault: boolean | null
  isInteractionTarget: boolean
  assetRefs: string[]
  input: AxureInput | null
  options: AxureOption[]
  style: AxureStyle
  interactions: AxureInteraction[]
  repeater: AxureRepeaterData | null
  frameTargetHtml: string | null
  data: unknown
}

export type AxurePageData = {
  pageKey: string
  html: string
  route: string
  title: string
  canvas: {
    width: number
    height: number
  }
  counts: Record<string, number>
  sharedChrome: AxureSharedChrome | null
  widgets: AxureWidget[]
}

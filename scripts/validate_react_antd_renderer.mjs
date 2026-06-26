import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = require('playwright-core')

const baseUrl = process.env.AXURE_FRONTEND_URL || process.argv[2] || 'http://127.0.0.1:5174/'
const clickScriptId = process.env.AXURE_VALIDATE_CLICK_SCRIPT_ID || process.argv[3] || 'u46'
const expectedText = process.env.AXURE_VALIDATE_EXPECT_TEXT || process.argv[4] || 'OpenSpec 双语产品评审会'
const routes = (process.env.AXURE_VALIDATE_ROUTES || process.argv[5] || '/,/meeting-setup,/transactions,/meeting-runing-menu-expend,/meeting-summary')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 1895, height: 1080 },
  colorScheme: 'dark',
})

fs.mkdirSync(path.join(process.cwd(), 'output', 'playwright'), { recursive: true })

function loadGeneratedPages() {
  const dataPath = path.join(process.cwd(), 'src', 'data', 'axurePages.ts')
  if (!fs.existsSync(dataPath)) return []
  const dataText = fs.readFileSync(dataPath, 'utf8')
  const match = dataText.match(/export const axurePages: AxurePageData\[\] = ([\s\S]*);\s*$/)
  if (!match) return []
  return JSON.parse(match[1])
}

const generatedPages = loadGeneratedPages()
const generatedPageByRoute = new Map(generatedPages.map((item) => [item.route, item]))

const actionIntentText = (action) => `${action.action ?? ''} ${action.description ?? ''}`

const actionWantsHide = (action) =>
  /hide|隐藏/i.test(actionIntentText(action))

const actionWantsShow = (action) =>
  /show|显示/i.test(actionIntentText(action))

async function safeVisibleClick(locator, timeout = 3000) {
  if (!(await locator.count())) return { clicked: false, skipped: 'not visible' }
  const hitTest = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const top = document.elementFromPoint(x, y)
    const owner = top?.closest?.('[data-script-id]')
    const covered = Boolean(top && top !== element && !element.contains(top))
    return {
      x,
      y,
      coveredBy: covered ? owner?.getAttribute('data-script-id') || String(top?.className || top?.tagName || 'unknown') : null,
    }
  })
  if (hitTest.coveredBy) return { clicked: false, skipped: `covered by ${hitTest.coveredBy}` }
  try {
    await locator.click({ timeout })
    return { clicked: true }
  } catch (error) {
    return { clicked: false, clickError: error instanceof Error ? error.message : String(error) }
  }
}

function panelStateActionIdsForRoute(route) {
  const pageData = generatedPageByRoute.get(route)
  if (!pageData) return []
  const ids = []
  for (const widget of pageData.widgets || []) {
    const hasSetPanelState = (widget.interactions || []).some((interaction) =>
      (interaction.cases || []).some((caseItem) =>
        (caseItem.actions || []).some((action) => action.action === 'setPanelState'),
      ),
    )
    if (hasSetPanelState && widget.scriptId) ids.push(widget.scriptId)
  }
  return Array.from(new Set(ids))
}

function hiddenShowActionChecksForRoute(route) {
  const pageData = generatedPageByRoute.get(route)
  if (!pageData) return []
  const widgetById = new Map((pageData.widgets || []).map((widget) => [widget.id, widget]))
  const checks = []
  for (const widget of pageData.widgets || []) {
    if (!widget.initiallyVisible || !widget.scriptId) continue
    for (const interaction of widget.interactions || []) {
      if (!/click|onClick/i.test(interaction.eventKey || '')) continue
      for (const caseItem of interaction.cases || []) {
        if (caseItem.disabled) continue
        for (const action of caseItem.actions || []) {
          if (!actionWantsShow(action)) continue
          const targetIds = (action.targets || [])
            .filter((target) => target.kind === 'object')
            .map((target) => target.value)
            .filter((id) => {
              const target = widgetById.get(id)
              return target && (!target.initiallyVisible || target.htmlHidden)
            })
          if (targetIds.length) checks.push({ sourceScriptId: widget.scriptId, targetIds })
        }
      }
    }
  }
  return checks.slice(0, 10)
}

function closeIconChecksForRoute(route, targetIds) {
  const pageData = generatedPageByRoute.get(route)
  if (!pageData) return []
  const wantedTargets = new Set(targetIds || [])
  const checks = []
  for (const widget of pageData.widgets || []) {
    if (widget.kind !== 'icon' || !widget.scriptId) continue
    const hiddenTargets = []
    for (const interaction of widget.interactions || []) {
      if (!/click|onClick/i.test(interaction.eventKey || '')) continue
      for (const caseItem of interaction.cases || []) {
        if (caseItem.disabled) continue
        for (const action of caseItem.actions || []) {
          if (!actionWantsHide(action)) continue
          const objectTargets = (action.targets || []).filter((target) => target.kind === 'object').map((target) => target.value)
          objectTargets.forEach((id) => {
            if (!wantedTargets.size || wantedTargets.has(id)) hiddenTargets.push(id)
          })
        }
      }
    }
    if (hiddenTargets.length) {
      checks.push({
        scriptId: widget.scriptId,
        iconRole: widget.iconRole,
        targetIds: Array.from(new Set(hiddenTargets)),
      })
    }
  }
  return checks
}

function linkFrameActionChecksForRoute(route) {
  const pageData = generatedPageByRoute.get(route)
  if (!pageData) return []
  const checks = []
  const childWidgetsByAncestorScriptId = new Map()
  for (const widget of pageData.widgets || []) {
    for (const ancestorScriptId of widget.ancestorScriptIds || []) {
      if (!childWidgetsByAncestorScriptId.has(ancestorScriptId)) childWidgetsByAncestorScriptId.set(ancestorScriptId, [])
      childWidgetsByAncestorScriptId.get(ancestorScriptId).push(widget)
    }
  }
  for (const widget of pageData.widgets || []) {
    if (!widget.scriptId) continue
    if (widget.proxiedInteractionSourceScriptId) continue
    for (const interaction of widget.interactions || []) {
      if (!/click|onClick/i.test(interaction.eventKey || '')) continue
      for (const caseItem of interaction.cases || []) {
        if (caseItem.disabled) continue
        for (const action of caseItem.actions || []) {
          if (action.action !== 'linkFrame') continue
          const htmlTarget = (action.targets || []).find((target) => target.kind === 'html' || target.kind === 'link')
          const frameTargets = (action.targets || [])
            .filter((target) => target.kind === 'object')
            .map((target) => target.value)
          if (htmlTarget?.value) {
            checks.push({
              sourceScriptId: widget.scriptId,
              htmlTarget: path.basename(htmlTarget.value),
              frameTargets,
              visibleChildScriptIds: (childWidgetsByAncestorScriptId.get(widget.scriptId) || [])
                .filter((child) =>
                  child.scriptId &&
                  child.proxiedInteractionSourceScriptId === widget.scriptId &&
                  child.initiallyVisible &&
                  !child.htmlHidden &&
                  !['input', 'select', 'checkbox', 'radio', 'repeater', 'iframe'].includes(child.kind) &&
                  child.absoluteBounds?.width > 0 &&
                  child.absoluteBounds?.height > 0,
                )
                .map((child) => child.scriptId)
                .slice(0, 4),
            })
          }
        }
      }
    }
  }
  return checks.slice(0, 12)
}

async function collectRendererHealth(stage) {
  return page.evaluate((stageName) => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element)
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0' &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      )
    }
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect()
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
    }
    const visibleWidgets = (selector) => Array.from(document.querySelectorAll(selector)).filter(isVisible)
    const icons = visibleWidgets('.ax-kind-icon').map((element) => ({
      scriptId: element.getAttribute('data-script-id'),
      role: element.getAttribute('data-icon-role') || '',
      hasAntIcon: Boolean(element.querySelector('.anticon')),
      hasImage: Boolean(element.querySelector('img')),
      interactive: element.classList.contains('is-interactive'),
      text: element.textContent?.trim() || '',
      rect: rectOf(element),
    }))
    const expectsSharedChrome = Boolean(document.querySelector('[data-shared-chrome]'))
    const sharedNavItems = visibleWidgets('[data-shared-nav-item]').map((element) => ({
      key: element.getAttribute('data-shared-nav-item'),
      role: element.getAttribute('data-icon-role') || '',
      label: element.getAttribute('data-nav-label') || element.getAttribute('aria-label') || '',
      route: element.getAttribute('data-nav-route') || '',
      hasAntIcon: Boolean(element.querySelector('.anticon')),
      disabled: element.hasAttribute('disabled'),
      rect: rectOf(element),
    }))
    const leakedLeftRailWidgets = visibleWidgets('.ax-widget').filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < 64 && rect.top >= 54 && rect.width > 0 && rect.height > 0
    }).map((element) => ({
      scriptId: element.getAttribute('data-script-id'),
      kind: Array.from(element.classList).find((name) => name.startsWith('ax-kind-')) || '',
      rect: rectOf(element),
    }))
    const choices = visibleWidgets('.ax-kind-checkbox, .ax-kind-radio').map((element) => {
      const rect = rectOf(element)
      const text = element.textContent?.trim() || ''
      return {
        scriptId: element.getAttribute('data-script-id'),
        text,
        overflow: window.getComputedStyle(element).overflow,
        rect,
        widthLooksTight: Boolean(text) && rect.width < Math.max(30, 28 + Array.from(text).length * 7),
      }
    })
    const textButtons = visibleWidgets('.ax-kind-button').map((element) => ({
      scriptId: element.getAttribute('data-script-id'),
      text: element.textContent?.trim() || '',
      opacity: window.getComputedStyle(element).opacity,
      rect: rectOf(element),
    }))
    const repeaters = visibleWidgets('.ax-kind-repeater').map((element) => {
      const expectedRows = Number(element.getAttribute('data-repeater-row-count') || '0')
      const rows = Array.from(element.querySelectorAll('.ax-repeater-row')).filter(isVisible)
      const style = window.getComputedStyle(element)
      const hasHorizontalScrollbar =
        element.scrollWidth > element.clientWidth + 2 && /auto|scroll/i.test(style.overflowX || style.overflow)
      const hasVerticalScrollbar =
        element.scrollHeight > element.clientHeight + 2 && /auto|scroll/i.test(style.overflowY || style.overflow)
      return {
        scriptId: element.getAttribute('data-script-id'),
        component: element.querySelector('[data-repeater-component]')?.getAttribute('data-repeater-component') || '',
        hasAntList: Boolean(element.querySelector('.ant-list')),
        expectedRows,
        renderedRows: rows.length,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        hasHorizontalScrollbar,
        hasVerticalScrollbar,
        text: element.textContent?.trim() || '',
        rect: rectOf(element),
      }
    })
    const inlineFrames = visibleWidgets('.ax-kind-iframe').map((element) => {
      const targetElement = element.querySelector('[data-frame-target]')
      return {
        scriptId: element.getAttribute('data-script-id'),
        axureId: element.getAttribute('data-axure-id'),
        target: targetElement?.getAttribute('data-frame-target') || '',
        hasEmbeddedPage: Boolean(targetElement),
        visibleEmbeddedWidgets: Array.from(element.querySelectorAll('.ax-page [data-script-id]')).filter(isVisible).length,
        rect: rectOf(element),
      }
    })
    const fixedPanels = visibleWidgets('[data-position-mode="fixed"]:not([data-target-panel-id])').map((element) => {
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      const centerDeltaX = Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)
      const centerDeltaY = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2)
      return {
        scriptId: element.getAttribute('data-script-id'),
        axureId: element.getAttribute('data-axure-id'),
        position: style.position,
        centerDeltaX: Math.round(centerDeltaX),
        centerDeltaY: Math.round(centerDeltaY),
        rect: rectOf(element),
      }
    })
    const panelStatesByPanel = new Map()
    visibleWidgets('[data-target-panel-id][data-panel-state-id]').forEach((element) => {
      const panelId = element.getAttribute('data-target-panel-id')
      const stateId = element.getAttribute('data-panel-state-id')
      const stateLabel = element.getAttribute('data-panel-state-label') || stateId
      if (!panelId || !stateId) return
      if (!panelStatesByPanel.has(panelId)) panelStatesByPanel.set(panelId, new Map())
      const stateMap = panelStatesByPanel.get(panelId)
      stateMap.set(stateId, stateLabel)
    })
    const panelStateGroups = Array.from(panelStatesByPanel.entries()).map(([panelId, stateMap]) => ({
      panelId,
      states: Array.from(stateMap.entries()).map(([stateId, label]) => ({ stateId, label })),
    }))
    const panelStateLeaks = panelStateGroups.filter((group) => group.states.length > 1)
    const iconFailures = icons.filter((item) => !item.hasAntIcon || item.hasImage)
    const choiceFailures = choices.filter((item) => item.text && (item.overflow !== 'visible' || item.widthLooksTight))
    const buttonFailures = textButtons.filter((item) => item.text && (item.opacity === '0' || item.rect.width <= 0 || item.rect.height <= 0))
    const repeaterFailures = repeaters.filter(
      (item) =>
        item.expectedRows > 0 &&
        (item.renderedRows < item.expectedRows ||
          item.component !== 'antd-list' ||
          !item.hasAntList ||
          item.hasHorizontalScrollbar ||
          item.hasVerticalScrollbar),
    )
    const inlineFrameFailures = inlineFrames.filter(
      (item) => !item.target || !item.hasEmbeddedPage || item.visibleEmbeddedWidgets <= 0 || item.rect.width <= 0 || item.rect.height <= 0,
    )
    const fixedPanelFailures = fixedPanels.filter((item) => item.position !== 'fixed' || item.centerDeltaX > 4 || item.centerDeltaY > 4)
    const sharedNavFailures = []
    if (expectsSharedChrome && !sharedNavItems.length) {
      sharedNavFailures.push({ reason: 'missing shared nav items' })
    }
    if (sharedNavItems.some((item) => !item.hasAntIcon || item.rect.width <= 0 || item.rect.height <= 0)) {
      sharedNavFailures.push({ reason: 'invisible or non-framework shared nav icon', items: sharedNavItems })
    }
    const sharedRoles = Array.from(new Set(sharedNavItems.map((item) => item.role).filter(Boolean)))
    if (sharedNavItems.length > 2 && (sharedRoles.length <= 1 || sharedRoles.includes('generic'))) {
      sharedNavFailures.push({ reason: 'shared nav roles collapsed to generic or one role', roles: sharedRoles })
    }
    if (sharedNavItems.some((item) => item.route && item.disabled)) {
      sharedNavFailures.push({ reason: 'routed shared nav item is disabled', items: sharedNavItems.filter((item) => item.route && item.disabled) })
    }
    if (expectsSharedChrome && !sharedNavItems.some((item) => item.role === 'setting' && /meeting-setup/.test(item.route))) {
      sharedNavFailures.push({ reason: 'missing system setting shared nav route', items: sharedNavItems })
    }
    if (expectsSharedChrome && sharedNavItems.some((item) => /team|video/.test(item.role) && !/成员|会议/.test(item.label))) {
      sharedNavFailures.push({ reason: 'shared nav role appears inferred from stale slot fallback', items: sharedNavItems })
    }
    if (expectsSharedChrome && leakedLeftRailWidgets.length) {
      sharedNavFailures.push({ reason: 'raw left rail widgets leaked beside shared nav', leakedLeftRailWidgets })
    }
    return {
      stage: stageName,
      icons,
      sharedNavItems,
      leakedLeftRailWidgets,
      choices,
      textButtons,
      repeaters,
      inlineFrames,
      fixedPanels,
      panelStateGroups,
      failures: {
        icons: iconFailures,
        choices: choiceFailures,
        textButtons: buttonFailures,
        repeaters: repeaterFailures,
        inlineFrames: inlineFrameFailures,
        fixedPanels: fixedPanelFailures,
        panelStates: panelStateLeaks,
        sharedNav: sharedNavFailures,
      },
    }
  }, stage)
}

await page.goto(baseUrl)
const before = await page.locator('[data-script-id]').count()
const visibleBefore = await page.locator('[data-script-id]:visible').count()
await page.screenshot({ path: 'output/playwright/frontend-create-meeting-before-click.png' })
const healthBefore = await collectRendererHealth('before-click')
const initialClick = await safeVisibleClick(page.locator(`[data-script-id="${clickScriptId}"]:visible`).first())
await page.waitForTimeout(500)
const after = await page.locator('[data-script-id]').count()
const visibleAfter = await page.locator('[data-script-id]:visible').count()
const panelText = await page.locator(`text=${expectedText}`).count()
await page.screenshot({ path: 'output/playwright/frontend-create-meeting-after-click.png' })
const healthAfter = await collectRendererHealth('after-click')

const routeChecks = []
const routeHealthChecks = []
for (const route of routes) {
  await page.goto(new URL(route, baseUrl).href)
  await page.waitForTimeout(200)
  const routeHealth = await collectRendererHealth(`route:${route}`)
  const initialRouteVisibleWidgets = await page.locator('[data-script-id]:visible').count()
  const initialRouteTitleVisible = await page.locator('text=创建会议').count()
  routeHealthChecks.push(routeHealth)
  const panelActionChecks = []
  for (const scriptId of panelStateActionIdsForRoute(route).slice(0, 8)) {
    await page.goto(new URL(route, baseUrl).href)
    await page.waitForTimeout(150)
    const locator = page.locator(`[data-script-id="${scriptId}"]:visible`).first()
    if (!(await locator.count())) {
      panelActionChecks.push({ scriptId, skipped: 'not visible' })
      continue
    }
    const clickResult = await safeVisibleClick(locator)
    if (!clickResult.clicked) {
      panelActionChecks.push({ scriptId, ...clickResult })
      continue
    }
    await page.waitForTimeout(150)
    const actionHealth = await collectRendererHealth(`route:${route}:setPanelState:${scriptId}`)
    routeHealthChecks.push(actionHealth)
    panelActionChecks.push({
      scriptId,
      panelStateGroups: actionHealth.panelStateGroups,
      panelStateLeaks: actionHealth.failures.panelStates,
    })
  }
  const hiddenShowChecks = []
  for (const check of hiddenShowActionChecksForRoute(route)) {
    await page.goto(new URL(route, baseUrl).href)
    await page.waitForTimeout(150)
    const beforeCounts = {}
    for (const targetId of check.targetIds) {
      beforeCounts[targetId] = await page.locator(`[data-axure-id="${targetId}"]:visible`).count()
    }
    const locator = page.locator(`[data-script-id="${check.sourceScriptId}"]:visible`).first()
    let clickError = null
    if (!(await locator.count())) {
      clickError = 'source not visible'
    } else {
      try {
        await locator.click({ timeout: 3000 })
      } catch (error) {
        clickError = error instanceof Error ? error.message : String(error)
      }
    }
    await page.waitForTimeout(200)
    const afterCounts = {}
    const targetPositions = {}
    for (const targetId of check.targetIds) {
      afterCounts[targetId] = await page.locator(`[data-axure-id="${targetId}"]:visible`).count()
      if (afterCounts[targetId] > 0) {
        targetPositions[targetId] = await page.locator(`[data-axure-id="${targetId}"]:visible`).first().evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return {
            positionMode: element.getAttribute('data-position-mode'),
            position: style.position,
            centerDeltaX: Math.round(Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)),
            centerDeltaY: Math.round(Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2)),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          }
        })
      }
    }
    const closeIconChecks = []
    let visibleCloseFound = false
    for (const closeCheck of closeIconChecksForRoute(route, check.targetIds)) {
      const closeLocator = page.locator(`[data-script-id="${closeCheck.scriptId}"]:visible`).first()
      if (!(await closeLocator.count())) continue
      visibleCloseFound = true
      const renderedRole = await closeLocator.getAttribute('data-icon-role')
      let closeClickError = null
      try {
        await closeLocator.click({ timeout: 3000 })
      } catch (error) {
        closeClickError = error instanceof Error ? error.message : String(error)
      }
      await page.waitForTimeout(200)
      const afterCloseCounts = {}
      for (const targetId of closeCheck.targetIds) {
        afterCloseCounts[targetId] = await page.locator(`[data-axure-id="${targetId}"]:visible`).count()
      }
      closeIconChecks.push({
        ...closeCheck,
        renderedRole,
        closeClickError,
        afterCloseCounts,
      })
      break
    }
    if (!visibleCloseFound && closeIconChecksForRoute(route, check.targetIds).length && Object.values(afterCounts).some((count) => count > 0)) {
      closeIconChecks.push({ skipped: 'no visible close icon after target reveal', targetIds: check.targetIds })
    }
    hiddenShowChecks.push({ ...check, beforeCounts, afterCounts, targetPositions, clickError, closeIconChecks })
  }
  const linkFrameChecks = []
  for (const check of linkFrameActionChecksForRoute(route)) {
    const visibleChildTargets = (check.visibleChildScriptIds || []).map((scriptId) => ({ kind: 'visible-child', scriptId }))
    const clickTargets = visibleChildTargets.length ? visibleChildTargets : [{ kind: 'source', scriptId: check.sourceScriptId }]
    for (const clickTarget of clickTargets) {
      await page.goto(new URL(route, baseUrl).href)
      await page.waitForTimeout(150)
      const locator = page.locator(`[data-script-id="${clickTarget.scriptId}"]:visible`).first()
      let clickError = null
      let skipped = null
      const frameTargetsBefore = await page.locator('.ax-kind-iframe [data-frame-target]:visible').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-frame-target') || ''),
      )
      if (!(await locator.count())) {
        clickError = `${clickTarget.kind} not visible`
      } else {
        try {
          const hitTest = await locator.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            const x = rect.left + rect.width / 2
            const y = rect.top + rect.height / 2
            const top = document.elementFromPoint(x, y)
            const topWidget = top?.closest?.('.ax-widget')
            return {
              hitSelf: Boolean(top && (element === top || element.contains(top))),
              topScriptId: topWidget?.getAttribute('data-script-id') || null,
            }
          })
          if (!hitTest.hitSelf && hitTest.topScriptId) {
            skipped = `covered by ${hitTest.topScriptId}`
          } else {
            await locator.click({ timeout: 3000 })
          }
        } catch (error) {
          clickError = error instanceof Error ? error.message : String(error)
        }
      }
      await page.waitForTimeout(250)
      const frameTargetsAfter = await page.locator('.ax-kind-iframe [data-frame-target]:visible').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-frame-target') || ''),
      )
      linkFrameChecks.push({
        ...check,
        clickTargetKind: clickTarget.kind,
        clickScriptId: clickTarget.scriptId,
        frameTargetsBefore,
        frameTargetsAfter,
        clickError,
        skipped,
        matched: frameTargetsAfter.some((target) => path.basename(target) === check.htmlTarget),
      })
    }
  }
  await page.goto(new URL(route, baseUrl).href)
  await page.waitForTimeout(150)
  const sharedNavTargets = await page.locator('[data-shared-nav-item][data-nav-route]:visible').evaluateAll((elements) =>
    Array.from(
      new Map(
        elements.map((element) => [
          element.getAttribute('data-nav-route') || '',
          {
            key: element.getAttribute('data-shared-nav-item'),
            route: element.getAttribute('data-nav-route') || '',
            role: element.getAttribute('data-icon-role') || '',
            label: element.getAttribute('data-nav-label') || element.getAttribute('aria-label') || '',
          },
        ]),
      ).values(),
    ).filter((item) => item.route),
  )
  const sharedNavClickChecks = []
  const sharedTargetsToClick = sharedNavTargets
    .filter((item) => item.route !== route)
    .sort((a, b) => (a.route === '/meeting-setup' ? -1 : b.route === '/meeting-setup' ? 1 : 0))
    .slice(0, 8)
  for (const target of sharedTargetsToClick) {
    await page.goto(new URL(route, baseUrl).href)
    await page.waitForTimeout(100)
    const selector = `[data-shared-nav-item][data-nav-route="${target.route}"]:visible`
    const locator = page.locator(selector).first()
    let clickError = null
    let actualPath = null
    if (!(await locator.count())) {
      clickError = 'shared nav item not visible'
    } else {
      try {
        await locator.click({ timeout: 3000 })
        await page.waitForTimeout(150)
        actualPath = new URL(page.url()).pathname
      } catch (error) {
        clickError = error instanceof Error ? error.message : String(error)
      }
    }
    sharedNavClickChecks.push({ ...target, expectedPath: target.route, actualPath, clickError })
  }
  routeChecks.push({
    route,
    visibleWidgets: initialRouteVisibleWidgets,
    titleVisible: initialRouteTitleVisible,
    panelStateLeaks: routeHealth.failures.panelStates,
    panelActionChecks,
    hiddenShowChecks,
    linkFrameChecks,
    sharedNavClickChecks,
  })
}

const healthChecks = [healthBefore, healthAfter, ...routeHealthChecks]
const failedHealthChecks = healthChecks.flatMap((check) =>
  Object.entries(check.failures)
    .filter(([, failures]) => failures.length > 0)
    .map(([kind, failures]) => ({ stage: check.stage, kind, failures })),
)

const result = { before, visibleBefore, initialClick, after, visibleAfter, panelText, routeChecks, healthChecks }
const failedHiddenShowChecks = routeChecks.flatMap((routeCheck) =>
  (routeCheck.hiddenShowChecks || [])
    .filter((check) => {
      const hasInitialLeak = Object.values(check.beforeCounts || {}).some((count) => count > 0)
      const failedToReveal = Object.values(check.afterCounts || {}).some((count) => count <= 0)
      const failedFixedPlacement = Object.values(check.targetPositions || {}).some(
        (position) =>
          position.positionMode === 'fixed' &&
          (position.position !== 'fixed' || position.centerDeltaX > 4 || position.centerDeltaY > 4),
      )
      const failedCloseIcon = (check.closeIconChecks || []).some((closeCheck) => {
        const failedToClose = Object.values(closeCheck.afterCloseCounts || {}).some((count) => count > 0)
        return Boolean(closeCheck.skipped) || Boolean(closeCheck.closeClickError) || closeCheck.renderedRole !== 'close' || failedToClose
      })
      return Boolean(check.clickError) || hasInitialLeak || failedToReveal || failedFixedPlacement || failedCloseIcon
    })
    .map((check) => ({ route: routeCheck.route, ...check })),
)
const failedSharedNavClickChecks = routeChecks.flatMap((routeCheck) =>
  (routeCheck.sharedNavClickChecks || [])
    .filter((check) => Boolean(check.clickError) || check.actualPath !== check.expectedPath)
    .map((check) => ({ route: routeCheck.route, ...check })),
)
const failedLinkFrameChecks = routeChecks.flatMap((routeCheck) =>
  (routeCheck.linkFrameChecks || [])
    .filter((check) => !check.skipped && (Boolean(check.clickError) || !check.matched))
    .map((check) => ({ route: routeCheck.route, ...check })),
)
const report = `# Validation Report

## Commands

- npm run build
- node <skill-dir>/scripts/validate_react_antd_renderer.mjs ${baseUrl} ${clickScriptId} "${expectedText}"

## Result

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`

## Screenshots

- output/playwright/frontend-create-meeting-before-click.png
- output/playwright/frontend-create-meeting-after-click.png

## Renderer Health Checks

\`\`\`json
${JSON.stringify(healthChecks, null, 2)}
\`\`\`

## Known Tolerance

- Exact Axure runtime playback effects are approximated with React state.
- Ant Design controls are styled to fit Axure bounds but may differ in internal glyph details.
`;

fs.writeFileSync(path.join(process.cwd(), 'validation-report.md'), report, 'utf8')
console.log(JSON.stringify(result, null, 2))
if (failedHealthChecks.length) {
  console.error(JSON.stringify({ failedHealthChecks }, null, 2))
  process.exitCode = 1
}
if (failedHiddenShowChecks.length) {
  console.error(JSON.stringify({ failedHiddenShowChecks }, null, 2))
  process.exitCode = 1
}
if (failedSharedNavClickChecks.length) {
  console.error(JSON.stringify({ failedSharedNavClickChecks }, null, 2))
  process.exitCode = 1
}
if (failedLinkFrameChecks.length) {
  console.error(JSON.stringify({ failedLinkFrameChecks }, null, 2))
  process.exitCode = 1
}
await browser.close()

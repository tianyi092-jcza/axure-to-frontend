import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] || process.cwd());
const exportRoot = path.resolve(process.argv[3] || path.resolve(root, "..", "yuanxing1.0"));
const ledgersDir = path.join(root, "axure-ledgers");
const pagesDir = path.join(ledgersDir, "pages");
const analysis = JSON.parse(fs.readFileSync(path.join(root, "axure-analysis.json"), "utf8"));
const architecture = analysis.architecture || {};
const architectureProfile = architecture.primary || "mixed-or-uncertain";
const architectureConfidence = architecture.confidence || "unknown";
const isDynamicPanelApp = architectureProfile === "single-page-dynamic-panel-app";
const entryPageKey = (analysis.pages || []).some((page) => page.page_key === "mainframe") ? "mainframe" : "create-meeting";
const targetTheme = process.env.AXURE_TARGET_THEME || process.argv[4] || "dark";
const viewportArg = process.env.AXURE_REFERENCE_VIEWPORT || process.argv[5] || "1895x1080";
const [viewportWidth, viewportHeight] = viewportArg.split(/[x,]/).map((value) => Number.parseInt(value, 10));
const referenceViewport = { width: viewportWidth || 1895, height: viewportHeight || 1080 };
const autoApproveHooks = /^(1|true|yes)$/i.test(process.env.AXURE_AUTO_APPROVE_HOOKS || "");
const exportDisplayPath = path.relative(root, exportRoot) || exportRoot;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extractScript = path.join(scriptDir, "extract_axure_page_data.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const pageLedgerCache = new Map();
function readPageLedger(pageKey) {
  if (!pageLedgerCache.has(pageKey)) {
    pageLedgerCache.set(pageKey, readJson(path.join(pagesDir, `${pageKey}.json`)));
  }
  return pageLedgerCache.get(pageKey);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(ledgersDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function refreshPageLedgers() {
  ensureDir(pagesDir);
  for (const page of analysis.pages || []) {
    execFileSync(process.execPath, [extractScript, exportRoot, page.page_key, "--out", path.join(pagesDir, `${page.page_key}.json`)], {
      stdio: "pipe",
    });
  }
  pageLedgerCache.clear();
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function parseBodyBackground(pageKey) {
  const css = readTextIfExists(path.join(exportRoot, "files", pageKey, "styles.css"));
  const body = css.match(/body\s*\{([\s\S]*?)\}/);
  if (!body) return null;
  const bg = body[1].match(/background-color\s*:\s*([^;]+);/);
  return bg ? bg[1].trim() : null;
}

function routeFor(pageKey) {
  if (pageKey === entryPageKey) return "/";
  return `/${pageKey}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function itemType(item) {
  return `${item.type || ""} ${item.friendlyType || ""}`.toLowerCase();
}

function itemBounds(item) {
  const bounds = item.bounds || {};
  return {
    x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : 0,
    y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0,
    width: Number.isFinite(Number(bounds.width)) ? Number(bounds.width) : 0,
    height: Number.isFinite(Number(bounds.height)) ? Number(bounds.height) : 0,
  };
}

function hasSvgAsset(item) {
  return item.assetRefs?.some((ref) => /\.svg$/i.test(ref));
}

function collectHtmlTargets(value, targets = []) {
  if (value == null) return targets;
  if (typeof value === "string") {
    const match = value.match(/([A-Za-z0-9_.\-/%]+\.html)(?:$|[?#\s])/i) || value.match(/([A-Za-z0-9_.\-/%]+\.html)$/i);
    if (match) targets.push(path.basename(match[1]));
    return targets;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectHtmlTargets(item, targets));
    return targets;
  }
  if (typeof value === "object") Object.values(value).forEach((item) => collectHtmlTargets(item, targets));
  return targets;
}

function firstLinkTargetFromInteractions(item) {
  for (const event of item?.interactionSummary || []) {
    if (!/click|onClick/i.test(event.eventKey || "")) continue;
    for (const caseItem of event.cases || []) {
      if (caseItem.disabled) continue;
      for (const action of caseItem.actions || []) {
        if (action.action !== "linkWindow" && action.action !== "linkFrame") continue;
        const target = collectHtmlTargets(action)[0];
        if (target) return target;
      }
    }
  }
  return null;
}

function roleFromLinkTarget(target) {
  const pageKey = path.basename(String(target || ""), ".html").toLowerCase();
  if (/calendar|schedule/.test(pageKey)) return "calendar";
  if (/summary|minutes|record/.test(pageKey)) return "summary";
  if (/contacts|contact|address/.test(pageKey)) return "contacts";
  if (/transaction|billing|wallet|pay/.test(pageKey)) return "transaction";
  if (/glossary|term|dictionary/.test(pageKey)) return "book";
  if (/setup|setting|config/.test(pageKey)) return "setting";
  if (/create|new/.test(pageKey)) return "create";
  if (/runing|running|join|video|share-screen|screen|meeting-/.test(pageKey)) return "video";
  return null;
}

function normalizeDescription(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function pageKeyFromHtml(html) {
  return path.basename(String(html || ""), ".html").toLowerCase();
}

function roleFromNavText(text) {
  const value = normalizeDescription(text).toLowerCase();
  if (!value) return null;
  if (/展开|收起|菜单|menu|collapse|expand/.test(value)) return "menu";
  if (/创建会议|create|new/.test(value)) return "create";
  if (/会议日程|日程|calendar|schedule/.test(value)) return "calendar";
  if (/会议总结|总结|summary|minutes|record/.test(value)) return "summary";
  if (/通信录|联系人|contacts|address/.test(value)) return "contacts";
  if (/费用|账单|帐单|交易|transaction|billing|wallet|pay/.test(value)) return "transaction";
  if (/专业语库|术语|词库|glossary|term|dictionary/.test(value)) return "book";
  if (/系统帮助|帮助|help/.test(value)) return "help";
  if (/系统设置|设置|setting|setup|config/.test(value)) return "setting";
  if (/在线客服|客服|support|service/.test(value)) return "customer-service";
  if (/会议|meeting|video/.test(value)) return "video";
  return null;
}

function labelFromRole(role) {
  return (
    {
      menu: "展开/收起",
      create: "创建会议",
      calendar: "会议日程",
      summary: "会议总结",
      contacts: "通信录",
      transaction: "费用帐单",
      book: "专业语库",
      help: "系统帮助",
      setting: "系统设置",
      "customer-service": "在线客服",
      video: "会议",
    }[role] || null
  );
}

function labelFromLinkTarget(target) {
  const pageKey = pageKeyFromHtml(target);
  if (/calendar|schedule/.test(pageKey)) return "会议日程";
  if (/summary|minutes|record/.test(pageKey)) return "会议总结";
  if (/contacts|contact|address/.test(pageKey)) return "通信录";
  if (/transaction|billing|wallet|pay/.test(pageKey)) return "费用帐单";
  if (/glossary|term|dictionary/.test(pageKey)) return "专业语库";
  if (/setup|setting|config/.test(pageKey)) return "系统设置";
  if (/create|new/.test(pageKey)) return "创建会议";
  return pageKey || "侧边菜单";
}

function knownHtmlTarget(html) {
  if (!html) return null;
  const wanted = pageKeyFromHtml(html);
  const page = (analysis.pages || []).find((item) => pageKeyFromHtml(item.html) === wanted || item.page_key === wanted);
  return page?.html || null;
}

function inferredHtmlTargetForRole(role) {
  const byRole = {
    menu: "meeting-runing-menu-expend.html",
    create: "create-meeting.html",
    calendar: "meeting-calendar.html",
    summary: "meeting-summary.html",
    contacts: "meeting-contacts.html",
    transaction: "transactions.html",
    book: "glossary.html",
    setting: "meeting-setup.html",
  };
  return knownHtmlTarget(byRole[role]) || null;
}

function findSideRail(ledger) {
  return (
    (ledger.inventory || [])
      .filter((item) => {
        const bounds = itemBounds(item);
        return (
          item.initiallyVisible &&
          !item.nearestDynamicPanel?.id &&
          !cleanText(item.text) &&
          /rectangle|矩形|box/.test(itemType(item)) &&
          bounds.x <= 8 &&
          bounds.y >= 40 &&
          bounds.y <= 90 &&
          bounds.width >= 40 &&
          bounds.width <= 96 &&
          bounds.height >= 300
        );
      })
      .sort((a, b) => itemBounds(b).height - itemBounds(a).height)[0] || null
  );
}

function sideNavSlotRects(ledger, railBounds) {
  const candidates = (ledger.inventory || [])
    .filter((item) => {
      const bounds = itemBounds(item);
      return (
        item.initiallyVisible &&
        !item.nearestDynamicPanel?.id &&
        !cleanText(item.text) &&
        !hasSvgAsset(item) &&
        /rectangle|矩形|box/.test(itemType(item)) &&
        bounds.x >= railBounds.x &&
        bounds.x <= railBounds.x + railBounds.width &&
        bounds.y >= railBounds.y &&
        bounds.y <= railBounds.y + railBounds.height &&
        bounds.width >= 18 &&
        bounds.width <= 36 &&
        bounds.height >= 18 &&
        bounds.height <= 36
      );
    })
    .sort((a, b) => itemBounds(a).y - itemBounds(b).y || itemBounds(a).x - itemBounds(b).x);
  const slots = [];
  for (const candidate of candidates) {
    if (slots.some((slot) => Math.abs(itemBounds(slot).y - itemBounds(candidate).y) <= 6)) continue;
    slots.push(candidate);
  }
  return slots;
}

function descendantsOfGroup(group, ledger) {
  if (!group) return [];
  return (ledger.inventory || []).filter(
    (candidate) =>
      candidate !== group &&
      ((group.id && candidate.ancestorIds?.includes(group.id)) ||
        (group.scriptId && candidate.ancestorScriptIds?.includes(group.scriptId))),
  );
}

function unionBounds(items) {
  const bounds = items.map(itemBounds).filter((bounds) => bounds.width > 0 && bounds.height > 0);
  if (!bounds.length) return null;
  const minX = Math.min(...bounds.map((bounds) => bounds.x));
  const minY = Math.min(...bounds.map((bounds) => bounds.y));
  const maxX = Math.max(...bounds.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...bounds.map((bounds) => bounds.y + bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function textEvidenceFromItems(items) {
  return (
    items
      .filter((item) => item.initiallyVisible !== false)
      .map((item) => normalizeDescription(item.text || item.label || ""))
      .filter(Boolean)
      .filter((text) => !/^\d{1,2}:\d{2}/.test(text))
      .sort((a, b) => b.length - a.length)[0] || ""
  );
}

function hasExecutableNavAction(item) {
  for (const event of item?.interactionSummary || []) {
    if (!/click|onClick/i.test(event.eventKey || "")) continue;
    for (const caseItem of event.cases || []) {
      if (caseItem.disabled) continue;
      for (const action of caseItem.actions || []) {
        if (action.action === "linkWindow") return true;
        if (action.action === "setPanelState" || action.action === "fadeWidget") return true;
        if (action.action && action.action !== "setFunction") return true;
        if (action.action === "setFunction" && !/选中状态|selected/i.test(action.description || "")) return true;
      }
    }
  }
  return false;
}

function sideNavEntryForInteractionGroup(group, ledger) {
  const descendants = descendantsOfGroup(group, ledger);
  const visibleParts = descendants.filter((item) => item.initiallyVisible !== false && !item.nearestDynamicPanel?.id);
  const visibleBounds = unionBounds(visibleParts);
  if (!visibleBounds) return null;
  if (visibleBounds.x > 160 || visibleBounds.y < 60 || visibleBounds.y > 640) return null;
  if (visibleBounds.width > 170 || visibleBounds.height > 48) return null;
  const text = textEvidenceFromItems(visibleParts);
  const html = firstLinkTargetFromInteractions(group);
  const role = roleFromLinkTarget(html) || roleFromNavText(text);
  if (!role && !text && !html) return null;
  return {
    slotY: Math.round(visibleBounds.y),
    bounds: visibleBounds,
    group,
    text,
    label: text || (html ? labelFromLinkTarget(html) : labelFromRole(role)) || "",
    role: role || null,
    html: html || null,
    route: html ? routeFor(pageKeyFromHtml(html)) : null,
    executable: hasExecutableNavAction(group),
    sourceScriptIds: Array.from(new Set([group.scriptId].filter(Boolean))),
  };
}

function sideNavEntriesFromLedger(ledger) {
  const entries = [];
  const seen = new Set();
  for (const group of ledger.interactions || []) {
    if (!group.interactionKeys?.some((key) => /click|onClick/i.test(key))) continue;
    const key = group.id || group.scriptId;
    if (seen.has(key)) continue;
    const entry = sideNavEntryForInteractionGroup(group, ledger);
    if (!entry) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries.sort((a, b) => a.slotY - b.slotY);
}

let sideNavConsensusCache = null;
function sideNavConsensusEntries() {
  if (sideNavConsensusCache) return sideNavConsensusCache;
  const buckets = [];
  for (const page of analysis.pages || []) {
    const ledger = readPageLedger(page.page_key);
    for (const entry of sideNavEntriesFromLedger(ledger)) {
      let bucket = buckets.find((candidate) => Math.abs(candidate.slotY - entry.slotY) <= 8);
      if (!bucket) {
        bucket = { slotY: entry.slotY, entries: [] };
        buckets.push(bucket);
      }
      bucket.entries.push({ ...entry, pageKey: page.page_key });
      bucket.slotY = Math.round(bucket.entries.reduce((sum, item) => sum + item.slotY, 0) / bucket.entries.length);
    }
  }
  sideNavConsensusCache = buckets
    .map((bucket) => {
      const sorted = bucket.entries.slice().sort((a, b) => {
        const score = (item) => (item.html ? 8 : 0) + (item.text ? 6 : 0) + (item.label ? 4 : 0) + (item.executable ? 2 : 0);
        return score(b) - score(a);
      });
      const best = sorted[0];
      const role = roleFromLinkTarget(best?.html) || roleFromNavText(best?.label) || best?.role || null;
      const html = best?.html || inferredHtmlTargetForRole(role);
      return {
        slotY: bucket.slotY,
        role,
        label: best?.label || labelFromLinkTarget(html) || labelFromRole(role) || "",
        html,
        route: html ? routeFor(pageKeyFromHtml(html)) : null,
        sourcePages: Array.from(new Set(bucket.entries.map((entry) => entry.pageKey))).sort(),
        sourceScriptIds: Array.from(new Set(bucket.entries.flatMap((entry) => entry.sourceScriptIds || []))).filter(Boolean),
        evidence: sorted.map((entry) => ({
          pageKey: entry.pageKey,
          scriptId: entry.group?.scriptId || null,
          text: entry.text || "",
          label: entry.label,
          html: entry.html,
          role: entry.role,
          executable: entry.executable,
        })),
      };
    })
    .filter((entry) => entry.role || entry.label || entry.html)
    .sort((a, b) => a.slotY - b.slotY);
  return sideNavConsensusCache;
}

function canonicalSideNavForY(slotY) {
  const nearest =
    sideNavConsensusEntries()
      .slice()
      .sort((a, b) => Math.abs(a.slotY - slotY) - Math.abs(b.slotY - slotY))[0] || null;
  return nearest && Math.abs(nearest.slotY - slotY) <= 10 ? nearest : null;
}

function sharedSideNavForPage(page) {
  const ledger = pageLedgers.get(page.pageKey);
  const rail = findSideRail(ledger);
  if (!rail) return null;
  const railBounds = itemBounds(rail);
  const slots = sideNavSlotRects(ledger, railBounds);
  if (slots.length < 3) return null;
  const byId = new Map(ledger.inventory.filter((item) => item.id).map((item) => [item.id, item]));
  const byScriptId = new Map(ledger.inventory.filter((item) => item.scriptId).map((item) => [item.scriptId, item]));
  const items = slots.map((slot, index) => {
    const ancestors = [
      ...(slot.ancestorIds || []).map((id) => byId.get(id)),
      ...(slot.ancestorScriptIds || []).map((scriptId) => byScriptId.get(scriptId)),
    ].filter(Boolean);
    const group = ancestors.find((ancestor) => ancestor.interactionKeys?.some((key) => /click|onClick/i.test(key))) || null;
    const localEntry = sideNavEntryForInteractionGroup(group, ledger);
    const canonical = canonicalSideNavForY(itemBounds(slot).y);
    const role =
      roleFromLinkTarget(localEntry?.html) ||
      roleFromNavText(localEntry?.label) ||
      canonical?.role ||
      (index === 0 ? "menu" : null);
    const target = localEntry?.html || canonical?.html || inferredHtmlTargetForRole(role);
    return {
      slotIndex: index,
      slotScriptId: slot.scriptId,
      groupScriptId: group?.scriptId ?? null,
      bounds: itemBounds(slot),
      html: target,
      route: target ? routeFor(pageKeyFromHtml(target)) : null,
      label:
        (localEntry?.text ? localEntry.label : null) ||
        canonical?.label ||
        localEntry?.label ||
        labelFromRole(role) ||
        (target ? labelFromLinkTarget(target) : null) ||
        "",
      role: role || "generic",
      interactionKeys: group?.interactionKeys || [],
      resolvedFrom: localEntry?.html ? "local-linkWindow" : canonical?.html ? "canonical-menu-evidence" : target ? "role-inference" : "local-only",
      consensusEvidence: canonical?.evidence || [],
    };
  }).filter((item) => item.role || item.html || item.label);
  return {
    pageKey: page.pageKey,
    route: page.route,
    railScriptId: rail.scriptId,
    railBounds,
    itemCount: items.length,
    items,
  };
}

function assetExists(assetRef) {
  const normalized = assetRef.replace(/^\.\.\//, "");
  return fs.existsSync(path.join(exportRoot, normalized));
}

refreshPageLedgers();

const pageLedgers = new Map(
  analysis.pages.map((page) => [page.page_key, readPageLedger(page.page_key)]),
);

const pageInventory = analysis.pages.map((page) => {
  const ledger = pageLedgers.get(page.page_key);
  return {
    pageName: ledger.pageName,
    html: page.html,
    pageKey: page.page_key,
    route: routeFor(page.page_key),
    dataJs: page.data_js,
    stylesCss: page.styles_css,
    pageType: page.page_key.startsWith("meeting-") ? "meeting-flow-or-state" : "main-page",
    counts: ledger.counts,
    featureCounts: page.feature_counts,
    outgoing: page.link_targets,
  };
});

const routeGraph = {
  entry: `${entryPageKey}.html`,
  routeStrategy: `Axure-filename-close routes with / mapped to ${entryPageKey}`,
  routes: pageInventory.map((page) => ({
    pageKey: page.pageKey,
    html: page.html,
    route: page.route,
    linksTo: page.outgoing.map((target) => ({
      html: target,
      pageKey: path.basename(target, ".html").toLowerCase(),
      route: routeFor(path.basename(target, ".html")),
    })),
  })),
};

const stateVariantLedger = {
  policy: "Keep filename-close routes for coverage; consolidate obvious live-meeting variants in shared renderer/state where interactions target them.",
  groups: [
    {
      name: "live-meeting-states",
      pages: pageInventory
        .filter((page) => /^meeting-(runing|no-share|share-screen|video|time-line|join)$/.test(page.pageKey))
        .map((page) => page.pageKey),
    },
  ],
};

const sharedSideNavPages = pageInventory.map(sharedSideNavForPage).filter(Boolean);
const sharedChromeLedger = {
  source:
    "Repeated left icon rail/header widgets detected by similar bounds, copied Axure groups, and repeated linkWindow targets.",
  menuTargets: Array.from(
    new Set(sharedSideNavPages.flatMap((page) => page.items.map((item) => item.html).filter(Boolean))),
  ).sort(),
  canonicalSideNav: sideNavConsensusEntries(),
  sideNavPages: sharedSideNavPages,
  rule:
    "Merge repeated copied icon rails into one shared shell. Build canonical menu entries from event-bearing Axure groups, expanded-menu text, slot y-order, and linkWindow targets. Transfer missing collapsed-state links from canonical evidence, keep help/service/settings as distinct roles, and never invent menu modules from slot order alone.",
};

const assetLedger = [];
for (const [pageKey, ledger] of pageLedgers) {
  for (const item of ledger.assets) {
    for (const ref of item.assetRefs) {
      assetLedger.push({
        pageKey,
        scriptId: item.scriptId,
        type: item.friendlyType || item.type,
        text: item.text,
        ref,
        exists: assetExists(ref),
        classification: ref.endsWith(".svg") ? "generic-ui-or-product-icon" : "content-image-or-screenshot",
      });
    }
  }
}

const elementCoverageLedger = [];
for (const [pageKey, ledger] of pageLedgers) {
  for (const item of ledger.mustImplement) {
    elementCoverageLedger.push({
      pageKey,
      scriptId: item.scriptId,
      id: item.id,
      type: item.friendlyType || item.type || "unknown",
      text: item.text,
      input: item.html?.input ?? null,
      options: item.html?.options ?? [],
      assetRefs: item.assetRefs,
      bounds: item.bounds,
      initiallyVisible: item.initiallyVisible,
      htmlHidden: item.htmlHidden,
      hiddenInteractionTarget: item.hiddenInteractionTarget,
      interactionKeys: item.interactionKeys,
      disposition: "pending",
    });
  }
}

const visualBaselineLedger = pageInventory.map((page) => {
  const ledger = pageLedgers.get(page.pageKey);
  const initial = ledger.initiallyVisible;
  const maxX = Math.max(0, ...initial.map((item) => (item.bounds?.x ?? 0) + (item.bounds?.width ?? 0)));
  const maxY = Math.max(0, ...initial.map((item) => (item.bounds?.y ?? 0) + (item.bounds?.height ?? 0)));
  return {
    pageKey: page.pageKey,
    html: page.html,
    route: page.route,
    referenceViewport,
    targetTheme,
    bodyBackground: parseBodyBackground(page.pageKey),
    sourceContrastNotes: "Use Axure fills/text colors as hierarchy evidence; render with selected dark Ant Design tokens.",
    initialVisibleCount: ledger.counts.initiallyVisible,
    hiddenInteractionTargetCount: ledger.counts.hiddenInteractionTargets,
    majorBounds: { maxX, maxY },
    scrollModel: maxY > referenceViewport.height ? "body-scroll" : "expected-no-body-scroll",
    fixedPanels: ledger.inventory
      .filter((item) => item.bounds?.position === "fixed" || item.css?.self?.position === "fixed")
      .map((item) => ({
        scriptId: item.scriptId,
        id: item.id,
        label: item.label,
        bounds: item.bounds,
        css: item.css?.self ?? null,
        initiallyVisible: item.initiallyVisible,
        htmlHidden: item.htmlHidden,
      })),
    dominantAssets: ledger.assets
      .filter((item) => item.initiallyVisible && item.assetRefs.some((ref) => /\.(png|jpe?g|webp)$/i.test(ref)))
      .map((item) => ({ scriptId: item.scriptId, text: item.text, bounds: item.bounds, refs: item.assetRefs })),
  };
});

const dataLedger = pageInventory.map((page) => {
  const ledger = pageLedgers.get(page.pageKey);
  return {
    pageKey: page.pageKey,
    text: ledger.textNodes.map((item) => ({
      scriptId: item.scriptId,
      text: item.text,
      initiallyVisible: item.initiallyVisible,
      hiddenInteractionTarget: item.hiddenInteractionTarget,
    })),
    controls: ledger.controls.map((item) => ({
      scriptId: item.scriptId,
      type: item.friendlyType || item.type,
      text: item.text,
      input: item.html?.input ?? null,
      options: item.html?.options ?? [],
      initiallyVisible: item.initiallyVisible,
    })),
    repeaters: ledger.inventory
      .filter((item) => /repeater|中继器/i.test(`${item.type || ""} ${item.friendlyType || ""}`))
      .map((item) => ({
        scriptId: item.scriptId,
        label: item.label,
        bounds: item.bounds,
        dataProps: item.dataProps ?? [],
        rows: Array.isArray(item.data) ? item.data : [],
        rowCount: Array.isArray(item.data) ? item.data.length : 0,
        bindings: (item.interactionSummary || []).flatMap((event) =>
          (event.cases || []).flatMap((caseItem) =>
            (caseItem.actions || [])
              .filter((action) => /\[\[Item\./i.test(action.description || ""))
              .map((action) => ({
                eventKey: event.eventKey,
                description: action.description,
                targets: action.objectPaths || [],
              })),
          ),
        ),
      })),
  };
});

const interactionLedger = pageInventory.map((page) => {
  const ledger = pageLedgers.get(page.pageKey);
  return {
    pageKey: page.pageKey,
    interactions: ledger.interactions.map((item) => ({
      scriptId: item.scriptId,
      type: item.friendlyType || item.type,
      text: item.text,
      bounds: item.bounds,
      summary: item.interactionSummary,
    })),
  };
});

function actionIntent(action) {
  const description = String(action.description || "");
  const actionName = String(action.action || "");
  if (action.action === "linkWindow" || action.action === "linkFrame" || collectHtmlTargets(action).length) return "navigate";
  if (/hide|隐藏/i.test(`${actionName} ${description}`)) return "hide";
  if (/show|显示/i.test(`${actionName} ${description}`)) return "show";
  if (action.action === "setPanelState") return "set-panel-state";
  if (action.action === "setFunction" && /文本|text|richtext/i.test(description)) return "set-text";
  if (action.action === "updateItemsInDataSet") return "update-repeater-row";
  if (/选中|check|selected/i.test(description)) return "set-selected-state";
  return action.action || "unknown";
}

function interactionContractForPage(page) {
  const ledger = pageLedgers.get(page.pageKey);
  const byId = new Map(ledger.inventory.filter((item) => item.id).map((item) => [item.id, item]));
  const targetOf = (id) => {
    const target = byId.get(id);
    return {
      id,
      scriptId: target?.scriptId ?? null,
      label: target?.label ?? null,
      type: target?.friendlyType || target?.type || null,
      text: target?.text ?? "",
      bounds: target?.bounds ?? null,
      initiallyVisible: target?.initiallyVisible ?? null,
      htmlHidden: target?.htmlHidden ?? null,
      hiddenInteractionTarget: target?.hiddenInteractionTarget ?? null,
    };
  };
  return {
    pageKey: page.pageKey,
    route: page.route,
    sources: ledger.interactions.map((item) => ({
      sourceScriptId: item.scriptId,
      sourceId: item.id,
      sourceType: item.friendlyType || item.type || "unknown",
      sourceText: item.text || "",
      sourceLabel: item.label || null,
      bounds: item.bounds,
      initiallyVisible: item.initiallyVisible,
      htmlHidden: item.htmlHidden,
      hiddenInteractionTarget: item.hiddenInteractionTarget,
      nearestDynamicPanel: item.nearestDynamicPanel ?? null,
      events: (item.interactionSummary || []).map((event) => ({
        eventKey: event.eventKey,
        eventType: event.eventType,
        cases: (event.cases || []).map((caseItem, caseIndex) => ({
          caseIndex,
          conditionString: caseItem.conditionString,
          disabled: caseItem.disabled,
          actions: (caseItem.actions || []).map((action, actionIndex) => ({
            actionIndex,
            action: action.action || null,
            displayName: action.displayName || null,
            description: action.description || null,
            intent: actionIntent(action),
            linkTargets: collectHtmlTargets(action),
            objectTargets: (action.objectPaths || []).map(targetOf),
          })),
        })),
      })),
      requiredValidation:
        item.hiddenInteractionTarget || !item.initiallyVisible
          ? "Validate after the source panel/state is revealed; event must remain bound to the visible control."
          : "Validate direct click behavior from the initial or reached state.",
    })),
  };
}

const interactionContractLedger = pageInventory.map(interactionContractForPage);
const dynamicPanelNavigationLedger = {
  profile: architectureProfile,
  applies: isDynamicPanelApp,
  rule:
    "For single-page-dynamic-panel-app profiles, menu/button/tab sources with setPanelState actions must become local frontend panel-state transitions, not route or linkFrame navigation.",
  sources: interactionContractLedger.flatMap((page) =>
    page.sources.flatMap((source) =>
      source.events.flatMap((event) =>
        event.cases.flatMap((caseItem) =>
          caseItem.actions
            .filter((action) => action.intent === "set-panel-state")
            .map((action) => ({
              pageKey: page.pageKey,
              route: page.route,
              sourceId: source.sourceId,
              sourceScriptId: source.sourceScriptId,
              sourceType: source.sourceType,
              sourceText: source.sourceText,
              sourceLabel: source.sourceLabel,
              bounds: source.bounds,
              initiallyVisible: source.initiallyVisible,
              htmlHidden: source.htmlHidden,
              hiddenInteractionTarget: source.hiddenInteractionTarget,
              nearestDynamicPanel: source.nearestDynamicPanel,
              eventKey: event.eventKey,
              caseIndex: caseItem.caseIndex,
              actionIndex: action.actionIndex,
              description: action.description,
              targetPanels: action.objectTargets,
              validation:
                "Click the visible source label/icon/button and assert the target panel switches to the Axure state named in the action description; previous inactive states must be hidden.",
            })),
        ),
      ),
    ),
  ),
};
const architectureTasks = [
  {
    id: "AX-002A",
    phase: "architecture",
    title: "Confirmed Architecture Strategy",
    evidence: ["axure-analysis.json architecture", "references/prototype-architecture-profiles.md"],
    scope: `confirmed profile ${architectureProfile} (${architectureConfidence} confidence) drives route/menu/panel task strategy`,
    acceptance: [
      "confirmed or auto-approved architecture profile is recorded in superpower-workflow.json",
      "task plan uses the selected profile's navigation strategy instead of a generic menu strategy",
    ],
    validation: ["inspect axure-analysis.json architecture", "inspect task-plan.md architecture section"],
  },
];
if (isDynamicPanelApp) {
  architectureTasks.push({
    id: "AX-004A",
    phase: "interaction",
    title: "Dynamic Panel Menu State Machine",
    evidence: [
      "dynamic-panel-navigation-ledger.json",
      "interaction-contract-ledger.json",
      "state-variant-ledger.json",
      "page ledgers",
      "prototype-architecture-profiles.md",
    ],
    scope:
      "map menu/button/tab setPanelState actions to local frontend panel state; transfer click handlers from invisible groups to visible labels/icons/buttons; preserve nested panel state independently",
    acceptance: [
      "initial render shows only the Axure default main panel state",
      "every visible menu item with a setPanelState source changes the matching target panel state",
      "inactive panel-state descendants do not leak into the page layout",
      "dynamic-panel menu clicks are not replaced by route navigation or linkFrame behavior unless Axure used linkWindow/linkFrame",
    ],
    validation: ["click each dynamic-panel menu item", "assert target state content appears", "assert previous state content is hidden"],
  });
}
const superpowerTasks = [
  {
    id: "AX-001",
    phase: "setup",
    title: "Project Initialization",
    evidence: ["package.json", "axure-analysis.json"],
    scope: "Vite React TS, Ant Design, React Router, build wiring",
    acceptance: ["npm run build succeeds"],
    validation: ["npm run build"],
  },
  {
    id: "AX-002",
    phase: "evidence",
    title: "Evidence Ledgers",
    evidence: ["axure-ledgers/*.json", "axure-ledgers/pages/*.json"],
    scope: "inventory, route graph, shared chrome, visual baseline, assets, data, element coverage, interaction contract",
    acceptance: ["every page has counts", "every interaction-bearing widget appears in interaction-contract-ledger.json"],
    validation: ["inspect axure-ledgers/superpower-workflow.json", "inspect axure-ledgers/interaction-contract-ledger.json"],
  },
  ...architectureTasks,
  {
    id: "AX-003",
    phase: "renderer",
    title: "Generic Axure Renderer",
    evidence: ["element-coverage-ledger.json", "visual-baseline-ledger.json", "page ledgers"],
    scope: "widgets by scriptId, CSS-derived bounds/position, initial visibility, controls, fixed dynamic panels, shared chrome",
    acceptance: [
      "mustImplement rows are rendered or intentionally covered",
      "fixed panels use exported fixed/center CSS",
      "repeated side menus render as shared chrome",
    ],
    validation: ["npm run build", "renderer health checks"],
  },
  {
    id: "AX-003B",
    phase: "data",
    title: "Prototype Data Restoration",
    evidence: ["data-ledger.json", "page ledgers"],
    scope: "exact text/default values/options/repeater rows/onBeforeItemLoad bindings",
    acceptance: ["prototype text and row data are unchanged", "hidden panel content is available when revealed"],
    validation: ["renderer data density checks", "repeater row count checks"],
  },
  {
    id: "AX-003C",
    phase: "component-mapping",
    title: "Repeater List Component Restoration",
    evidence: ["data-ledger.json repeaters", "element-coverage-ledger.json", "interaction-contract-ledger.json"],
    scope: "map Axure repeaters to framework List/ListItem components by default; upgrade to Table/Grid only with table/grid evidence",
    acceptance: [
      "repeater source rows render through a data-driven list component",
      "item-template controls are covered by the list renderer",
      "row actions remain bound to list items",
      "repeaters are not restored as loose labels or unproven tables",
    ],
    validation: ["repeater/list row count checks", "row action click checks"],
  },
  {
    id: "AX-004",
    phase: "interaction",
    title: "Interaction Restoration",
    evidence: ["interaction-contract-ledger.json", "interaction-ledger.json"],
    scope: "linkWindow, show/hide dynamic panels, setPanelState, text changes, repeater row updates, close/cancel/confirm controls",
    acceptance: [
      "every event source has implemented action behavior or documented omission",
      "close/cancel/confirm buttons retain their source events",
      "hidden dynamic-panel targets do not leak and reveal/hide correctly",
    ],
    validation: ["hidden show/hide checks", "close icon checks", "route navigation checks"],
  },
  {
    id: "AX-005",
    phase: "validation",
    title: "Visual And Flow Validation",
    evidence: ["visual-baseline-ledger.json", "superpower-workflow.json"],
    scope: "screenshots, skeleton, fixed modal geometry/z-order, shared chrome, framework icon replacement, interaction flows",
    acceptance: ["validation report records pass/fail for pages and primary interactions"],
    validation: ["node <skill-dir>/scripts/validate_react_antd_renderer.mjs <frontend-url>"],
  },
  {
    id: "AX-006",
    phase: "delivery",
    title: "Delivery Docs",
    evidence: ["generated artifacts"],
    scope: "README, route map, interaction notes, asset summary, coverage status, known deviations",
    acceptance: ["delivery docs include hook audit trail and validation summary"],
    validation: ["manual document review"],
  },
];

const interactionSourceCount = interactionContractLedger.reduce((count, page) => count + page.sources.length, 0);
const hiddenInteractionSourceCount = interactionContractLedger.reduce(
  (count, page) => count + page.sources.filter((source) => source.hiddenInteractionTarget || !source.initiallyVisible).length,
  0,
);
const repeaterCount = dataLedger.reduce((count, page) => count + page.repeaters.length, 0);
const hookStatus = autoApproveHooks ? "auto-approved-by-user-request" : "pending-user-approval";
const superpowerWorkflow = {
  source: autoApproveHooks
    ? "Generated by axure-to-frontend evidence script; hooks auto-approved because the user explicitly requested a full run."
    : "Generated by axure-to-frontend evidence script; hook decisions are user-visible gates, not automatic approvals.",
  hooks: [
    {
      id: "SP-HOOK-01",
      name: "superpower task generation",
      status: hookStatus,
      prompt: "Evidence is ready. Generate or refresh the superpowers task plan from ledgers?",
      mustShow: ["axure-ledgers/superpower-workflow.json", "task-plan.md", "axure-ledgers/interaction-contract-ledger.json"],
    },
    {
      id: "SP-HOOK-02",
      name: "superpower task execution",
      status: hookStatus,
      prompt: "Task manifest is ready. Execute all tasks, selected task ids, or stop for review?",
      mustShow: ["taskManifest"],
    },
    {
      id: "SP-HOOK-03",
      name: "superpower validation",
      status: hookStatus,
      prompt: "Implementation tasks are complete. Run validation commands and browser flows?",
      mustShow: ["validation commands", "interaction flows from interaction-contract-ledger.json"],
    },
  ],
  evidenceSummary: {
    architectureProfile,
    architectureConfidence,
    pages: pageInventory.length,
    mustImplement: elementCoverageLedger.length,
    interactionSources: interactionSourceCount,
    hiddenOrReachedInteractionSources: hiddenInteractionSourceCount,
    repeaters: repeaterCount,
    sharedChromePages: sharedSideNavPages.length,
    menuTargets: sharedChromeLedger.menuTargets.length,
  },
  artifacts: {
    pageInventory: "axure-ledgers/page-inventory.json",
    routeGraph: "axure-ledgers/route-graph.json",
    sharedChrome: "axure-ledgers/shared-chrome-ledger.json",
    dynamicPanelNavigation: "axure-ledgers/dynamic-panel-navigation-ledger.json",
    data: "axure-ledgers/data-ledger.json",
    interactions: "axure-ledgers/interaction-ledger.json",
    interactionContract: "axure-ledgers/interaction-contract-ledger.json",
    elementCoverage: "axure-ledgers/element-coverage-ledger.json",
    taskPlan: "task-plan.md",
  },
  taskManifest: superpowerTasks,
};

const taskPlan = `# Axure Restoration Task Plan

## Superpower Workflow Hooks

- SP-HOOK-01 tasking: ${hookStatus} before superpowers task generation/refresh.
- SP-HOOK-02 execution: ${hookStatus} before task execution.
- SP-HOOK-03 validation: ${hookStatus} before validation commands and browser flows.
- Workflow manifest: axure-ledgers/superpower-workflow.json
- Interaction contract: axure-ledgers/interaction-contract-ledger.json

## Decision Record

- Export directory: ${exportDisplayPath}
- Entry page: ${entryPageKey}.html
- Stack: React + Vite + TypeScript + Ant Design
- Prototype type: web
- Target theme: ${targetTheme}
- Output directory: aimeet-web
- Scope: all pages from sitemap
- Restoration depth: full prototype restoration with visible states, hidden interaction targets, repeaters, and page navigation
- Route strategy: Axure-filename-close routes, with / mapped to create-meeting
- Responsive target: desktop web, reference viewport ${referenceViewport.width}x${referenceViewport.height}
- Data handling: local typed prototype data from Axure ledgers
- Architecture profile: ${architectureProfile} (${architectureConfidence})
- Architecture rule: confirmed profile controls menu, route, inline-frame, and dynamic-panel state restoration; dynamic-panel app menus with setPanelState must update local panel state instead of becoming route/linkFrame navigation.

## Architecture Evidence

${(architecture.candidates?.[0]?.evidence || []).map((item) => `- ${item}`).join("\n") || "- No architecture evidence recorded."}

## Task Manifest

${superpowerTasks
  .map(
    (task) => `### ${task.id} ${task.title}

- Phase: ${task.phase}
- Evidence: ${task.evidence.join(", ")}
- Scope: ${task.scope}
- Acceptance:
${task.acceptance.map((item) => `  - ${item}`).join("\n")}
- Validation:
${task.validation.map((item) => `  - ${item}`).join("\n")}`,
  )
  .join("\n\n")}

### AX-001 Project Initialization

- Source: selected stack
- Evidence: package.json, axure-analysis.json
- Scope: Vite React TS, Ant Design, React Router
- Acceptance: npm run build succeeds.

### AX-002 Evidence Ledgers

- Source: all Axure pages
- Evidence: axure-ledgers/*.json and axure-ledgers/pages/*.json
- Scope: inventory, route graph, visual baseline, assets, coverage, data, interactions
- Acceptance: every page has counts and a mustImplement coverage list.

### AX-003 Generic Axure Renderer

- Source: element-coverage-ledger.json and page ledgers
- Scope: render widgets by scriptId, CSS-derived bounds/position, initial visibility, text, assets, AntD-compatible inputs/selects/checkboxes, fixed dynamic panels, repeaters, hidden target panels, and shared repeated chrome such as copied left icon rails
- Acceptance: all mustImplement rows are either rendered, covered by a rendered parent component/repeater template/shared chrome component, or documented as an approved omission; fixed panels use exported fixed/center CSS instead of stale page coordinates; repeated side menus render as one shared component instead of duplicated per-page fragments.

### AX-003B Prototype Data Restoration

- Source: data-ledger.json repeater rows, control defaults, visible/hidden text nodes, and onBeforeItemLoad bindings
- Scope: exact text/default values/options/repeater rows are rendered from Axure data and template bindings; Axure repeaters map to data-driven List/ListItem components by default.
- Acceptance: every repeater with source rows renders at least the same row count and first-row business values through a list renderer; no template-only row controls leak as standalone page widgets; repeaters are upgraded to Table/Grid only when source evidence supports that semantic mapping.

### AX-004 Interaction Restoration

- Source: interaction-ledger.json
- Scope: linkWindow route navigation, show/hide dynamic panels, setPanelState, SetWidgetRichText/setFunction text changes, repeater row updates, transient copy prompt, selected/check state toggles, close icon buttons, nested dialog panels, and zero-size Axure group events transferred to their visible slot/button bounds
- Acceptance: primary click interactions reveal/hide the same target subtrees, hidden dynamic-panel targets are not visible on route load, fixed modal targets stay centered/in-front after reveal, nested hidden panels/dialogs stay in the fixed ancestor coordinate system and do not leak when an ancestor panel is shown, close icon buttons use framework close icons and hide their target panels, repeater row actions mutate the same row data, shared side menu buttons execute their original click/linkWindow actions, and route links navigate to implemented routes.

### AX-005 Visual Validation

- Source: visual-baseline-ledger.json
- Scope: capture Axure and frontend screenshots for entry page and representative meeting pages
- Acceptance: skeleton, visibility, fixed modal geometry/z-order, table/repeater data density, dominant assets, shared chrome, framework icon replacement, and element counts are recognizable at the reference viewport.

### AX-006 Delivery Docs

- Source: generated artifacts
- Scope: README and validation-report
- Acceptance: documents stack, route map, interactions, asset summary, coverage status, known deviations.
`;

const readme = `# AImeet Axure Restoration

## Stack

- React + Vite + TypeScript
- Ant Design dark theme
- Source Axure export: ${exportRoot}
- Entry page: create-meeting.html
- Reference viewport: ${referenceViewport.width}x${referenceViewport.height}
- Architecture profile: ${architectureProfile} (${architectureConfidence})

## Restoration Scope

- Pages: ${pageInventory.length}
- Restoration depth: visible states, hidden interaction targets, repeaters/data, local route navigation, and primary show/hide interactions.
- Data handling: local prototype data extracted from Axure ledgers.
- Asset handling: Axure image/SVG/PNG assets copied to public/axure-assets.

## Route Map

| Axure page | Route | Initial widgets | Must implement |
| --- | --- | ---: | ---: |
${pageInventory.map((page) => `| ${page.html} | ${page.route} | ${page.counts.initiallyVisible} | ${page.counts.mustImplement} |`).join("\n")}

## Page Flow

\`\`\`mermaid
flowchart TD
${routeGraph.routes
  .flatMap((route) =>
    route.linksTo.length
      ? route.linksTo.map((target) => `  ${route.pageKey.replace(/-/g, "_")}["${route.pageKey}"] --> ${target.pageKey.replace(/-/g, "_")}["${target.pageKey}"]`)
      : [`  ${route.pageKey.replace(/-/g, "_")}["${route.pageKey}"]`],
  )
  .join("\n")}
\`\`\`

## Component Mapping Notes

- Axure widgets are rendered from \`axure-ledgers/pages/*.json\` through the bundled React AntD renderer.
- Text boxes, selects, checkboxes, images, repeaters, buttons, and hidden dynamic panels are mapped from source evidence.
- Axure repeaters are treated as framework List/ListItem data components by default, with Table/Grid used only when source evidence supports that mapping.
- Repeated left icon rails are consolidated into shared chrome; slot geometry and linkWindow targets come from \`shared-chrome-ledger.json\`.
- Confirmed architecture profile controls navigation restoration: repeated-shell profiles use shared route chrome, inline-frame profiles use targeted \`linkFrame\` outlets, and dynamic-panel app profiles use local \`setPanelState\` state machines for menus.
- Zero-size or transparent interactive Axure groups are expanded or transferred to their visible slot bounds so their events remain clickable.
- SVG-only UI icons are replaced with framework icons inferred from nearby text, link targets, and stable shared-menu slot order.
- Interaction sources and their action targets are auditable in \`axure-ledgers/interaction-contract-ledger.json\`.
- Superpower tasking/execution/validation hooks are auditable in \`axure-ledgers/superpower-workflow.json\`.

## Validation

See \`validation-report.md\`.
`;

const validationReport = `# Validation Report

## Commands

- npm run build
- node <skill-dir>/scripts/validate_react_antd_renderer.mjs <frontend-url>
- Playwright screenshots in output/playwright/

## Superpower Hooks

- SP-HOOK-01 tasking: ${hookStatus}
- SP-HOOK-02 execution: ${hookStatus}
- SP-HOOK-03 validation: ${hookStatus}
- Inspect \`axure-ledgers/superpower-workflow.json\` before continuing.

## Current Status

Generated by skill evidence script. Run validation after starting the dev server and update this report with observed results.

## Known Tolerance

- Exact Axure runtime playback effects are approximated with React state.
- Ant Design controls are styled to fit Axure bounds but may differ in internal glyph details.
`;

ensureDir(ledgersDir);
writeJson("page-inventory.json", pageInventory);
writeJson("route-graph.json", routeGraph);
writeJson("shared-chrome-ledger.json", sharedChromeLedger);
writeJson("dynamic-panel-navigation-ledger.json", dynamicPanelNavigationLedger);
writeJson("state-variant-ledger.json", stateVariantLedger);
writeJson("asset-ledger.json", assetLedger);
writeJson("element-coverage-ledger.json", elementCoverageLedger);
writeJson("visual-baseline-ledger.json", visualBaselineLedger);
writeJson("data-ledger.json", dataLedger);
writeJson("interaction-ledger.json", interactionLedger);
writeJson("interaction-contract-ledger.json", interactionContractLedger);
writeJson("superpower-workflow.json", superpowerWorkflow);
fs.writeFileSync(path.join(root, "task-plan.md"), taskPlan, "utf8");
fs.writeFileSync(path.join(root, "README.md"), readme, "utf8");
fs.writeFileSync(path.join(root, "validation-report.md"), validationReport, "utf8");

console.table(pageInventory.map((page) => ({
  page: page.pageKey,
  route: page.route,
  initial: page.counts.initiallyVisible,
  must: page.counts.mustImplement,
  interactions: page.counts.interactions,
})));

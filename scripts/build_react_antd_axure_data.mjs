import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const exportRoot = path.resolve(process.argv[3] || path.resolve(root, "..", "yuanxing1.0"));
const pagesDir = path.join(root, "axure-ledgers", "pages");
const publicAssetsRoot = path.join(root, "public", "axure-assets");
const srcDataDir = path.join(root, "src", "data");
const analysis = JSON.parse(fs.readFileSync(path.join(root, "axure-analysis.json"), "utf8"));
const entryPageKey = (analysis.pages || []).some((page) => page.page_key === "mainframe") ? "mainframe" : "create-meeting";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const ledgerCache = new Map();
function readPageLedger(pageKey) {
  if (!ledgerCache.has(pageKey)) {
    ledgerCache.set(pageKey, readJson(path.join(pagesDir, `${pageKey}.json`)));
  }
  return ledgerCache.get(pageKey);
}

function normalizeAssetRef(ref) {
  return ref.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^(\.\.\/)+/, "");
}

function publicAssetUrl(ref) {
  return `/axure-assets/${normalizeAssetRef(ref)}`;
}

function copyAsset(ref) {
  const normalized = normalizeAssetRef(ref);
  const source = path.join(exportRoot, normalized);
  if (!fs.existsSync(source)) return false;
  const dest = path.join(publicAssetsRoot, normalized);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(source, dest);
  return true;
}

function argbToRgba(value, fallbackOpacity = 1) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const raw = Number(value) >>> 0;
  const a = ((raw >>> 24) & 255) / 255;
  const r = (raw >>> 16) & 255;
  const g = (raw >>> 8) & 255;
  const b = raw & 255;
  return `rgba(${r}, ${g}, ${b}, ${Number((a * fallbackOpacity).toFixed(3))})`;
}

function parseOpacity(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function styleOf(item) {
  const style = item.style || {};
  const cssSelf = item.css?.self || {};
  const cssDiv = item.css?.div || {};
  const fill = style.fill || {};
  const borderFill = style.borderFill || {};
  const fg = style.foreGroundFill || {};
  const explicitOpacity = parseOpacity(cssSelf.opacity ?? cssDiv.opacity ?? style.opacity);
  return {
    fill: cssDiv["background-color"] || cssSelf["background-color"] || argbToRgba(fill.color, fill.opacity ?? 1),
    border: cssDiv["border-color"] || cssSelf["border-color"] || argbToRgba(borderFill.color, borderFill.opacity ?? 1),
    color: cssSelf.color || cssDiv.color || argbToRgba(fg.color, fg.opacity ?? 1),
    opacity: explicitOpacity,
    radius: style.cornerRadius ? Number.parseFloat(style.cornerRadius) || 0 : 0,
    borderWidth: style.borderWidth ? Number.parseFloat(style.borderWidth) || 0 : 0,
    fontFamily: style.fontName || null,
    fontSize: style.fontSize || null,
    fontWeight: style.fontWeight || null,
    textAlign: style.horizontalAlignment || null,
    verticalAlign: style.verticalAlignment || null,
  };
}

function layoutOf(item) {
  const cssSelf = item.css?.self || {};
  return {
    position: item.bounds?.position || cssSelf.position || null,
    left: cssSelf.left || null,
    top: cssSelf.top || null,
    marginLeft: cssSelf["margin-left"] || null,
    marginTop: cssSelf["margin-top"] || null,
    width: cssSelf.width || null,
    height: cssSelf.height || null,
  };
}

function fixedPlacementOf(item) {
  const layout = layoutOf(item);
  return layout.position === "fixed"
    ? {
        panelId: item.id,
        left: layout.left,
        top: layout.top,
        marginLeft: layout.marginLeft,
        marginTop: layout.marginTop,
      }
    : null;
}

function itemType(item) {
  return `${item.type || ""} ${item.friendlyType || ""}`.toLowerCase();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function normalizeDescription(value) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function normalizeDataKey(value) {
  return String(value || "").trim().toLowerCase();
}

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "");
  if (typeof value === "object" && "value" in value) return String(value.value ?? "");
  return String(value);
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

function samePanel(a, b) {
  return (a.nearestDynamicPanel?.id || null) === (b.nearestDynamicPanel?.id || null);
}

function hasSvgAsset(item) {
  return item.assetRefs?.some((ref) => /\.svg$/i.test(ref));
}

function hasRasterAsset(item) {
  return item.assetRefs?.some((ref) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(ref));
}

function isTrueImageAsset(item) {
  return /imagebox|图片/.test(itemType(item)) || hasRasterAsset(item);
}

function isLocalCoordinateContainer(item) {
  return /table|表格|repeater|中继器/.test(itemType(item));
}

function isSvgVectorIconCandidate(item) {
  if (!hasSvgAsset(item) || cleanText(item.text)) return false;
  if (/checkbox|radiobutton|复选框|单选|tablecell|单元格/.test(itemType(item))) return false;
  if (!/vectorshape|shape|形状|线段|椭圆|矩形/.test(itemType(item))) return false;
  const bounds = itemBounds(item);
  return bounds.width > 0 && bounds.height > 0 && bounds.width <= 48 && bounds.height <= 48;
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function containsPoint(bounds, point) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function boundsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function verticalOverlap(a, b) {
  return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

function horizontalGap(a, b) {
  if (a.x + a.width < b.x) return b.x - (a.x + a.width);
  if (b.x + b.width < a.x) return a.x - (b.x + b.width);
  return 0;
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

function pageKeyFromHtml(html) {
  return path.basename(String(html || ""), ".html").toLowerCase();
}

function routeForHtml(html) {
  const pageKey = pageKeyFromHtml(html);
  if (!pageKey) return null;
  return pageKey === entryPageKey ? "/" : `/${pageKey}`;
}

function roleFromLinkTarget(target) {
  const pageKey = pageKeyFromHtml(target);
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

function labelFromLinkTarget(target) {
  const pageKey = pageKeyFromHtml(target);
  if (/calendar|schedule/.test(pageKey)) return "会议日程";
  if (/summary|minutes|record/.test(pageKey)) return "会议总结";
  if (/contacts|contact|address/.test(pageKey)) return "会议联系人";
  if (/transaction|billing|wallet|pay/.test(pageKey)) return "交易";
  if (/glossary|term|dictionary/.test(pageKey)) return "术语表";
  if (/setup|setting|config/.test(pageKey)) return "系统设置";
  if (/create|new/.test(pageKey)) return "创建会议";
  if (/runing|running|join|video|share-screen|screen|meeting-/.test(pageKey)) return "会议";
  return pageKey || "侧边菜单";
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

function buildLedgerMaps(ledger) {
  return {
    byId: new Map((ledger.inventory || []).filter((item) => item.id).map((item) => [item.id, item])),
    byScriptId: new Map((ledger.inventory || []).filter((item) => item.scriptId).map((item) => [item.scriptId, item])),
  };
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
  const railRight = railBounds.x + railBounds.width;
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
        bounds.x <= railRight &&
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
    const bounds = itemBounds(candidate);
    if (slots.some((slot) => Math.abs(itemBounds(slot).y - bounds.y) <= 6)) continue;
    slots.push(candidate);
  }
  return slots;
}

function interactionAncestorForItem(item, maps) {
  const ancestors = [
    ...(item.ancestorIds || []).map((id) => maps.byId.get(id)),
    ...(item.ancestorScriptIds || []).map((scriptId) => maps.byScriptId.get(scriptId)),
  ].filter(Boolean);
  return ancestors.find((ancestor) => ancestor.interactionKeys?.some((key) => /click|onClick/i.test(key))) || null;
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
  const texts = items
    .filter((item) => item.initiallyVisible !== false)
    .map((item) => normalizeDescription(item.text || item.label || ""))
    .filter(Boolean)
    .filter((text) => !/^\d{1,2}:\d{2}/.test(text))
    .sort((a, b) => b.length - a.length);
  return texts[0] || "";
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
  const linkTarget = firstLinkTargetFromInteractions(group);
  const role = roleFromLinkTarget(linkTarget) || roleFromNavText(text);
  if (!role && !text && !linkTarget) return null;

  const iconCandidate =
    visibleParts
      .filter((candidate) => isSvgVectorIconCandidate(candidate) && itemBounds(candidate).width >= 10 && itemBounds(candidate).height >= 10)
      .sort((a, b) => itemBounds(b).width * itemBounds(b).height - itemBounds(a).width * itemBounds(a).height)[0] || null;
  const label = text || (linkTarget ? labelFromLinkTarget(linkTarget) : labelFromRole(role)) || "";
  return {
    slotY: Math.round(visibleBounds.y),
    bounds: visibleBounds,
    group,
    descendants,
    iconCandidate,
    text,
    role: role || null,
    label,
    html: linkTarget || null,
    route: linkTarget ? routeForHtml(linkTarget) : null,
    executable: hasExecutableNavAction(group),
    sourceScriptIds: Array.from(new Set([group.scriptId, iconCandidate?.scriptId].filter(Boolean))),
  };
}

function sideNavEntriesFromLedger(ledger) {
  const entries = [];
  const seenGroups = new Set();
  for (const group of ledger.interactions || []) {
    if (!group.interactionKeys?.some((key) => /click|onClick/i.test(key))) continue;
    if (seenGroups.has(group.id || group.scriptId)) continue;
    const entry = sideNavEntryForInteractionGroup(group, ledger);
    if (!entry) continue;
    seenGroups.add(group.id || group.scriptId);
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
        route: html ? routeForHtml(html) : null,
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

function inferSideNavRole(item, ledger) {
  if (!isSvgVectorIconCandidate(item)) return null;
  const bounds = itemBounds(item);
  if (bounds.x > 80 || bounds.y < 40 || bounds.width < 10 || bounds.height < 10) return null;
  const rail = findSideRail(ledger);
  if (!rail) return null;
  const railBounds = itemBounds(rail);
  const slots = sideNavSlotRects(ledger, railBounds);
  const center = centerOf(bounds);
  const slotIndex = slots.findIndex((slot) => {
    const slotBounds = itemBounds(slot);
    const hitBounds = { x: railBounds.x, y: slotBounds.y - 8, width: railBounds.width, height: slotBounds.height + 16 };
    return containsPoint(hitBounds, center);
  });
  if (slotIndex < 0) return null;
  const maps = buildLedgerMaps(ledger);
  const group = interactionAncestorForItem(slots[slotIndex], maps) || interactionAncestorForItem(item, maps);
  const linkTarget = firstLinkTargetFromInteractions(group);
  const localEntry = sideNavEntryForInteractionGroup(group, ledger);
  const canonical = canonicalSideNavForY(itemBounds(slots[slotIndex]).y);
  return roleFromLinkTarget(linkTarget) || roleFromNavText(localEntry?.label) || canonical?.role || (slotIndex === 0 ? "menu" : null);
}

function roleFromText(text, iconBounds = null) {
  const value = cleanText(text).toLowerCase();
  if (!value) return null;
  if (/复制|copy/.test(value)) return "copy";
  if (/分享|share/.test(value)) return "share";
  if (/搜索|search/.test(value)) return "search";
  if (/关闭|取消|close|cancel/.test(value)) return "close";
  if (/删除|remove|delete/.test(value)) return "delete";
  if (/编辑|edit/.test(value)) return "edit";
  if (/上传|upload/.test(value)) return "upload";
  if (/下载|download/.test(value)) return "download";
  if (/设置|setting|config/.test(value)) return "setting";
  if (/日历|日期|calendar|date/.test(value)) return "calendar";
  if (/链接|地址|url|link/.test(value)) return "link";
  if (/会议|meeting|video/.test(value)) return "video";
  if (/联系人|成员|用户|参会|participant|member|user/.test(value)) return "user";
  if (/语言|语种|中文|english|cn|en|language/.test(value)) {
    return iconBounds && iconBounds.width <= 18 && iconBounds.height <= 12 ? "down" : null;
  }
  return null;
}

function roleFromActionEvidence(item) {
  for (const event of item.interactionSummary || []) {
    if (!/click|onClick/i.test(event.eventKey || "")) continue;
    for (const caseItem of event.cases || []) {
      if (caseItem.disabled) continue;
      for (const action of caseItem.actions || []) {
        const description = normalizeDescription(`${action.action || ""} ${action.description || ""}`);
        if (/hide|隐藏/i.test(description)) return "close";
        if (action.action === "linkWindow") {
          const linkRole = roleFromLinkTarget(collectHtmlTargets(action)[0]);
          if (linkRole) return linkRole;
        }
        if (/修改|编辑|edit/i.test(description)) return "edit";
        if (/复制|copy/i.test(description)) return "copy";
        if (/分享|share/i.test(description)) return "share";
        if (/上传|upload/i.test(description)) return "upload";
        if (/下载|download/i.test(description)) return "download";
        if (/搜索|search/i.test(description)) return "search";
      }
    }
  }
  return null;
}

function inferIconRole(item, ledger) {
  if (!isSvgVectorIconCandidate(item)) return null;
  const bounds = itemBounds(item);
  const center = centerOf(bounds);
  const actionRole = roleFromActionEvidence(item);
  if (actionRole) return actionRole;
  const candidates = (ledger.inventory || []).filter((candidate) => candidate !== item && samePanel(candidate, item));

  const containingText = candidates
    .filter((candidate) => cleanText(candidate.text))
    .map((candidate) => ({ candidate, bounds: itemBounds(candidate) }))
    .filter(({ bounds: candidateBounds }) => containsPoint(candidateBounds, center))
    .sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height);
  for (const { candidate } of containingText) {
    const role = roleFromText(`${candidate.label || ""} ${candidate.text || ""}`, bounds);
    if (role) return role;
  }

  const neighbors = candidates
    .filter((candidate) => cleanText(candidate.text))
    .map((candidate) => ({ candidate, bounds: itemBounds(candidate) }))
    .filter(({ bounds: candidateBounds }) => verticalOverlap(bounds, candidateBounds) > 0 && horizontalGap(bounds, candidateBounds) <= 24)
    .sort((a, b) => horizontalGap(bounds, a.bounds) - horizontalGap(bounds, b.bounds));
  for (const { candidate } of neighbors) {
    const role = roleFromText(`${candidate.label || ""} ${candidate.text || ""}`, bounds);
    if (role) return role;
    if (/^[a-z][a-z0-9_.-]{1,23}$/i.test(cleanText(candidate.text)) && bounds.width >= 20) return "user";
  }

  const pageRight = Math.max(
    1280,
    ...(ledger.mustImplement || [])
      .filter((candidate) => candidate.initiallyVisible && !candidate.nearestDynamicPanel?.id)
      .map((candidate) => {
        const candidateBounds = itemBounds(candidate);
        return candidateBounds.x + candidateBounds.width;
      }),
  );

  if (!item.nearestDynamicPanel?.id && bounds.y <= 64 && bounds.x > pageRight * 0.65) {
    const topIcons = (ledger.mustImplement || [])
      .filter((candidate) => candidate !== item && isSvgVectorIconCandidate(candidate) && !candidate.nearestDynamicPanel?.id)
      .concat([item])
      .filter((candidate) => {
        const candidateBounds = itemBounds(candidate);
        return candidateBounds.y <= 64 && candidateBounds.x > pageRight * 0.65;
      })
      .sort((a, b) => itemBounds(a).x - itemBounds(b).x);
    const topIndex = topIcons.findIndex((candidate) => candidate.id === item.id);
    if (topIndex === 0) return "bell";
    if (topIndex === 1) return "moon";
  }

  const sideNavRole = inferSideNavRole(item, ledger);
  if (sideNavRole) return sideNavRole;

  return "generic";
}

function routeFor(pageKey) {
  if (pageKey === entryPageKey) return "/";
  return `/${pageKey}`;
}

function simplifyAction(action) {
  const targets = [];
  function visit(value) {
    if (value == null) return;
    if (typeof value === "string") {
      if (/\.html(?:$|[?#])/i.test(value)) targets.push({ kind: "link", value });
      if (/^[0-9a-f]{32}$/i.test(value)) targets.push({ kind: "object", value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") Object.values(value).forEach(visit);
  }
  visit(action);
  const description = normalizeDescription(action.description || "");
  const targetStateName =
    action.action === "setPanelState"
      ? (
          description.match(/\bto\s+(?:to\s+)?(.+?)\s*$/i)?.[1] ||
          description.match(/(?:到|为)\s*(.+?)\s*$/)?.[1] ||
          null
        )
      : null;
  return {
    action: action.action || null,
    displayName: action.displayName || null,
    description: description || action.description || null,
    targetStateName: targetStateName ? targetStateName.trim() : null,
    targets,
  };
}

function simplifyInteractions(item) {
  return (item.interactionSummary || []).map((event) => ({
    eventKey: event.eventKey,
    eventType: event.eventType,
    cases: (event.cases || []).map((caseItem) => ({
      conditionString: caseItem.conditionString,
      disabled: caseItem.disabled,
      actions: (caseItem.actions || []).map(simplifyAction),
    })),
  }));
}

function isOwnControl(item) {
  return /textbox|textfield|textarea|combobox|droplist|listbox|checkbox|radiobutton|repeater|table|inlineframe|iframe|文本框|下拉框|列表|复选框|单选|中继器|表格|内联框架/.test(
    itemType(item),
  );
}

function clickInteractionsOf(item) {
  return (item?.interactionSummary || []).filter((event) => /click|onClick/i.test(event.eventKey || ""));
}

function interactionsForItem(item, maps) {
  const own = simplifyInteractions(item);
  if (own.length || isOwnControl(item)) return own;
  const ancestor = interactionAncestorForItem(item, maps);
  if (!ancestor || !clickInteractionsOf(ancestor).length) return own;
  return simplifyInteractions(ancestor);
}

function proxiedInteractionSourceScriptId(item, maps) {
  if ((item.interactionSummary || []).length || isOwnControl(item)) return null;
  const ancestor = interactionAncestorForItem(item, maps);
  return ancestor && clickInteractionsOf(ancestor).length ? ancestor.scriptId || null : null;
}

function interactionsHaveLinkTarget(interactions, linkTarget = null) {
  return interactions.some((event) =>
    (event.cases || []).some((caseItem) =>
      (caseItem.actions || []).some((action) =>
        (action.action === "linkWindow" || action.action === "linkFrame") &&
        (action.targets || []).some(
          (target) => target.kind === "link" && (!linkTarget || pageKeyFromHtml(target.value) === pageKeyFromHtml(linkTarget)),
        ),
      ),
    ),
  );
}

function linkWindowAction(linkTarget) {
  return {
    action: "linkWindow",
    displayName: "打开链接",
    description: `在 当前窗口 打开 ${pageKeyFromHtml(linkTarget)}`,
    targetStateName: null,
    targets: [{ kind: "link", value: linkTarget }],
  };
}

function ensureNavigationInteraction(interactions, linkTarget) {
  if (!linkTarget || interactionsHaveLinkTarget(interactions, linkTarget)) return interactions;
  const linkAction = linkWindowAction(linkTarget);
  const clickIndex = interactions.findIndex((event) => /click|onClick/i.test(event.eventKey || ""));
  if (clickIndex < 0) {
    return [
      ...interactions,
      {
        eventKey: "onClick",
        eventType: "OnClick",
        cases: [{ conditionString: null, disabled: false, actions: [linkAction] }],
      },
    ];
  }
  return interactions.map((event, index) => {
    if (index !== clickIndex) return event;
    const cases = event.cases?.length ? event.cases : [{ conditionString: null, disabled: false, actions: [] }];
    return {
      ...event,
      cases: cases.map((caseItem, caseIndex) =>
        caseIndex === 0 ? { ...caseItem, actions: [...(caseItem.actions || []), linkAction] } : caseItem,
      ),
    };
  });
}

function buildSharedChromeFromLedger(ledger) {
  const rail = findSideRail(ledger);
  if (!rail) return null;
  const railBounds = itemBounds(rail);
  const slots = sideNavSlotRects(ledger, railBounds);
  if (slots.length < 3) return null;

  const maps = buildLedgerMaps(ledger);
  const covered = new Set([rail.id, rail.scriptId].filter(Boolean));
  const items = slots.map((slot, index) => {
    const slotBounds = itemBounds(slot);
    const group = interactionAncestorForItem(slot, maps);
    const localEntry = sideNavEntryForInteractionGroup(group, ledger);
    const canonical = canonicalSideNavForY(slotBounds.y);
    const descendants = localEntry?.descendants || descendantsOfGroup(group, ledger);
    const iconCandidate =
      (localEntry?.iconCandidate ? [localEntry.iconCandidate] : descendants)
        .filter((candidate) => isSvgVectorIconCandidate(candidate) && itemBounds(candidate).width >= 10 && itemBounds(candidate).height >= 10)
        .sort((a, b) => itemBounds(b).width * itemBounds(b).height - itemBounds(a).width * itemBounds(a).height)[0] || null;
    const localLinkTarget = firstLinkTargetFromInteractions(group);
    const role =
      roleFromLinkTarget(localLinkTarget) ||
      roleFromNavText(localEntry?.label) ||
      canonical?.role ||
      (index === 0 ? "menu" : null);
    const inferredLinkTarget = inferredHtmlTargetForRole(role);
    const linkTarget = localLinkTarget || canonical?.html || inferredLinkTarget;
    const label =
      (localEntry?.text ? localEntry.label : null) ||
      canonical?.label ||
      localEntry?.label ||
      labelFromRole(role) ||
      (linkTarget ? labelFromLinkTarget(linkTarget) : null) ||
      `侧边菜单 ${index + 1}`;
    const itemCoveredIds = new Set([slot.id, slot.scriptId, group?.id, group?.scriptId].filter(Boolean));
    descendants.forEach((candidate) => {
      if (candidate.id) itemCoveredIds.add(candidate.id);
      if (candidate.scriptId) itemCoveredIds.add(candidate.scriptId);
    });
    itemCoveredIds.forEach((id) => id && covered.add(id));
    const simplifiedInteractions = group ? simplifyInteractions(group) : [];
    const interactions = ensureNavigationInteraction(simplifiedInteractions, linkTarget);
    return {
      key: `${role || "generic"}-${index}`,
      label,
      role: role || "generic",
      route: linkTarget ? routeForHtml(linkTarget) : null,
      html: linkTarget || null,
      bounds: {
        x: railBounds.x,
        y: Math.max(railBounds.y, slotBounds.y - 4),
        width: railBounds.width,
        height: Math.max(32, slotBounds.height + 8),
      },
      iconBounds: iconCandidate ? itemBounds(iconCandidate) : null,
      interactions,
      sourceScriptIds: Array.from(
        new Set([slot.scriptId, iconCandidate?.scriptId, group?.scriptId, ...(canonical?.sourceScriptIds || [])].filter(Boolean)),
      ),
      coveredWidgetIds: Array.from(itemCoveredIds).filter(Boolean),
      evidence: {
        slotY: slotBounds.y,
        localLabel: localEntry?.label || "",
        canonicalLabel: canonical?.label || "",
        canonicalPages: canonical?.sourcePages || [],
        resolvedFrom: localLinkTarget ? "local-linkWindow" : canonical?.html ? "canonical-menu-evidence" : linkTarget ? "role-inference" : "local-only",
        unresolved: !role && !linkTarget,
      },
    };
  }).filter((item) => item.role || item.html || item.label);

  for (const candidate of ledger.inventory || []) {
    const bounds = itemBounds(candidate);
    const inRail =
      candidate.initiallyVisible &&
      !candidate.nearestDynamicPanel?.id &&
      !cleanText(candidate.text) &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.x <= railBounds.x + railBounds.width + 8 &&
      bounds.y >= railBounds.y &&
      bounds.y <= railBounds.y + railBounds.height &&
      boundsIntersect(bounds, { ...railBounds, width: railBounds.width + 8 });
    if (inRail) {
      if (candidate.id) covered.add(candidate.id);
      if (candidate.scriptId) covered.add(candidate.scriptId);
    }
  }

  return {
    kind: "left-icon-rail",
    source:
      "Repeated Axure left rail detected by rail bounds, vertical icon slots, copied ancestor groups, and linkWindow targets.",
    railBounds,
    coveredWidgetIds: Array.from(covered).filter(Boolean),
    items,
  };
}

function widgetKind(item, iconRole) {
  const type = itemType(item);
  const input = item.html?.input;
  if (/inlineframe|内联框架|iframe/.test(type) || item.html?.iframe) return "iframe";
  if (/checkbox|复选框/.test(type)) return "checkbox";
  if (/radiobutton|单选/.test(type)) return "radio";
  if (/combobox|下拉框/.test(type) || input?.tag === "select") return "select";
  if (/textbox|文本框/.test(type) || input?.tag === "input" || input?.tag === "textarea") return "input";
  if (/dynamicpanel|动态面板/.test(type)) return "panel";
  if (/repeater|中继器/.test(type)) return "repeater";
  if (/table|表格/.test(type)) return "table";
  if (item.interactionKeys?.length && item.text) return "button";
  if (item.text) return "text";
  if (iconRole) return "icon";
  if (isTrueImageAsset(item)) return "image";
  if (item.interactionKeys?.length) return "button";
  return "shape";
}

function iframeTargetHtmlOf(item) {
  const htmlTarget = (item.linkTargets || []).find((target) => /\.html(?:$|[?#])/i.test(target));
  if (htmlTarget) return path.basename(htmlTarget);
  const src = item.html?.iframe?.src;
  return src ? path.basename(src) : null;
}

function buildPage(pageInfo) {
  const ledger = readPageLedger(pageInfo.page_key);
  const byId = new Map(ledger.inventory.map((item) => [item.id, item]));
  const byScriptId = new Map(ledger.inventory.filter((item) => item.scriptId).map((item) => [item.scriptId, item]));
  const targetIds = new Set();
  for (const item of ledger.interactions) {
    for (const event of item.interactionSummary || []) {
      for (const caseItem of event.cases || []) {
        for (const action of caseItem.actions || []) {
          for (const id of action.objectPaths || []) targetIds.add(id);
        }
      }
    }
  }

  const cleanBounds = (bounds = {}) => ({
    x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : 0,
    y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0,
    width: Number.isFinite(Number(bounds.width)) ? Number(bounds.width) : 0,
    height: Number.isFinite(Number(bounds.height)) ? Number(bounds.height) : 0,
  });

  const unionDescendantBounds = (item) => {
    if (!item.id) return null;
    const descendants = ledger.inventory
      .filter((candidate) => candidate.ancestorIds?.includes(item.id))
      .map((candidate) => cleanBounds(candidate.bounds))
      .filter((bounds) => bounds.width > 0 && bounds.height > 0);
    if (!descendants.length) return null;
    const left = Math.min(...descendants.map((bounds) => bounds.x));
    const top = Math.min(...descendants.map((bounds) => bounds.y));
    const right = Math.max(...descendants.map((bounds) => bounds.x + bounds.width));
    const bottom = Math.max(...descendants.map((bounds) => bounds.y + bounds.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  };

  const effectiveBounds = (item) => {
    const raw = cleanBounds(item?.bounds);
    return raw.width > 0 && raw.height > 0 ? raw : unionDescendantBounds(item) || raw;
  };

  const repeaterAncestorOf = (item) => {
    const ancestors = [
      ...(item.ancestorIds || []).map((id) => byId.get(id)),
      ...(item.ancestorScriptIds || []).map((scriptId) => byScriptId.get(scriptId)),
    ].filter(Boolean);
    return ancestors.reverse().find((ancestor) => /repeater|中继器/.test(itemType(ancestor))) || null;
  };

  const parseItemCondition = (conditionString) => {
    const text = normalizeDescription(conditionString || "");
    const match = text.match(/\[\[Item\.([^\]]+)\]\]\s*==\s*"([^"]*)"/i);
    if (!match) return null;
    return { key: normalizeDataKey(match[1]), value: match[2] };
  };

  const parseRepeaterUpdate = (description) => {
    const text = normalizeDescription(description || "");
    const body = text.match(/\bSet\s+(.+?)\s+for\s+/i)?.[1];
    if (!body) return null;
    const updates = {};
    for (const part of body.split(/\s*,\s*/)) {
      const match = part.match(/([A-Za-z0-9_\-\u4e00-\u9fa5]+)\s+to\s+"([^"]*)"/i);
      if (match) updates[normalizeDataKey(match[1])] = match[2];
    }
    return Object.keys(updates).length ? updates : null;
  };

  const columnActionMetadata = (target, repeaterId) => {
    const rowActions = [];
    for (const event of target?.interactionSummary || []) {
      if (!/click|onClick/i.test(event.eventKey || "")) continue;
      for (const caseItem of event.cases || []) {
        for (const action of caseItem.actions || []) {
          if (action.action !== "updateItemsInDataSet") continue;
          if (!(action.objectPaths || []).includes(repeaterId)) continue;
          const updates = parseRepeaterUpdate(action.description);
          if (!updates) continue;
          rowActions.push({
            condition: parseItemCondition(caseItem.conditionString),
            updates,
          });
        }
      }
    }
    return rowActions;
  };

  const repeaterLayoutOf = (item) => {
    const propMap = item.repeaterPropMap || {};
    const preferred = propMap[""] || propMap.default || {};
    const fallbackBounds = effectiveBounds(item);
    const itemWidth = Number.isFinite(Number(preferred.width)) ? Number(preferred.width) : fallbackBounds.width;
    const itemHeight = Number.isFinite(Number(preferred.height)) ? Number(preferred.height) : 32;
    const wrap = Number.isFinite(Number(preferred.wrap)) ? Number(preferred.wrap) : -1;
    return {
      itemWidth,
      itemHeight,
      wrap,
      vertical: preferred.vertical !== false,
      horizontalSpacing: Number.isFinite(Number(preferred.horizontalSpacing)) ? Number(preferred.horizontalSpacing) : 0,
      verticalSpacing: Number.isFinite(Number(preferred.verticalSpacing)) ? Number(preferred.verticalSpacing) : 0,
      fitToContent: Boolean(propMap.fitToContent || preferred.fitToContent),
      isolateRadio: Boolean(propMap.isolateRadio),
      isolateSelection: Boolean(propMap.isolateSelection),
    };
  };

  const repeaterColumnOf = ({ key, sourceKey, label, item, text = "", interactive = null }) => {
    const style = styleOf(item);
    return {
      key,
      sourceKey,
      label,
      scriptId: item?.scriptId || null,
      text,
      kind: widgetKind(item || {}, inferIconRole(item || {}, ledger)),
      bounds: effectiveBounds(item),
      textAlign: style.textAlign,
      verticalAlign: style.verticalAlign,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      color: style.color,
      fill: style.fill,
      border: style.border,
      radius: style.radius,
      borderWidth: style.borderWidth,
      input: item?.html?.input ?? null,
      assetRefs: (item?.assetRefs || []).map((ref) => {
        copyAsset(ref);
        return publicAssetUrl(ref);
      }),
      interactive: interactive ?? Boolean(item?.interactionKeys?.length),
      interactions: simplifyInteractions(item),
      rowActions: columnActionMetadata(item, item?.id),
    };
  };

  const repeaterDataOf = (item) => {
    if (!/repeater|中继器/.test(itemType(item))) return null;
    const rows = Array.isArray(item.data)
      ? item.data.map((row, index) => {
          const normalized = { index: String(index + 1) };
          for (const [key, value] of Object.entries(row || {})) normalized[normalizeDataKey(key)] = cellText(value);
          return normalized;
        })
      : [];
    const dataProps = (item.dataProps || []).map((prop) => normalizeDataKey(prop));
    const columnsByKey = new Map();
    for (const event of item.interactionSummary || []) {
      for (const caseItem of event.cases || []) {
        for (const action of caseItem.actions || []) {
          const match = normalizeDescription(action.description || "").match(/\[\[Item\.([^\]]+)\]\]/i);
          const targetId = action.objectPaths?.[0];
          const target = targetId ? byId.get(targetId) : null;
          if (!match || !target) continue;
          const key = normalizeDataKey(match[1]);
          if (!key) continue;
          columnsByKey.set(key, {
            ...repeaterColumnOf({
              key,
              sourceKey: match[1],
              label: target.label || match[1],
              item: target,
            }),
            rowActions: columnActionMetadata(target, item.id),
          });
        }
      }
    }
    const boundScriptIds = new Set(Array.from(columnsByKey.values()).map((column) => column.scriptId).filter(Boolean));
    const layout = repeaterLayoutOf(item);
    const templateWidgets = ledger.inventory
      .filter((candidate) => candidate.id !== item.id && repeaterAncestorOf(candidate)?.id === item.id)
      .filter((candidate) => {
        if (boundScriptIds.has(candidate.scriptId)) return false;
        const type = itemType(candidate);
        const bounds = effectiveBounds(candidate);
        const hasMeaningfulText = Boolean(cleanText(candidate.text));
        const hasMeaningfulEvent = Boolean(candidate.interactionKeys?.length);
        const isDirectControl = /checkbox|复选框|radiobutton|单选|combobox|下拉|textbox|文本框/.test(type);
        const isVisualBox =
          /vectorshape|shape|矩形|形状/.test(type) &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          (styleOf(candidate).fill || styleOf(candidate).border || styleOf(candidate).radius > 0);
        return hasMeaningfulText || hasMeaningfulEvent || isDirectControl || isVisualBox;
      });
    for (const template of templateWidgets) {
      const key = `static_${template.scriptId || template.id}`;
      columnsByKey.set(key, {
        ...repeaterColumnOf({
          key,
          sourceKey: key,
          label: template.label || template.text || key,
          item: template,
          text: template.text || "",
        }),
        rowActions: columnActionMetadata(template, item.id),
      });
    }
    const mappedDataKeys = new Set(Array.from(columnsByKey.values()).filter((column) => column.scriptId).map((column) => column.key));
    for (const prop of dataProps) {
      if (!prop || columnsByKey.has(prop)) continue;
      if (!rows.some((row) => row[prop])) continue;
      const fallbackWidth = layout.itemWidth && dataProps.length ? Math.max(60, Math.floor(layout.itemWidth / dataProps.length)) : 120;
      columnsByKey.set(prop, {
        key: prop,
        sourceKey: prop,
        label: prop,
        scriptId: null,
        text: "",
        kind: "text",
        bounds: { x: columnsByKey.size * fallbackWidth, y: 0, width: fallbackWidth, height: 32 },
        textAlign: prop === "index" ? "center" : "left",
        verticalAlign: "middle",
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
      });
    }
    const columns = Array.from(columnsByKey.values())
      .filter((column) => column.bounds.width > 0 && column.bounds.height > 0)
      .sort((a, b) => (a.bounds.y - b.bounds.y) || (a.bounds.x - b.bounds.x));
    const rowHeight = Math.max(layout.itemHeight || 0, 28, ...columns.map((column) => column.bounds.y + column.bounds.height));
    const templateWidth = Math.max(layout.itemWidth || 0, ...columns.map((column) => column.bounds.x + column.bounds.width));
    return { rows, dataProps, columns, rowHeight, templateWidth, layout };
  };

  const sharedChrome = buildSharedChromeFromLedger(ledger);
  const sharedChromeCoveredIds = new Set(sharedChrome?.coveredWidgetIds || []);
  const isCoveredBySharedChrome = (item) => {
    if (!sharedChrome) return false;
    if (sharedChromeCoveredIds.has(item.id) || sharedChromeCoveredIds.has(item.scriptId)) return true;
    const bounds = cleanBounds(item.bounds);
    const railBounds = sharedChrome.railBounds;
    return Boolean(
      item.initiallyVisible &&
        !item.nearestDynamicPanel?.id &&
        !cleanText(item.text) &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.x <= railBounds.x + railBounds.width + 8 &&
        bounds.y >= railBounds.y &&
        bounds.y <= railBounds.y + railBounds.height &&
        boundsIntersect(bounds, { ...railBounds, width: railBounds.width + 8 }),
    );
  };

  const widgets = ledger.mustImplement.map((item, index) => {
    const panel = item.nearestDynamicPanel?.id ? byId.get(item.nearestDynamicPanel.id) : null;
    const ancestorPanels = (item.ancestorIds || [])
      .map((id) => byId.get(id))
      .filter((ancestor) => ancestor && /dynamicpanel|动态面板/.test(itemType(ancestor)));
    const fixedAncestorPanel = [...ancestorPanels].reverse().find((ancestor) => fixedPlacementOf(ancestor)) || null;
    const panelFixedPlacement = fixedAncestorPanel ? fixedPlacementOf(fixedAncestorPanel) : null;
    const repeaterAncestor = repeaterAncestorOf(item);
    const rawBounds = cleanBounds(item.bounds);
    const bounds =
      item.interactionKeys?.length && (rawBounds.width === 0 || rawBounds.height === 0)
        ? unionDescendantBounds(item) || rawBounds
        : rawBounds;
    const nestedOffset = (item.ancestorScriptIds || [])
      .map((scriptId) => byScriptId.get(scriptId))
      .filter((ancestor) => ancestor && ancestor.id !== item.id && isLocalCoordinateContainer(ancestor))
      .map((ancestor) => cleanBounds(ancestor.bounds))
      .reduce(
        (offset, ancestorBounds) => ({
          x: offset.x + ancestorBounds.x,
          y: offset.y + ancestorBounds.y,
        }),
        { x: 0, y: 0 },
      );
    const x = bounds.x;
    const y = bounds.y;
    const ancestorPanelOffset = ancestorPanels
      .map((ancestor) => cleanBounds(ancestor.bounds))
      .reduce(
        (offset, ancestorBounds) => ({
          x: offset.x + ancestorBounds.x,
          y: offset.y + ancestorBounds.y,
        }),
        { x: 0, y: 0 },
      );
    const fixedAncestorIndex = fixedAncestorPanel
      ? ancestorPanels.findIndex((ancestor) => ancestor.id === fixedAncestorPanel.id)
      : -1;
    const fixedDescendantPanelOffset =
      fixedAncestorIndex >= 0
        ? ancestorPanels
            .slice(fixedAncestorIndex + 1)
            .map((ancestor) => cleanBounds(ancestor.bounds))
            .reduce(
              (offset, ancestorBounds) => ({
                x: offset.x + ancestorBounds.x,
                y: offset.y + ancestorBounds.y,
              }),
              { x: 0, y: 0 },
            )
        : { x: 0, y: 0 };
    const fixedOffset =
      panelFixedPlacement && fixedAncestorPanel?.id !== item.id
        ? {
            x: fixedDescendantPanelOffset.x + nestedOffset.x + x,
            y: fixedDescendantPanelOffset.y + nestedOffset.y + y,
          }
        : null;
    const absoluteBounds = {
      x: ancestorPanelOffset.x + nestedOffset.x + x,
      y: ancestorPanelOffset.y + nestedOffset.y + y,
      width: bounds.width,
      height: bounds.height,
    };
    const assetRefs = (item.assetRefs || []).map((ref) => {
      copyAsset(ref);
      return publicAssetUrl(ref);
    });
    const iconRole = inferIconRole(item, ledger);
    const hiddenAncestorPanelIds = ancestorPanels
      .filter((ancestor) => !ancestor.initiallyVisible || ancestor.htmlHidden)
      .map((ancestor) => ancestor.id)
      .filter(Boolean);
    return {
      id: item.id || item.scriptId || `${pageInfo.page_key}-anon-${index}`,
      scriptId: item.scriptId || item.id || `anon-${index}`,
      ancestorScriptIds: item.ancestorScriptIds || [],
      type: item.type,
      friendlyType: item.friendlyType,
      kind: widgetKind(item, iconRole),
      iconRole,
      label: item.label,
      text: item.text,
      bounds,
      absoluteBounds,
      layout: layoutOf(item),
      fixedAncestor: panelFixedPlacement,
      fixedOffset,
      initiallyVisible: item.initiallyVisible,
      htmlHidden: item.htmlHidden,
      hiddenInteractionTarget: item.hiddenInteractionTarget,
      proxiedInteractionSourceScriptId: proxiedInteractionSourceScriptId(item, { byId, byScriptId }),
      targetPanelId: panel?.id ?? null,
      targetPanelScriptId: panel?.scriptId ?? null,
      hiddenAncestorPanelIds,
      coveredBySharedChrome: isCoveredBySharedChrome(item),
      coveredByRepeaterId: repeaterAncestor && repeaterAncestor.id !== item.id ? repeaterAncestor.id : null,
      panelStateId: item.panelState?.id ?? item.nearestPanelState?.id ?? null,
      panelStateLabel: item.panelState?.label ?? item.nearestPanelState?.label ?? null,
      panelStateIndex: item.panelState?.panelIndex ?? item.nearestPanelState?.panelIndex ?? null,
      panelStateIsDefault: item.panelState?.isDefault ?? item.nearestPanelState?.isDefault ?? null,
      isInteractionTarget: targetIds.has(item.id),
      assetRefs,
      input: item.html?.input ?? null,
      options: item.html?.options ?? [],
      style: styleOf(item),
      interactions: interactionsForItem(item, { byId, byScriptId }),
      repeater: repeaterDataOf(item),
      frameTargetHtml: iframeTargetHtmlOf(item),
      data: item.data ?? null,
    };
  });

  const maxX = Math.max(1280, ...widgets.filter((w) => w.initiallyVisible).map((w) => w.absoluteBounds.x + w.absoluteBounds.width));
  const maxY = Math.max(720, ...widgets.filter((w) => w.initiallyVisible).map((w) => w.absoluteBounds.y + w.absoluteBounds.height));
  return {
    pageKey: pageInfo.page_key,
    html: pageInfo.html,
    route: routeFor(pageInfo.page_key),
    title: ledger.pageName,
    canvas: { width: Math.ceil(maxX), height: Math.ceil(maxY) },
    counts: ledger.counts,
    sharedChrome,
    widgets,
  };
}

ensureDir(publicAssetsRoot);
ensureDir(srcDataDir);

const pages = analysis.pages.map(buildPage);
const routeMap = pages.map((page) => ({ pageKey: page.pageKey, route: page.route, html: page.html, title: page.title }));

const output = `/* Generated from Axure ledgers by scripts/build-axure-data.mjs. */\n` +
  `import type { AxurePageData } from "../types/axure";\n\n` +
  `export const routeMap = ${JSON.stringify(routeMap, null, 2)} as const;\n\n` +
  `export const axurePages: AxurePageData[] = ${JSON.stringify(pages, null, 2)};\n`;

fs.writeFileSync(path.join(srcDataDir, "axurePages.ts"), output, "utf8");
console.table(pages.map((page) => ({
  page: page.pageKey,
  route: page.route,
  widgets: page.widgets.length,
  width: page.canvas.width,
  height: page.canvas.height,
})));

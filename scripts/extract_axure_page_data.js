#!/usr/bin/env node
/* Extract a structured inventory from an Axure page data.js file. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function usage() {
  console.error("Usage: node extract_axure_page_data.js <axure-export-dir> <page-key> [--out output.json]");
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 2) usage();

const exportDir = path.resolve(args[0]);
const pageKey = args[1];
let outPath = null;
for (let i = 2; i < args.length; i += 1) {
  if (args[i] === "--out") {
    outPath = args[i + 1] ? path.resolve(args[i + 1]) : null;
    i += 1;
  }
}

const dataPath = path.join(exportDir, "files", pageKey, "data.js");
if (!fs.existsSync(dataPath)) {
  console.error(`Missing Axure page data file: ${dataPath}`);
  process.exit(1);
}
const stylesPath = path.join(exportDir, "files", pageKey, "styles.css");
const htmlPath = path.join(exportDir, `${pageKey}.html`);

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

let capturedPage = null;
const sandbox = {
  $axure: {
    loadCurrentPage(value) {
      capturedPage = value;
    },
  },
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataPath, "utf8"), sandbox, {
  filename: dataPath,
  timeout: 10000,
});

if (!capturedPage) {
  console.error(`No page object captured from ${dataPath}`);
  process.exit(1);
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

function textFromHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttrs(value) {
  const attrs = {};
  const attrRe = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = attrRe.exec(value || ""))) {
    attrs[match[1]] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function parseCssDeclarations(block) {
  const props = {};
  for (const part of String(block || "").split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) props[key] = value;
  }
  return props;
}

function parseCss(cssText) {
  const out = {};
  const ruleRe = /#([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(cssText || ""))) {
    const fullId = match[1];
    const baseMatch = fullId.match(/^(u\d+)/);
    const baseId = baseMatch ? baseMatch[1] : fullId;
    let part = fullId === baseId ? "self" : fullId.slice(baseId.length).replace(/^_/, "");
    if (!part) part = "self";
    if (!out[baseId]) out[baseId] = {};
    out[baseId][part] = parseCssDeclarations(match[2]);
  }
  return out;
}

function parseHtml(htmlText) {
  const byScriptId = {};
  const ensure = (scriptId) => {
    if (!byScriptId[scriptId]) {
      byScriptId[scriptId] = {
        attrs: {},
        dataLabel: null,
        hidden: false,
        text: "",
        input: null,
        iframe: null,
        options: [],
        imageSrc: null,
      };
    }
    return byScriptId[scriptId];
  };

  let match;
  const divOpenRe = /<div\s+id="(u\d+)"([^>]*)>/g;
  while ((match = divOpenRe.exec(htmlText || ""))) {
    const entry = ensure(match[1]);
    const attrs = parseAttrs(match[2]);
    entry.attrs = attrs;
    entry.dataLabel = attrs["data-label"] || null;
    const signature = `${attrs.class || ""} ${attrs.style || ""}`;
    entry.hidden = /ax_default_hidden/.test(signature) || /display\s*:\s*none/i.test(signature) || /visibility\s*:\s*hidden/i.test(signature);
  }

  const textRe = /<div\s+id="(u\d+)_text"[^>]*>([\s\S]*?)<\/div>/g;
  while ((match = textRe.exec(htmlText || ""))) {
    const entry = ensure(match[1]);
    entry.text = textFromHtml(match[2]);
  }

  const inputRe = /<(input|textarea)\s+([^>]*id="(u\d+)_input"[^>]*)>/g;
  while ((match = inputRe.exec(htmlText || ""))) {
    const entry = ensure(match[3]);
    const attrs = parseAttrs(match[2]);
    entry.input = {
      tag: match[1].toLowerCase(),
      type: attrs.type || "text",
      name: attrs.name || "",
      groupName: attrs.name || "",
      value: attrs.value || "",
      placeholder: attrs.placeholder || "",
      checked: Object.prototype.hasOwnProperty.call(attrs, "checked"),
      disabled: Object.prototype.hasOwnProperty.call(attrs, "disabled"),
    };
  }

  const selectRe = /<select\s+([^>]*id="(u\d+)_input"[^>]*)>([\s\S]*?)<\/select>/g;
  while ((match = selectRe.exec(htmlText || ""))) {
    const entry = ensure(match[2]);
    const attrs = parseAttrs(match[1]);
    entry.input = {
      tag: "select",
      type: "select",
      name: attrs.name || "",
      groupName: attrs.name || "",
      value: attrs.value || "",
      placeholder: "",
      checked: false,
      disabled: Object.prototype.hasOwnProperty.call(attrs, "disabled"),
    };
    entry.options = Array.from(match[3].matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/g)).map((optionMatch) => {
      const optionAttrs = parseAttrs(optionMatch[1]);
      return {
        value: optionAttrs.value || textFromHtml(optionMatch[2]),
        text: textFromHtml(optionMatch[2]),
        selected: Object.prototype.hasOwnProperty.call(optionAttrs, "selected"),
      };
    });
  }

  const iframeRe = /<iframe\s+([^>]*id="(u\d+)_input"[^>]*)><\/iframe>/g;
  while ((match = iframeRe.exec(htmlText || ""))) {
    const entry = ensure(match[2]);
    const attrs = parseAttrs(match[1]);
    entry.iframe = {
      src: attrs.src || null,
      dataLabel: attrs["data-label"] || null,
      scrolling: attrs.scrolling || null,
      frameborder: attrs.frameborder || null,
    };
  }

  const imgRe = /<img\s+([^>]*id="(u\d+)_img"[^>]*)>/g;
  while ((match = imgRe.exec(htmlText || ""))) {
    const entry = ensure(match[2]);
    const attrs = parseAttrs(match[1]);
    entry.imageSrc = attrs.src || null;
  }

  return byScriptId;
}

function collectStrings(value, out = []) {
  if (value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
    return out;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }
  return out;
}

function plainText(value) {
  const pieces = [];

  function visit(node) {
    if (node == null) return;
    if (typeof node === "string") {
      pieces.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object") return;

    if (typeof node.text === "string") pieces.push(node.text);
    if (typeof node.html === "string") pieces.push(node.html.replace(/<[^>]*>/g, " "));
    if (typeof node.plainText === "string") pieces.push(node.plainText);
    for (const key of ["objects", "objs", "children", "components", "paragraphs", "runs", "style", "richTextPanel", "richText", "textFlow", "paragraph", "content"]) {
      if (node[key]) visit(node[key]);
    }
  }

  visit(value);
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

function summarizeInteractionMap(interactionMap) {
  if (!interactionMap) return [];
  return Object.entries(interactionMap).map(([eventKey, eventValue]) => {
    const cases = Array.isArray(eventValue.cases) ? eventValue.cases : [];
    return {
      eventKey,
      eventType: eventValue.eventType || null,
      description: eventValue.description || null,
      cases: cases.map((caseItem) => ({
        conditionString: caseItem.conditionString || null,
        disabled: Boolean(caseItem.disabled),
        actions: (caseItem.actions || []).map((actionItem) => ({
          action: actionItem.action || null,
          displayName: actionItem.displayName || null,
          description: actionItem.description || null,
          linkTargets: collectStrings(actionItem).filter((value) => /\.html(?:$|[?#])/i.test(value)),
          objectPaths: collectStrings(actionItem).filter((value) => /^[0-9a-f]{32}$/i.test(value)),
        })),
      })),
    };
  });
}

function collectAssetRefs(node, htmlEntry, cssEntry) {
  const refs = [];
  if (node && node.style && node.style.image && node.style.image.path) {
    refs.push(node.style.image.path);
  }
  if (node && node.images) {
    collectStrings(node.images, refs);
  }
  if (htmlEntry && htmlEntry.imageSrc) refs.push(htmlEntry.imageSrc);
  if (cssEntry) {
    for (const part of Object.values(cssEntry)) {
      for (const value of Object.values(part || {})) {
        for (const match of String(value).matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          refs.push(match[1]);
        }
      }
    }
  }
  return Array.from(new Set(refs.filter((value) => /\.(svg|png|jpe?g|gif|webp|ico|bmp)$/i.test(value))));
}

function cssBounds(cssEntry, node) {
  const self = cssEntry && cssEntry.self ? cssEntry.self : {};
  const style = node && node.style ? node.style : {};
  const location = style.location || {};
  const size = style.size || {};
  const numberFromPx = (value) => {
    if (value == null || value === "") return null;
    const parsed = Number(String(value).replace("px", ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    x: numberFromPx(self.left) ?? location.x ?? null,
    y: numberFromPx(self.top) ?? location.y ?? null,
    width: numberFromPx(self.width) ?? size.width ?? null,
    height: numberFromPx(self.height) ?? size.height ?? null,
    display: self.display || null,
    visibility: self.visibility || null,
    position: self.position || null,
  };
}

const cssByScriptId = parseCss(readIfExists(stylesPath));
const htmlByScriptId = parseHtml(readIfExists(htmlPath));
const objectPaths = capturedPage.objectPaths || {};

function collectInteractionTargetIds(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  if (node.interactionMap) {
    for (const value of collectStrings(node.interactionMap)) {
      if (/^[0-9a-f]{32}$/i.test(value) && objectPaths[value]) out.add(value);
    }
  }
  for (const key of ["objects", "objs", "diagrams"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) collectInteractionTargetIds(child, out);
    }
  }
  return out;
}

const root = capturedPage.page && capturedPage.page.diagram ? capturedPage.page.diagram : capturedPage;
const interactionTargetIds = collectInteractionTargetIds(root);

function isDynamicPanelNode(node) {
  return node && node.type === "dynamicPanel";
}

function defaultPanelStateIndex(node) {
  const max = Array.isArray(node.diagrams) ? node.diagrams.length : 0;
  const candidates = [
    node.currentPanelStateIndex,
    node.currentPanelIndex,
    node.defaultPanelStateIndex,
    node.defaultStateIndex,
    node.selectedIndex,
    node.panelIndex,
  ];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < max) return parsed;
  }
  return 0;
}

function walk(
  node,
  ancestors = [],
  out = [],
  inheritedHidden = false,
  inheritedInteractionTarget = false,
  inheritedPanelStateContent = false,
  currentPanelStateIndex = null,
  currentPanelStateIsDefault = null,
) {
  if (!node || typeof node !== "object") return out;

  const nearestPanelState = [...ancestors].reverse().find((item) => item.type === "Axure:PanelDiagram");
  const nearestDynamicPanel = [...ancestors].reverse().find((item) => item.type === "dynamicPanel");
  const currentPanelState = node.type === "Axure:PanelDiagram" ? node : nearestPanelState;
  const scriptId = node.scriptId || (node.id && objectPaths[node.id] ? objectPaths[node.id].scriptId : null);
  const htmlEntry = scriptId ? htmlByScriptId[scriptId] : null;
  const cssEntry = scriptId ? cssByScriptId[scriptId] : null;
  const htmlHidden = Boolean(htmlEntry && htmlEntry.hidden);
  const selfVisible = node.visible !== false && !htmlHidden;
  const initiallyVisible = selfVisible && !inheritedHidden;
  const interactionSummary = summarizeInteractionMap(node.interactionMap);
  const linkTargets = Array.from(new Set(collectStrings(node).filter((value) => /\.html(?:$|[?#])/i.test(value))));
  const htmlText = htmlEntry && htmlEntry.text ? htmlEntry.text : "";
  const extractedText = htmlText || plainText(node);
  const assetRefs = collectAssetRefs(node, htmlEntry, cssEntry);
  const isControl = /textBox|comboBox|checkbox|radioButton|repeater|table|dynamicPanel|button/i.test(`${node.type || ""} ${node.friendlyType || ""}`);
  const isInteractive = interactionSummary.length > 0;
  const isInteractionTarget = Boolean(node.id && interactionTargetIds.has(node.id));
  const inInteractionTargetSubtree = inheritedInteractionTarget || isInteractionTarget;
  const hiddenPanelStateContent = inheritedPanelStateContent && !initiallyVisible;

  out.push({
    id: node.id || null,
    scriptId,
    parentId: ancestors.length ? ancestors[ancestors.length - 1].id || null : null,
    parentScriptId: ancestors.length
      ? (ancestors[ancestors.length - 1].scriptId ||
        (ancestors[ancestors.length - 1].id && objectPaths[ancestors[ancestors.length - 1].id]
          ? objectPaths[ancestors[ancestors.length - 1].id].scriptId
          : null))
      : null,
    ancestorIds: ancestors.map((item) => item.id).filter(Boolean),
    ancestorScriptIds: ancestors
      .map((item) => item.scriptId || (item.id && objectPaths[item.id] ? objectPaths[item.id].scriptId : null))
      .filter(Boolean),
    label: node.label || null,
    friendlyType: node.friendlyType || null,
    type: node.type || null,
    visible: node.visible !== false,
    htmlHidden,
    initiallyVisible,
    isContained: Boolean(node.isContained),
    parentDynamicPanel: node.parentDynamicPanel || null,
    panelIndex: node.panelIndex ?? null,
    panelState: currentPanelState ? {
      id: currentPanelState.id || null,
      label: currentPanelState.label || null,
      panelIndex: currentPanelStateIndex ?? currentPanelState.panelIndex ?? node.panelIndex ?? null,
      isDefault: currentPanelStateIsDefault,
    } : null,
    nearestPanelState: nearestPanelState ? {
      id: nearestPanelState.id || null,
      label: nearestPanelState.label || null,
      panelIndex: currentPanelStateIndex ?? nearestPanelState.panelIndex ?? node.panelIndex ?? null,
      isDefault: currentPanelStateIsDefault,
    } : null,
    nearestDynamicPanel: nearestDynamicPanel ? {
      id: nearestDynamicPanel.id || null,
      label: nearestDynamicPanel.label || null,
    } : null,
    location: node.style && node.style.location ? node.style.location : null,
    size: node.style && node.style.size ? node.style.size : null,
    bounds: cssBounds(cssEntry, node),
    css: cssEntry || null,
    html: htmlEntry || null,
    linkTargets,
    style: node.style || null,
    text: extractedText,
    images: node.images || null,
    assetRefs,
    interactionMap: node.interactionMap || null,
    interactionSummary,
    interactionKeys: node.interactionMap ? Object.keys(node.interactionMap) : [],
    hiddenInteractionTarget: (inInteractionTargetSubtree || hiddenPanelStateContent) && !initiallyVisible,
    mustImplement: initiallyVisible || inInteractionTargetSubtree || inheritedPanelStateContent || isControl || isInteractive || assetRefs.length > 0,
    data: node.data || null,
    dataProps: node.dataProps || null,
    repeaterPropMap: node.repeaterPropMap || null,
    path: ancestors
      .map((item) => item.label || item.friendlyType || item.type || item.id)
      .filter(Boolean),
  });

  for (const key of ["objects", "objs", "diagrams"]) {
    if (Array.isArray(node[key])) {
      if (key === "diagrams" && isDynamicPanelNode(node)) {
        const defaultIndex = defaultPanelStateIndex(node);
        node[key].forEach((child, index) => {
          const inactivePanelState = index !== defaultIndex;
          walk(
            child,
            ancestors.concat(node),
            out,
            inheritedHidden || !selfVisible || inactivePanelState,
            inInteractionTargetSubtree,
            inheritedPanelStateContent || inactivePanelState,
            index,
            !inactivePanelState,
          );
        });
      } else {
        for (const child of node[key]) {
          walk(
            child,
            ancestors.concat(node),
            out,
            inheritedHidden || !selfVisible,
            inInteractionTargetSubtree,
            inheritedPanelStateContent,
            currentPanelStateIndex,
            currentPanelStateIsDefault,
          );
        }
      }
    }
  }

  return out;
}

const inventory = walk(root);
const controls = inventory.filter((item) => {
  const signature = `${item.type || ""} ${item.friendlyType || ""}`;
  return /textBox|comboBox|checkbox|radioButton|repeater|table|dynamicPanel|button/i.test(signature) ||
    item.interactionKeys.length > 0;
});
const interactions = inventory.filter((item) => item.interactionKeys.length > 0);
const textNodes = inventory.filter((item) => item.text);
const initiallyVisible = inventory.filter((item) => item.initiallyVisible);
const assets = inventory.filter((item) => item.assetRefs.length > 0);
const mustImplement = inventory.filter((item) => item.mustImplement);

const byType = {};
for (const item of inventory) {
  const key = item.friendlyType || item.type || "unknown";
  byType[key] = (byType[key] || 0) + 1;
}
const initiallyVisibleByType = {};
for (const item of initiallyVisible) {
  const key = item.friendlyType || item.type || "unknown";
  initiallyVisibleByType[key] = (initiallyVisibleByType[key] || 0) + 1;
}

const result = {
  source: {
    exportDir,
    pageKey,
    dataPath,
    stylesPath,
    htmlPath,
  },
  pageName: capturedPage.page && capturedPage.page.name ? capturedPage.page.name : pageKey,
  counts: {
    all: inventory.length,
    visible: inventory.filter((item) => item.visible).length,
    initiallyVisible: initiallyVisible.length,
    htmlHidden: inventory.filter((item) => item.htmlHidden).length,
    controls: controls.length,
    interactions: interactions.length,
    textNodes: textNodes.length,
    assets: assets.length,
    mustImplement: mustImplement.length,
    hiddenInteractionTargets: inventory.filter((item) => item.hiddenInteractionTarget).length,
  },
  byType,
  initiallyVisibleByType,
  textNodes,
  initiallyVisible,
  assets,
  mustImplement,
  controls,
  interactions,
  inventory,
};

const json = JSON.stringify(result, null, 2);
if (outPath) {
  fs.writeFileSync(outPath, json, "utf8");
} else {
  console.log(json);
}

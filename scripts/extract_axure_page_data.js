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
    for (const key of ["objects", "objs", "children", "components", "paragraphs", "runs", "style", "richTextPanel"]) {
      if (node[key]) visit(node[key]);
    }
  }

  visit(value);
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

function walk(node, ancestors = [], out = []) {
  if (!node || typeof node !== "object") return out;

  const nearestPanelState = [...ancestors].reverse().find((item) => item.type === "Axure:PanelDiagram");
  const nearestDynamicPanel = [...ancestors].reverse().find((item) => item.type === "dynamicPanel");

  out.push({
    id: node.id || null,
    scriptId: node.scriptId || null,
    label: node.label || null,
    friendlyType: node.friendlyType || null,
    type: node.type || null,
    visible: node.visible !== false,
    isContained: Boolean(node.isContained),
    parentDynamicPanel: node.parentDynamicPanel || null,
    panelIndex: node.panelIndex ?? null,
    nearestPanelState: nearestPanelState ? {
      id: nearestPanelState.id || null,
      label: nearestPanelState.label || null,
      panelIndex: nearestPanelState.panelIndex ?? null,
    } : null,
    nearestDynamicPanel: nearestDynamicPanel ? {
      id: nearestDynamicPanel.id || null,
      label: nearestDynamicPanel.label || null,
    } : null,
    location: node.style && node.style.location ? node.style.location : null,
    size: node.style && node.style.size ? node.style.size : null,
    style: node.style || null,
    text: plainText(node),
    images: node.images || null,
    interactionMap: node.interactionMap || null,
    interactionKeys: node.interactionMap ? Object.keys(node.interactionMap) : [],
    data: node.data || null,
    dataProps: node.dataProps || null,
    path: ancestors
      .map((item) => item.label || item.friendlyType || item.type || item.id)
      .filter(Boolean),
  });

  for (const key of ["objects", "objs", "diagrams"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) walk(child, ancestors.concat(node), out);
    }
  }

  return out;
}

const root = capturedPage.page && capturedPage.page.diagram ? capturedPage.page.diagram : capturedPage;
const inventory = walk(root);
const controls = inventory.filter((item) => {
  const signature = `${item.type || ""} ${item.friendlyType || ""}`;
  return /textBox|comboBox|checkbox|radioButton|repeater|table|dynamicPanel|button/i.test(signature) ||
    item.interactionKeys.length > 0;
});
const interactions = inventory.filter((item) => item.interactionKeys.length > 0);
const textNodes = inventory.filter((item) => item.visible && item.text);

const byType = {};
for (const item of inventory) {
  const key = item.friendlyType || item.type || "unknown";
  byType[key] = (byType[key] || 0) + 1;
}

const result = {
  source: {
    exportDir,
    pageKey,
    dataPath,
  },
  pageName: capturedPage.page && capturedPage.page.name ? capturedPage.page.name : pageKey,
  counts: {
    all: inventory.length,
    visible: inventory.filter((item) => item.visible).length,
    controls: controls.length,
    interactions: interactions.length,
    textNodes: textNodes.length,
  },
  byType,
  textNodes,
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

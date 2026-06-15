#!/usr/bin/env python3
"""Inspect an Axure 11 HTML export and emit conversion clues as JSON."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


IGNORE_HTML = {"start.html", "start_c_1.html", "start_with_pages.html", "index.html"}
FEATURE_PATTERNS = {
    "events": r"interactionMap|eventType|OnClick|OnLoad|OnMouseEnter|OnMouseOut|OnSelectedChange|OnTextChange|OnItemLoad|OnDrag|OnSwipe",
    "conditions": r"cases|conditionString|isNewIfGroup|exprType|subExprs|functionName|booleanLiteral|stringLiteral|pathLiteral",
    "variables_state": r"globalVariables|OnLoadVariable|setVariable|SetGlobalVariableValue|setFunction|selected|focused|enabled|visible",
    "navigation": r"linkWindow|targetType|linkType",
    "dynamic_panel": r"dynamicPanel|setPanelState|panelsToStates|stateNumber|stateValue",
    "repeater": r"repeater|onBeforeItemLoad|repeaterPropMap|\[\[Item\.",
    "table": r"\btable\b|tableCell",
    "inline_frame": r"inlineFrame|iframe",
    "visibility_modal": r"fadeWidget|lightbox|bringToFront|objectsToFades",
    "form": r"textBox|comboBox|checkbox|radioButton|SetCheckState|SetWidgetRichText",
    "motion_timing": r"moveWidget|rotateWidget|sizeWidget|scrollToWidget|duration|durationHide|easing|waitTime",
    "style_states": r"stateStyles|mouseOver|mouseDown|selectedDisabled|disabled|hint|focused",
    "adaptive": r"adaptiveViews|adaptiveStyles|viewOverride|sketchFactor",
    "advanced_actions": r"addFilter|removeFilter|addSort|removeSort|setCurrentPage|setItemsPerPage|addRows|updateRows|deleteRows|markRows|unmarkRows|fireEvent|raiseEvent|setAdaptiveView|applyStyle|setOpacity|setImage",
}


def read_text(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "gb18030", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(errors="replace")


def find_html_strings(text: str) -> list[str]:
    values = re.findall(r'"([^"]+?\.html)"', text)
    seen = set()
    result = []
    for value in values:
        name = Path(value).name
        if name in seen:
            continue
        seen.add(name)
        result.append(name)
    return result


def count_patterns(text: str) -> dict[str, int]:
    counts = {}
    for feature, pattern in FEATURE_PATTERNS.items():
        counts[feature] = len(re.findall(pattern, text, flags=re.IGNORECASE))
    return counts


def extract_link_targets(text: str) -> list[str]:
    targets = []
    for value in find_html_strings(text):
        if value.lower() not in IGNORE_HTML:
            targets.append(value)
    return sorted(set(targets))


def page_name_from_html(html_name: str) -> str:
    return Path(html_name).stem


def inspect(root: Path) -> dict:
    root = root.resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Not a directory: {root}")

    document_js = root / "data" / "document.js"
    document_text = read_text(document_js) if document_js.exists() else ""

    root_html = sorted(p.name for p in root.glob("*.html"))
    ignored_html = [name for name in root_html if name.lower() in IGNORE_HTML or name.lower().startswith("start")]
    html_candidates = [name for name in root_html if name not in ignored_html]

    sitemap_urls = [
        name for name in find_html_strings(document_text)
        if name.lower() not in IGNORE_HTML and not name.lower().startswith("start")
    ]

    if sitemap_urls:
        page_html = sitemap_urls
    else:
        page_html = html_candidates

    pages = []
    aggregate_features: Counter[str] = Counter()
    all_links: dict[str, list[str]] = {}

    for html_name in page_html:
        page_key = page_name_from_html(html_name)
        data_file = root / "files" / page_key / "data.js"
        styles_file = root / "files" / page_key / "styles.css"
        images_dir = root / "images" / page_key

        data_text = read_text(data_file) if data_file.exists() else ""
        feature_counts = count_patterns(data_text)
        aggregate_features.update(feature_counts)
        link_targets = extract_link_targets(data_text)
        all_links[html_name] = link_targets

        image_counts = Counter(p.suffix.lower() or "<none>" for p in images_dir.glob("*") if p.is_file()) if images_dir.exists() else Counter()

        pages.append({
            "html": html_name,
            "page_key": page_key,
            "root_html_exists": (root / html_name).exists(),
            "data_js": str(data_file.relative_to(root)) if data_file.exists() else None,
            "styles_css": str(styles_file.relative_to(root)) if styles_file.exists() else None,
            "image_counts": dict(sorted(image_counts.items())),
            "feature_counts": feature_counts,
            "link_targets": link_targets,
        })

    files_dirs = sorted(p.name for p in (root / "files").glob("*") if p.is_dir()) if (root / "files").exists() else []
    orphan_file_dirs = sorted(set(files_dirs) - {page_name_from_html(name) for name in page_html})

    return {
        "root": str(root),
        "document_js": str(document_js.relative_to(root)) if document_js.exists() else None,
        "root_html": root_html,
        "ignored_html": ignored_html,
        "page_html": page_html,
        "orphan_file_dirs": orphan_file_dirs,
        "pages": pages,
        "aggregate_feature_counts": dict(sorted(aggregate_features.items())),
        "page_links": all_links,
        "notes": [
            "Treat index.html as generated unless the sitemap or user confirms it is a real page.",
            "Keyword counts are clues; inspect data.js and rendered pages before implementing important interactions.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect an Axure 11 exported prototype directory.")
    parser.add_argument("export_dir", help="Path to the Axure export directory")
    parser.add_argument("--out", help="Write JSON to this file instead of stdout")
    args = parser.parse_args()

    result = inspect(Path(args.export_dir))
    payload = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()

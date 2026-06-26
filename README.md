# axure-to-frontend

`axure-to-frontend` is a Codex skill for analyzing Axure RP 11 HTML exports and orchestrating faithful frontend restoration into typed React/Vue projects.

This repository contains only the skill package. It does not include Axure prototype files, generated frontend projects, or business application code.

## 中文说明

### 设计定位

这个 skill 首先扮演 **Axure 专家**，其次才是前端还原编排者。

它的核心任务不是直接“一口气生成页面”，而是理解 Axure 的原型表达方式，先做正确判断，再组织后续还原任务：

- Axure 页面可能只是同一个产品页面的不同状态，不一定都是独立路由。
- Axure 的 label、矩形、图片、组合可能承担按钮、菜单项、上传触发器、工具栏项等语义。
- 动态面板可能是普通区域，也可能是弹窗、抽屉、浮层、确认框或隐藏交互结果。
- 中继器可能是表格、列表、卡片或选项集合，必须同时解析数据和模板控件。
- Axure 元件和真实前端框架组件不是一一对应关系。

因此，本 skill 的职责是：与用户确认选择，解析 Axure 代码/样式/数据，建立证据模型，拆解任务，定义验收标准，再借助 superpowers 风格的执行流程逐项实现和验证。

### 三阶段核心思路

1. **用户交互与选择**
   - 确认 Axure 导出目录、入口页、技术栈、原型类型、输出目录。
   - 分析后再确认还原范围、路由策略、状态合并策略、还原深度、响应式目标、数据处理方式和实现顺序。

2. **Axure 专家分析与任务生成**
   - 执行 `files/<page>/data.js`，捕获 `$axure.loadCurrentPage` 的真实对象图。
   - 递归抽取页面、控件、动态面板、中继器、表格、交互事件、隐藏状态和页面跳转。
   - 同时读取 `styles.css`、HTML、图片资源和渲染结果。
   - 生成代码结构、布局、样式、数据、组件映射和交互映射 ledgers。
   - 基于 ledgers 拆成尽可能细的任务列表，每个任务都有证据、范围、依赖和验收标准。

3. **借助 superpowers 执行还原**
   - 用任务驱动方式还原，而不是一次性长上下文生成。
   - 先共享外壳和路由，再还原页面可见状态，再还原隐藏面板和交互，最后处理跨页流程。
   - 每完成一个任务就构建、截图、点击验证或记录偏差。

### 还原优先级

还原时按以下顺序处理，不能为了后面的语义推断牺牲前面的证据：

1. **数据优先**：原型里是什么文字、默认值、表格数据、按钮文案、URL、日期、密码，就还原什么，不生成新数据。
2. **布局其次**：保留区域、列、行、层级、对齐、密度、滚动模型和状态作用域。
3. **组件第三**：能直接映射的 Axure 控件直接映射；复杂组合必须先基于事件、邻近控件、样式和渲染结果推断。
4. **交互第四**：根据 Axure 事件代码恢复 show/hide、set panel state、复制、弹窗、行操作、跳转等行为。
5. **跨页流程最后**：当前页面的可见状态、组件和内部交互稳定后，再做全局路由和产品流程。

### 关键注意事项

- 不要靠肉眼在压缩后的 `data.js` 中猜结构。
- 不要只根据截图还原；必须结合代码、样式、数据和浏览器渲染。
- 不要把隐藏动态面板的子控件泄漏到父页面布局中。
- 不要把 Axure 的 show/hide 面板误判成页面跳转。
- 不要用站点地图或产品常识改写当前页面的菜单文字。
- 不要把 `textBox` 还原为静态标签。
- 不要给复选框、单选框、输入框等组件添加原型中不存在的额外边框或容器。
- 不要让组件库默认样式覆盖原型证据，例如按钮文字自动插空格、复选框颜色、日期图标、表格列宽等。
- 对不确定的组合控件，优先忠实重建子元素，而不是强行映射成错误的高级组件。

### 避免 skill 过大

主 `SKILL.md` 必须保持为紧凑入口，只描述角色、阶段、门禁、核心原则和必需产物。

详细内容应分散到：

- `references/`：Axure 分析规则、组件映射规则、任务编排规则、官方能力说明。
- `scripts/`：可重复执行的确定性解析脚本。
- `agents/`：Codex UI 元信息。

不要把长组件表、案例教训、页面专属规则持续塞进 `SKILL.md`。新增规则如果较长，应进入 reference；新增稳定解析逻辑，应进入 script。

### 仓库结构

```text
axure-to-frontend/
├── SKILL.md
├── README.md
├── LICENSE
├── agents/
│   └── openai.yaml
├── references/
│   ├── axure-analysis.md
│   ├── axure-official-capabilities.md
│   ├── frontend-mapping.md
│   └── orchestration-and-tasking.md
└── scripts/
    ├── inspect_axure_export.py
    └── extract_axure_page_data.js
```

### 安装

克隆到 Codex skills 目录：

```bash
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git ~/.codex/skills/axure-to-frontend
```

Windows 默认路径通常是：

```powershell
git clone https://github.com/tianyi092-jcza/axure-to-frontend.git "$env:USERPROFILE\.codex\skills\axure-to-frontend"
```

安装后重启 Codex 或重新加载会话。

### 使用

在请求中明确使用该 skill：

```text
[$axure-to-frontend](path/to/SKILL.md) 将 Axure 原型目录还原为前端项目。
```

也可以自然语言说明：

```text
使用 axure-to-frontend 分析 yuanxing1.0，并输出到 front-web。
```

### 常用脚本

第一轮导出目录扫描：

```bash
python scripts/inspect_axure_export.py <axure-export-dir> --out axure-analysis.json
```

执行单页 `data.js` 并抽取真实对象图：

```bash
node scripts/extract_axure_page_data.js <axure-export-dir> <page-key> --out page-ledger.json
```

示例：

```bash
node scripts/extract_axure_page_data.js ./yuanxing1.0 glossary --out glossary-ledger.json
```

### 校验 skill

如果本机有 `skill-creator`，可运行：

```bash
python path/to/skill-creator/scripts/quick_validate.py path/to/axure-to-frontend
```

## English Summary

`axure-to-frontend` is designed as an Axure expert and restoration orchestrator.

It should not behave like a one-shot page generator. It first understands Axure's authoring model, extracts code/style/data evidence, builds fidelity ledgers, decomposes the work into granular tasks, and then uses a superpowers-style execution loop to implement and validate the frontend.

Core principles:

- Keep `SKILL.md` compact.
- Put detailed rules in `references/`.
- Put deterministic extraction in `scripts/`.
- Execute Axure page `data.js` instead of guessing from compressed code.
- Preserve prototype data exactly.
- Preserve layout topology and state scope.
- Map components from evidence, not assumptions.
- Restore interactions from Axure event/action models.
- Validate with build checks and rendered screenshot/interaction comparison.

## Recent Restoration Rules

- Direct Axure controls must restore to the selected frontend framework's corresponding components, not static lookalikes.
- Axure button, checkbox, and radio option-group evidence must be preserved as frontend group constraints such as Radio.Group, checkbox groups, segmented controls, tabs, or controlled button groups.
- Axure repeaters default to framework List/ListItem restoration.
- Repeaters with Axure wrap/grid enabled must restore as framework grid-list/list-grid components while preserving item width, height, wrap count, spacing, template controls, styles, and events.
- Repeater template controls, including radio buttons and checkboxes, must remain operable framework controls with local state and Axure event wiring.

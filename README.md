# Codex 插件市场中文化 / Codex Plugin Marketplace Chinese

面向 Windows 版 Codex 桌面端的本地插件市场中文化工具。它通过本机调试端口动态翻译插件名称、分类和简介，并调整已安装插件卡片的名称布局；不会修改 Codex 应用包、Marketplace 源文件或已安装插件缓存。

## 主要功能 / Features

- 将插件名称、分类、短简介和长简介转换为中文。
- 保留原有中文内容，避免重复翻译。
- 调整已安装插件的图标与名称布局，使名称固定显示并保持对齐。
- 使用 `MutationObserver` 跟踪动态渲染的插件列表。
- 记录运行指标到 `window.__codexMarketplaceZhTelemetry`，便于验证生效状态。
- Codex 已以调试端口运行时直接连接；普通实例运行时不会强制关闭或重启。

## 支持环境 / Requirements

- Windows 10/11
- Codex 桌面端
- Node.js 18 或更高版本
- 本机端口 `9233` 可用，或已有 Codex 调试实例占用该端口

## 从 GitHub 安装 / Install from GitHub

```text
codex plugin marketplace add cc282855/codex-marketplace-zh --ref main
codex plugin add codex-marketplace-zh@codex-marketplace-zh
```

安装或更新后请新建 Codex 任务，让插件 Skill 重新加载。

## 使用方法 / Usage

在 Codex 中调用：

```text
$translate-plugin-marketplace
```

也可以从插件根目录直接运行：

```powershell
node .\scripts\enable-plugin-marketplace-zh.mjs
```

运行逻辑：

1. 脚本调用插件自带的 `runtime/codex-cn-stable-launcher.mjs`。
2. 如果调试实例已运行，连接端口并注入中文名称和布局规则。
3. 如果 Codex 未运行，启动一个带本机调试端口的新实例。
4. 如果检测到普通 Codex 实例但没有调试端口，脚本会如实退出，不会终止现有会话。

## 安全边界 / Safety

- 不修改 Codex 安装目录或应用包。
- 不覆盖 Marketplace 配置和插件缓存。
- 不自动关闭用户正在使用的 Codex 窗口。
- 页面结构随 Codex 版本变化时可能需要更新选择器；应以实际页面截图和遥测结果确认是否生效。

## 开发验证 / Validation

```powershell
node --check .\plugins\codex-marketplace-zh\scripts\enable-plugin-marketplace-zh.mjs
node --check .\plugins\codex-marketplace-zh\runtime\codex-cn-stable-launcher.mjs
```

仓库技术标识保持英文，插件可见名称使用“中文 / English”双语格式。

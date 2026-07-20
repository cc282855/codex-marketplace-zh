---
name: translate-plugin-marketplace
description: 自动将 Codex 插件页面的英文插件名称、分类和简介转换为中文，并对齐已安装插件的图标与名称。用户要求翻译、汉化、恢复或对齐 Codex 插件区时使用。
---

# Codex 插件市场中文化

从插件根目录运行：

```powershell
node scripts/enable-plugin-marketplace-zh.mjs
```

该脚本调用插件自带的 Windows 运行时：

- 已有 Codex 调试实例时，连接本机端口并注入翻译与布局规则。
- Codex 未运行时，启动带本机调试端口的新实例。
- 普通 Codex 实例正在运行但没有调试端口时，不关闭、不重启该实例；如实报告未注入。
- 不修改 Codex 应用包、Marketplace 配置或插件缓存。

完成后报告脚本退出状态。只有同时取得页面 DOM 结果和插件页截图证据时，才可声称当前界面已经生效；语法检查、清单验证或安装成功只属于静态验证。

修改源码后，使用插件缓存刷新工具更新版本并重新安装。安装更新只会影响后续新建的 Codex 任务，不要把当前任务视为已刷新。

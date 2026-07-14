# HANDOFF

## PROJECT OVERVIEW

* Project name: Codex 插件市场中文化
* Project purpose: 让 Codex 桌面端“插件”页面的英文插件名称、分类和简介显示为中文；已安装插件的名称固定显示在图标下方并对齐。
* Business goal: 用户不必逐个翻译或悬停图标查看名称；应覆盖动态加载的完整插件目录，而不是仅处理页面首屏或“285+”条目。
* Current project stage: 多智能体发现阶段已完成只读调查，但项目根目录在调查期间被移动过；尚未完成审计门禁、规划、实施和真实 UI 验收。
* Definition of success:
  1. 受控启动的 Codex 插件页有可验证的 CDP/DOM 注入证据。
  2. 插件名称、分类和可取得简介在页面中显示中文；已有中文不重复处理。
  3. 所有已安装插件的图标和名称在视觉上垂直对齐。
  4. 个人插件“插件中文翻译器”已安装，并能在新任务中调用。
  5. 不以“缓存已安装”或“脚本退出码为 0”代替实际界面验收。

## CLIENT / USER CONTEXT

* User: 中文桌面 Codex 用户，偏好直接执行，不希望反复征求批准。
* Target audience: 使用 Codex 桌面端插件市场的中文用户。
* Industry: 本地 AI/开发工具定制。
* Relevant business context: 用户最初要求翻译全部插件名称和内容，已有中文不处理；还要求已安装插件名称始终显示在图标下方、与图标对齐。
* Important preferences:
  * 不要反复关闭或重启正在使用的 Codex。
  * 需要真实生效，不接受只改了首屏或只安装了插件。
  * 希望将能力封装成可调用个人插件。
  * 指定过 Ralph Loop 和多智能体编排器；Ralph 已修复但当前未启动。
* Important constraints:
  * 当前运行的 Codex 是普通启动，没有远程调试端口；不允许使用低层进程注入。
  * 所有项目数据应留在 E:\ZTY\CODEX存储目录。
  * 项目根目录曾在 E:\ZTY\CODEX存储目录 与 E:\ZTY\CODEX存储目录\Codex 工具与插件 之间移动。任何后续写入前都要重新定位真实目录。

## CURRENT STATUS

* Finished tasks:
  * 修复 Ralph Loop 的 Windows Stop Hook：全局 runtime、hooks.json 和 config.toml 已修复；doctor 返回 ok=true，status 返回 active=false。
  * 创建并安装个人插件 codex-marketplace-zh，显示名称为“插件中文翻译器”。
  * 编写动态稳定启动器 codex-cn-stable-launcher.mjs：从当前 MSIX app.asar 动态解析 plugins-page、use-plugins 和 use-host-config 资源，而不是硬编码版本哈希。
  * 稳定启动器静态语法检查通过；当前 Codex 26.707.9564.0 的解析证据为：
    * plugins-page-BljBI77L.js
    * use-plugins-Ceuj7_Pi.js
    * use-host-config-BBEkR3Tt.js
    * list-plugins 导出 Bn
  * 个人插件和安装缓存的脚本语法检查通过。
  * 两个只读子智能体完成了旧项目根目录的调查，均确认当前窗口没有可用 CDP 调试端口。
* Approved decisions:
  * 不修改 WindowsApps 受保护的 app.asar。
  * 不关闭或重启当前普通 Codex 窗口。
  * 使用仅绑定 127.0.0.1 的 Chrome DevTools Protocol 在受控启动后注入 DOM/CSS。
  * 动态读取 list-plugins 目录，以避免受限于旧版“285+”或固定哈希。
* Completed deliverables:
  * E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\codex-cn-stable-launcher.mjs
  * E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\启动中文插件界面.cmd
  * E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\personal-plugin-source\codex-marketplace-zh
  * C:\Users\Administrator\Desktop\启动 Codex 中文插件.cmd
* Existing assets:
  * marketplace\ ：本地插件市场副本和翻译缓存。
  * translation-cache.json ：旧同步流程使用的翻译缓存。
  * .codex\state\runs\marketplace-zh-recovery-20260714-01\discovery\agent-plan.json ：已校验的发现阶段计划。

## APPROVED DECISIONS

* Design decisions:
  * 已安装图标采用固定宽度列、图标在上、两行以内居中名称在下的 CSS。
  * 中文名称应保留不可翻译的品牌名，但必须附加中文用途；这仍不足以严格满足“所有品牌名称完全中文化”，见已知问题。
* Technical decisions:
  * 通过 app.asar 解析当前版本的资源模块，再在 renderer 中调用 list-plugins。
  * 使用 MutationObserver 处理 SPA 路由和动态渲染。
  * 无调试端口的正在运行实例必须安全退出，不得假装已注入。
  * 个人插件仅提供 skill + script，不是 Codex 的常驻 UI 生命周期钩子。
* Product decisions:
  * 当前普通窗口没有注入通道时，下一次通过受控启动入口打开是唯一安全路径。
* Naming decisions:
  * 插件技术名：codex-marketplace-zh。
  * 用户显示名：插件中文翻译器。

## DESIGN SYSTEM (IF APPLICABLE)

### Typography

* 不适用；只注入插件页的微型标签样式。
* 已安装插件名称使用约 0.625rem、0.8rem 行高，允许两行以内换行。

### Colors

* 不改变 Codex 原有色彩。
* 不引入新的主题色。

### Spacing

* 已安装插件单元固定约 4.75rem 宽、6rem 高。
* 图标和标签之间使用约 0.35rem 间距。

### Components

* 只针对 div[class~="group/plugin-row"] 及其按钮/标签注入 CSS。
* 不创建独立按钮、卡片或导航组件。

### Photography

* 不适用。

## TECHNICAL ARCHITECTURE

* Platform: Windows 上的 OpenAI.Codex MSIX 桌面应用。
* Framework: Electron/renderer 的 app:// 页面。
* Runtime:
  * Node: D:\0RUANJIAN\Node\node.exe 或 Codex bundled Node。
  * Python: C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe。
* Injection:
  * 仅当 Codex 以 --remote-debugging-address=127.0.0.1 和 --remote-debugging-port=9233 启动时可用。
  * 通过 http://127.0.0.1:9233/json/list 发现 app://-/index.html，再用 WebSocket Runtime.evaluate 注入。
* APIs / Integrations:
  * renderer 内部 list-plugins host API。
  * Windows PowerShell 用于读取 MSIX InstallLocation 和进程状态。
* Personal plugin:
  * Marketplace: C:\Users\Administrator\.agents\plugins\marketplace.json，名称 personal-local-plugins。
  * Installed cache: C:\Users\Administrator\.codex\plugins\cache\personal-local-plugins\codex-marketplace-zh\0.1.0+codex.20260714064851。

## FILE STRUCTURE

* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\AGENTS.md
  * 多智能体阶段、审计与门禁规则。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\README.md
  * 旧项目说明；其中“启动器会先重启 Codex”的描述已经不符合当前用户的“不关闭当前窗口”偏好，后续应修订。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\codex-cn-stable-launcher.mjs
  * 主启动器与 CDP 注入逻辑；包含名称、分类、简介和已安装图标对齐规则。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\sync-cn-marketplace.mjs
  * 旧的本地市场同步脚本；不能替代 CDP 对 openai-curated-remote 当前页面的注入。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\启动中文插件界面.cmd
  * 当前桌面启动入口所调用的项目启动脚本。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\personal-plugin-source\codex-marketplace-zh\.codex-plugin\plugin.json
  * 个人插件清单。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\personal-plugin-source\codex-marketplace-zh\skills\translate-plugin-marketplace\SKILL.md
  * 用户调用插件时的行为规范。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\personal-plugin-source\codex-marketplace-zh\scripts\enable-plugin-marketplace-zh.mjs
  * 个人插件脚本；当前硬编码 canonicalLauncher 到 E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace，项目移动后会失效。
* E:\ZTY\CODEX存储目录\codex-cn-plugin-marketplace\.codex\state\runs\marketplace-zh-recovery-20260714-01\discovery
  * 已校验的发现阶段计划；审计文件仍未填写、没有通过门禁。

## KNOWN ISSUES

* Confirmed: 当前 Codex 主进程 PID 49428 是普通启动，没有 --remote-debugging-port；127.0.0.1:9222、9232、9233 均拒绝连接。因此当前窗口无法在不关闭/重启且不做低层进程注入的约束下显示翻译。
* Confirmed: 启动器检测到普通 Codex 已运行时会安全退出。因此脚本退出码 0 并不意味着当前 UI 已翻译。
* Confirmed: 个人插件不是常驻 hook；安装插件不会自动执行脚本。
* Confirmed: 名称回退会把未知品牌显示为“英文品牌名（中文分类插件）”；这不是严格的全名称中文翻译。
* Confirmed: 简介回退可能显示为“用于某分类的插件”；它保证中文，但不是逐句高保真翻译。
* Confirmed: 项目不是 Git 仓库。project-agent-bootstrap 的 verify_subagents.py 强制要求 git-status-porcelain，因此发现阶段审计会得到 INCONCLUSIVE，除非用户同意初始化 Git 或允许不使用该严格门禁。
* Confirmed: 项目目录会移动。每次执行前都用 rg --files E:\ZTY\CODEX存储目录 -g codex-cn-stable-launcher.mjs 重新定位。
* Risk: enable-plugin-marketplace-zh.mjs 硬编码旧 canonicalLauncher；若项目再次移动，个人插件调用会失败。
* Unknown: 下一次通过启动器启动后的视觉效果尚未获得截图或 CDP DOM 计数证据。

## OPEN TASKS

### P0

* 让用户在允许的时机关闭当前 Codex 后，从桌面“启动 Codex 中文插件.cmd”启动一次；收集 /json/list、DOM 注入计数和插件页截图。
* 让个人插件脚本不依赖硬编码 E 盘路径，改为定位已安装副本或市场源。
* 完成多智能体发现阶段审计；当前因非 Git 项目而不能得到 PASS。

### P1

* 增加真实翻译策略或可维护词典，以满足“全部插件名称和内容”而不仅是品牌保留/分类回退。
* 改进启动器输出：目录总数、翻译名称数量、翻译简介数量、已对齐图标数量。
* 同步 README，使其不再承诺或建议自动重启当前 Codex。

### P2

* 在更新 Codex 后自动检测哈希/接口变化并输出兼容性诊断。
* 将个人插件封装为不依赖项目移动的完整可移植组件。

## NEXT RECOMMENDED ACTIONS

1. 先用 rg 重新定位项目根目录和 project-agent-bootstrap 技能根目录；不要假设上一次路径仍然存在。
2. 在不改动用户当前 Codex 的前提下，修复个人插件脚本的 canonicalLauncher 路径发现逻辑。
3. 用 plugin-creator 的 cachebuster 与 reinstall 流程重新安装个人插件，并运行 validate_plugin.py。
4. 等用户自行关闭普通 Codex 后，运行桌面的“启动 Codex 中文插件.cmd”。
5. 受控启动后检查 http://127.0.0.1:9233/json/list 是否有 app://-/index.html。
6. 用 CDP Runtime.evaluate 读取：
   * #codex-cn-plugin-layout 是否存在。
   * window.__codexCnStableObserver 与 window.__codexMarketplaceZhDescriptionObserver 是否存在。
   * 可见插件名称/简介中中文数量。
   * 已安装插件按钮布局的实际 bounding boxes。
7. 打开插件页并保存截图，作为最终视觉验收证据。
8. 仅在上述证据都成功后，才向用户说“已生效”。

## DO NOT DO

* 不要在没有用户当次明确许可时关闭、重启或终止当前 Codex 进程。
* 不要修改 C:\Program Files\WindowsApps 下的 app.asar，也不要进行低层 DLL/进程注入。
* 不要把“插件已安装”“Node 语法检查通过”或“启动器安全退出”称为界面已生效。
* 不要用 sync-cn-marketplace.mjs 声称翻译了当前远程插件页面。
* 不要在 C 盘创建新的项目源或临时项目数据；个人插件运行时/缓存是已有系统位置的例外。
* 不要在多智能体计划未通过审计门禁时继续把该阶段标记为 PASS。
* 不要依赖固定 E 盘项目路径；该目录已经至少移动过两次。

## IMPORTANT CONVERSATION INSIGHTS

* 用户持续强调“除了最上面的几个，其他全没变化”和“不止 285+”，说明首屏/缓存同步不是验收标准。
* 用户明确指出软件更新后界面恢复原状，说明任何硬编码版本资源或手工注入都必须面对更新兼容性。
* 用户要求“已安装的插件上下不对齐”，因此图标标签 CSS 不是可选项。
* 用户抱怨“为什么老关闭 Codex”，因此后续启动策略必须优先不打断当前窗口。
* 用户后来明确要求“调用后直接自动翻译插件区全部插件”，所以个人插件必须被真实调用并输出可验证结果。
* 两个只读子智能体均独立确认：当前窗口没有 CDP 端口，当前限制是技术事实而不是脚本遗漏。
* 用户现在要求交接并在新任务中继续；新任务必须先读本文件，不要从头猜测或声称当前 UI 已翻译。

## PROJECT MEMORY SNAPSHOT

这是一个本地 Windows Codex 插件页中文化项目。核心方案不是修改受保护 app.asar，而是受控启动 Codex 并在 127.0.0.1 的 CDP 端口动态读取 list-plugins、注入中文文本和已安装图标布局 CSS。当前个人插件已安装，启动器也能通过静态检查，但用户当前打开的普通 Codex 没有调试端口，所以没有可见效果。不要重启当前窗口；下一次用户自行关闭后才能用启动器产生真实验收。项目路径不稳定，务必先用 rg 定位。多智能体发现计划存在，但非 Git 项目导致严格审计门禁暂不能 PASS。

## FINAL INSTRUCTION

Read this document as the sole project memory. Confirm the current project root by searching for codex-cn-stable-launcher.mjs, then verify the current Codex process and local debug ports before editing anything. Continue only from confirmed facts, preserve the user’s no-disruption preference, and never claim that translation is active without live CDP/DOM and visual evidence.

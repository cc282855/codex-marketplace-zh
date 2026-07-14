import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

const port = 9233;
const powershell = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const categoryNames = {
  'Business & Operations': '业务与运营', Communication: '沟通协作', Creativity: '创意设计',
  'Data & Analytics': '数据分析', 'Developer Tools': '开发者工具', 'Education & Research': '教育与研究',
  Entertainment: '娱乐', Finance: '金融', Healthcare: '医疗健康', Other: '其他',
  Productivity: '生产力', Security: '安全', Travel: '旅行',
};
const names = {
  'Data Analytics': '数据分析', GitHub: 'GitHub（代码托管）', 'Investment Banking': '投资银行',
  'Public Equity Investing': '公开市场股票投资', Sales: '销售', 'Google Drive': 'Google 云端硬盘',
  Gmail: 'Gmail 邮箱', Slack: 'Slack（团队协作）', Chrome: 'Chrome 浏览器',
  'Computer Use': '计算机控制', Spreadsheets: '电子表格', Presentations: '演示文稿', Documents: '文档',
  PDF: 'PDF 文档', 'Google Calendar': 'Google 日历', 'Google Docs': 'Google 文档',
  'Google Sheets': 'Google 表格', 'Google Slides': 'Google 幻灯片', 'Notion': 'Notion（笔记与知识库）',
  Linear: 'Linear（项目管理）', ClickUp: 'ClickUp（项目管理）', Dropbox: 'Dropbox（云盘）',
  Asana: 'Asana（项目管理）', Canva: 'Canva（设计工具）', Figma: 'Figma（设计工具）',
  Gamma: 'Gamma（演示文稿）', Fal: 'Fal（生成式 AI）', Descript: 'Descript（视频编辑）',
  'Adobe (formerly Photoshop)': 'Adobe（原 Photoshop）', 'Google Maps': 'Google 地图',
  'Google Search': 'Google 搜索', 'Google Ads': 'Google 广告', 'Microsoft Teams': 'Microsoft Teams（团队协作）',
  'Microsoft Outlook': 'Microsoft Outlook（邮箱）', 'Product Hunt': 'Product Hunt（产品发现）',
  YouTube: 'YouTube（视频）', LinkedIn: 'LinkedIn（职业社交）', WhatsApp: 'WhatsApp（即时通信）',
  Discord: 'Discord（社区沟通）', OpenAI: 'OpenAI（人工智能）', ChatGPT: 'ChatGPT（人工智能助手）',
  Zoom: 'Zoom（视频会议）', Jira: 'Jira（项目管理）', Trello: 'Trello（项目管理）',
  Miro: 'Miro（协作白板）', Airtable: 'Airtable（数据库）', Zapier: 'Zapier（自动化）',
  Calendly: 'Calendly（日程安排）', HubSpot: 'HubSpot（客户关系管理）', Salesforce: 'Salesforce（客户关系管理）',
  Shopify: 'Shopify（电商）', Stripe: 'Stripe（支付）', Instagram: 'Instagram（社交媒体）',
  TikTok: 'TikTok（短视频）', Facebook: 'Facebook（社交媒体）', Telegram: 'Telegram（即时通信）',
  Spotify: 'Spotify（音乐）', 'Codex 5.5 Instruct': 'Codex 5.5 指令仓库',
  'Default templates': '默认模板', 'Product Design': '产品设计',
};
const words = {
  ai: '人工智能', access: '访问', agent: '智能体', agents: '智能体', analytics: '分析', analysis: '分析', automation: '自动化',
  banking: '银行', browser: '浏览器', build: '构建', business: '业务', calendar: '日历', chat: '聊天', cloud: '云端',
  code: '代码', coding: '编程', commerce: '商务', communication: '沟通', content: '内容', create: '创建', creative: '创意',
  creativity: '创意', customer: '客户', data: '数据', design: '设计', developer: '开发者', development: '开发',
  document: '文档', documents: '文档', education: '教育', email: '邮箱', equity: '股权', finance: '金融',
  edit: '编辑', generate: '生成', health: '健康', healthcare: '医疗健康', image: '图像', images: '图像', investment: '投资', investing: '投资',
  language: '语言', manage: '管理', management: '管理', marketing: '市场营销', media: '媒体', meeting: '会议', operations: '运营',
  payment: '支付', product: '产品', productivity: '生产力', project: '项目', public: '公开市场', report: '报告', reports: '报告', research: '研究',
  review: '审阅', sales: '销售', search: '搜索', security: '安全', service: '服务', share: '分享', social: '社交', spreadsheet: '电子表格',
  support: '支持', tool: '工具', tools: '工具', translation: '翻译', translator: '翻译', travel: '旅行',
  video: '视频', voice: '语音', workflow: '工作流', workflows: '工作流', write: '写作', writer: '写作',
};

function runPowerShell(command) {
  return new Promise((resolve, reject) => execFile(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true }, (error, stdout, stderr) => {
    if (error) reject(new Error(stderr.trim() || error.message)); else resolve(stdout.trim());
  }));
}

function sleep(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

function frame(value) {
  const payload = Buffer.from(JSON.stringify(value));
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else if (payload.length < 0x10000) header = Buffer.from([0x81, 0xfe, (payload.length >> 8) & 0xff, payload.length & 0xff]);
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0xff; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
  return Buffer.concat([header, mask, payload]);
}

function evaluate(webSocketDebuggerUrl, expression) {
  const url = new URL(webSocketDebuggerUrl);
  const key = randomBytes(16).toString('base64');
  const expectedAccept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port) });
    let buffer = Buffer.alloc(0); let upgraded = false; let complete = false;
    const timer = setTimeout(() => finish(null, new Error('本机 Codex 调试连接超时')), 8000);
    const finish = (value, error) => {
      if (complete) return; complete = true; clearTimeout(timer); socket.destroy();
      if (error) reject(error); else resolve(value);
    };
    const consume = () => {
      while (upgraded && buffer.length >= 2) {
        let length = buffer[1] & 0x7f; let offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        if (buffer.length < offset + length) return;
        const opcode = buffer[0] & 0x0f;
        const message = buffer.subarray(offset, offset + length); buffer = buffer.subarray(offset + length);
        if (opcode !== 1) continue;
        const response = JSON.parse(message.toString());
        if (response.id === 1) {
          if (response.error) finish(null, new Error(response.error.message));
          else finish(response.result?.result?.value ?? null);
        }
      }
    };
    socket.on('connect', () => socket.write([
      `GET ${url.pathname}${url.search} HTTP/1.1`, `Host: ${url.host}`, 'Upgrade: websocket', 'Connection: Upgrade',
      'Origin: http://127.0.0.1', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '', '',
    ].join('\r\n')));
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      if (!upgraded) {
        const boundary = buffer.indexOf('\r\n\r\n'); if (boundary < 0) return;
        const headers = buffer.subarray(0, boundary).toString();
        if (!headers.startsWith('HTTP/1.1 101') || !headers.toLowerCase().includes(`sec-websocket-accept: ${expectedAccept.toLowerCase()}`)) return finish(null, new Error('Codex 拒绝了本机调试连接'));
        upgraded = true; buffer = buffer.subarray(boundary + 4);
        socket.write(frame({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
      }
      consume();
    });
    socket.on('error', error => finish(null, error));
  });
}

async function getDebugPage() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`调试端口返回 HTTP ${response.status}`);
  return (await response.json()).find(page => page.url === 'app://-/index.html' && page.webSocketDebuggerUrl) ?? null;
}

async function getPackage() {
  const installLocation = await runPowerShell('(Get-AppxPackage OpenAI.Codex).InstallLocation');
  if (!installLocation) throw new Error('无法定位 Codex 安装位置');
  return { installLocation, executable: path.join(installLocation, 'app', 'ChatGPT.exe'), asar: path.join(installLocation, 'app', 'resources', 'app.asar') };
}

async function assetText(asarPath, needle) {
  const asar = await readFile(asarPath);
  const header = JSON.parse(asar.subarray(16, 16 + asar.readUInt32LE(12)).toString());
  const find = (node, prefix = '') => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const candidate = prefix ? `${prefix}/${name}` : name;
      if (entry.files) { const nested = find(entry, candidate); if (nested) return nested; }
      if (candidate.startsWith('webview/assets/') && candidate.endsWith('.js') && candidate.includes(needle)) return { entry, candidate };
    }
    return null;
  };
  const found = find(header);
  if (!found) throw new Error(`未找到 ${needle}`);
  const offset = 8 + asar.readUInt32LE(4) + Number(found.entry.offset);
  return { path: found.candidate, text: asar.subarray(offset, offset + found.entry.size).toString() };
}

function buildChineseName(name, category) {
  if (names[name]) return names[name];
  let result = name.replace(/[A-Za-z][A-Za-z0-9&+.-]*/g, token => words[token.toLowerCase()] ?? token);
  if (!/[\u3400-\u9fff]/.test(result)) return `${name}（${categoryNames[category] ?? '工具'}插件）`;
  if (/[A-Za-z]/.test(result)) result += `（${categoryNames[category] ?? '工具'}插件）`;
  return result;
}

function buildChineseDescription(description, category) {
  if (!description || /[\u3400-\u9fff]/.test(description)) return description;
  const translated = description.replace(/[A-Za-z][A-Za-z0-9&+.-]*/g, token => words[token.toLowerCase()] ?? token);
  const remainingEnglish = translated.match(/[A-Za-z]{3,}/g) ?? [];
  return /[\u3400-\u9fff]/.test(translated) && remainingEnglish.length <= 1
    ? translated
    : `用于${categoryNames[category] ?? '工具'}的插件`;
}

async function injectNamesAndLayout(packageInfo) {
  const pluginFile = await assetText(packageInfo.asar, 'plugins-page-');
  const usePluginsImport = pluginFile.text.match(/from"\.\/(use-plugins-[^"]+\.js)"/);
  if (!usePluginsImport) throw new Error('未识别更新后的插件查询模块');
  const usePluginsFile = await assetText(packageInfo.asar, usePluginsImport[1]);
  const hostImport = usePluginsFile.text.match(/import\{([^}]+)\}from"\.\/(use-host-config-[^"]+\.js)"/);
  const callAlias = usePluginsFile.text.match(/await ([A-Za-z_$][\w$]*)\(`list-plugins`/);
  if (!hostImport || !callAlias) throw new Error('未识别更新后的插件目录接口');
  const exportMatch = hostImport[1].split(',').map(value => value.trim()).map(value => value.match(/^([A-Za-z_$][\w$]*) as ([A-Za-z_$][\w$]*)$/)).find(match => match?.[2] === callAlias[1]);
  if (!exportMatch) throw new Error('未识别更新后的插件目录接口导出');
  const page = await getDebugPage();
  if (!page) return false;
  const catalogText = await evaluate(page.webSocketDebuggerUrl, `(async()=>{const api=await import('./assets/${hostImport[2]}');const r=await api.${exportMatch[1]}('list-plugins',{hostId:'local'});return JSON.stringify(r.marketplaces.flatMap(m=>m.plugins??[]).map(p=>({name:p.interface?.displayName??p.name,category:p.interface?.category??''})));})()`);
  const catalog = JSON.parse(catalogText);
  const map = Object.fromEntries(catalog.map(plugin => [plugin.name, buildChineseName(plugin.name, plugin.category)]));
  const expression = `(()=>{const map=${JSON.stringify(map)};let style=document.getElementById('codex-cn-plugin-layout');if(!style){style=document.createElement('style');style.id='codex-cn-plugin-layout';document.head.appendChild(style)}style.textContent=\`div[class~="group/plugin-row"]{display:flex!important;align-items:flex-start!important;gap:.25rem!important;min-height:6.25rem!important;height:auto!important;overflow:visible!important}div[class~="group/plugin-row"]>button{position:relative!important;display:flex!important;flex:0 0 4.75rem!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:.35rem!important;width:4.75rem!important;min-width:4.75rem!important;height:6rem!important;padding:.25rem .125rem!important;overflow:visible!important}div[class~="group/plugin-row"]>button>span:first-child{flex:0 0 2.75rem!important;margin:0!important}div[class~="group/plugin-row"]>button>span[aria-hidden="true"]{position:static!important;display:block!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:1.75rem!important;margin:0!important;padding:0 .125rem!important;overflow:hidden!important;overflow-wrap:anywhere!important;white-space:normal!important;text-align:center!important;text-overflow:clip!important;font-size:.625rem!important;line-height:.8rem!important;opacity:1!important;transform:none!important;transition:none!important}\`;const active=()=>Boolean(document.getElementById('plugins-page-search')||document.querySelector('div[class~="group/plugin-row"]'));const apply=()=>{if(!active())return 0;let count=0;for(const el of document.querySelectorAll('body *')){if(el.children.length)continue;const source=el.textContent.trim(),target=map[source],rect=el.getBoundingClientRect();if(!target||source===target||!rect.width||!rect.height)continue;el.textContent=target;count++}return count};window.__codexCnStableObserver?.disconnect?.();const observer=new MutationObserver(()=>apply());observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.__codexCnStableObserver=observer;return{mapped:Object.keys(map).length,initial:apply()}})()`;
  await evaluate(page.webSocketDebuggerUrl, expression);
  return true;
}

async function injectCurrentVersion(packageInfo) {
  if (!(await injectNamesAndLayout(packageInfo))) return false;

  const pluginFile = await assetText(packageInfo.asar, 'plugins-page-');
  const usePluginsImport = pluginFile.text.match(/from"\.\/(use-plugins-[^"]+\.js)"/);
  if (!usePluginsImport) throw new Error('未识别更新后的插件查询模块');
  const usePluginsFile = await assetText(packageInfo.asar, usePluginsImport[1]);
  const hostImport = usePluginsFile.text.match(/import\{([^}]+)\}from"\.\/(use-host-config-[^"]+\.js)"/);
  const callAlias = usePluginsFile.text.match(/await ([A-Za-z_$][A-Za-z0-9_$]*)\([^)]*list-plugins/);
  if (!hostImport || !callAlias) throw new Error('未识别更新后的插件目录接口');
  const exportMatch = hostImport[1]
    .split(',')
    .map(value => value.trim())
    .map(value => value.match(/^([A-Za-z_$][A-Za-z0-9_$]*) as ([A-Za-z_$][A-Za-z0-9_$]*)$/))
    .find(match => match?.[2] === callAlias[1]);
  if (!exportMatch) throw new Error('未识别更新后的插件目录接口导出');

  const catalogExpression =
    "(async()=>{const api=await import('./assets/" +
    hostImport[2] +
    "');const r=await api." +
    exportMatch[1] +
    "('list-plugins',{hostId:'local'});return JSON.stringify((r.marketplaces??[]).flatMap(m=>(m.plugins??[]).map(p=>({category:p.interface?.category??'',descriptions:[p.description,p.interface?.description,p.interface?.shortDescription,p.interface?.longDescription].filter(v=>typeof v==='string')}))));})()";
  const page = await getDebugPage();
  if (!page) return false;
  const catalog = JSON.parse(await evaluate(page.webSocketDebuggerUrl, catalogExpression));
  const descriptions = {};
  for (const plugin of catalog) {
    for (const description of new Set(plugin.descriptions)) {
      if (description) descriptions[description] = buildChineseDescription(description, plugin.category);
    }
  }

  const expression = [
    "(()=>{",
    "const descriptions=" + JSON.stringify(descriptions) + ";",
    "const hasHan=value=>/[\u3400-\u9fff]/.test(value);",
    'const active=()=>Boolean(document.getElementById("plugins-page-search")||document.querySelector("div[class~=\\"group/plugin-row\\"]"));',
    "const apply=()=>{if(!active())return 0;let changed=0;for(const element of document.body.querySelectorAll('*')){if(element.children.length)continue;const saved=element.getAttribute('data-codex-cn-description-source');const source=saved??element.textContent.trim();if(!source||hasHan(source))continue;let target=descriptions[source];if(!target&&/[A-Za-z]/.test(source)){const prefix=source.replace(/(?:…|\.\.\.)$/,'');if(prefix.length>5){const key=Object.keys(descriptions).find(value=>value.startsWith(prefix));target=key?descriptions[key]:undefined;}}if(!target||target===source||element.textContent===target)continue;element.setAttribute('data-codex-cn-description-source',source);element.textContent=target;changed++;}return changed;};",
    "window.__codexMarketplaceZhDescriptionObserver?.disconnect?.();let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.__codexMarketplaceZhDescriptionObserver=observer;return{descriptions:Object.keys(descriptions).length,changed:apply()};",
    "})()",
  ].join("");
  await evaluate(page.webSocketDebuggerUrl, expression);
  return true;
}

async function codexRunning() {
  return (await runPowerShell("[bool](Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ChatGPT.exe' -and $_.CommandLine -match 'OpenAI\\.Codex' })")) === 'True';
}

async function main() {
  const packageInfo = await getPackage();
  try {
    if (await injectCurrentVersion(packageInfo)) {
      setInterval(() => injectCurrentVersion(packageInfo).catch(() => {}), 2000);
      console.log('已在当前 Codex 中恢复中文插件规则。');
      return;
    }
  } catch {
    // 当前窗口没有启用本机调试端口时，保留用户会话并等待下一次安全启动。
  }
  if (await codexRunning()) {
    console.log('Codex 已在运行；为避免打断当前窗口，启动器未执行。请下次从“启动中文插件界面.cmd”打开 Codex。');
    return;
  }
  const child = spawn(packageInfo.executable, [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`, '--remote-allow-origins=*'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try { if (await injectCurrentVersion(packageInfo)) break; } catch (error) { if (attempt === 44) throw error; }
    await sleep(1000);
  }
  setInterval(() => injectCurrentVersion(packageInfo).catch(() => {}), 2000);
  console.log('Codex 中文插件规则已启动；后续更新会自动读取新版本。');
}

main().catch(error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });

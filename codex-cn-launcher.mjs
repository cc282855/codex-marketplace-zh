import { createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyChineseMarketplaceToRuntime,
  syncChineseMarketplace,
  translateActiveInstalledPlugins,
} from './sync-cn-marketplace.mjs';

const port = 9232;
const powershell = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const styleId = 'codex-cn-installed-plugin-labels';
const translationCachePath = new URL('./translation-cache.json', import.meta.url);
const han = /[\u3400-\u9fff]/;
const titleOverrides = {
  Notion: 'Notion（笔记与知识库）',
  'Google Calendar': 'Google 日历',
  Linear: 'Linear（项目管理）',
  ClickUp: 'ClickUp（项目管理）',
  Dropbox: 'Dropbox（云盘）',
  Asana: 'Asana（项目管理）',
  Canva: 'Canva（设计工具）',
  Figma: 'Figma（设计工具）',
  Gamma: 'Gamma（演示文稿）',
  Fal: 'Fal（生成式 AI）',
  Descript: 'Descript（视频编辑）',
  'Adobe (formerly Photoshop)': 'Adobe（原 Photoshop）',
};
const liveTranslation = { cache: {}, fields: new Map(), loaded: false, loading: null };
const css = `
  div[class~="group/plugin-row"] {
    height: 5.5rem !important;
    align-items: flex-start !important;
    overflow: visible !important;
  }
  div[class~="group/plugin-row"] > button {
    width: 2.75rem !important;
    height: 5.5rem !important;
    align-items: flex-start !important;
    padding-top: 0.25rem !important;
  }
  div[class~="group/plugin-row"] > button > span[aria-hidden="true"] {
    top: 2.75rem !important;
    z-index: 10 !important;
    width: 2.75rem !important;
    max-width: 2.75rem !important;
    overflow-wrap: anywhere !important;
    white-space: normal !important;
    text-align: center !important;
    font-size: 0.625rem !important;
    line-height: 0.8rem !important;
    opacity: 1 !important;
    transform: translateX(-50%) !important;
    transition: none !important;
  }
`;

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout.trim());
    });
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function makeClientTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

function readServerFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }
    if (offset + headerLength + length > buffer.length) break;
    const opcode = first & 0x0f;
    const body = buffer.subarray(offset + headerLength, offset + headerLength + length);
    if (opcode === 0x1) messages.push(body.toString('utf8'));
    offset += headerLength + length;
  }
  return { messages, remainder: buffer.subarray(offset) };
}

function evaluateOverCdp(webSocketDebuggerUrl, expression) {
  const url = new URL(webSocketDebuggerUrl);
  const key = randomBytes(16).toString('base64');
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port) });
    let handshakeDone = false;
    let incoming = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timed out connecting to the local Codex debug endpoint'));
    }, 5000);
    const finish = (result, error) => {
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    socket.once('error', error => finish(null, error));
    socket.once('connect', () => {
      socket.write([
        `GET ${url.pathname}${url.search} HTTP/1.1`,
        `Host: ${url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Origin: http://127.0.0.1',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'));
    });
    socket.on('data', data => {
      incoming = Buffer.concat([incoming, data]);
      if (!handshakeDone) {
        const boundary = incoming.indexOf('\r\n\r\n');
        if (boundary < 0) return;
        const header = incoming.subarray(0, boundary).toString('utf8');
        if (!header.startsWith('HTTP/1.1 101') || !header.toLowerCase().includes(`sec-websocket-accept: ${accept.toLowerCase()}`)) {
          finish(null, new Error('Codex rejected the local debug connection'));
          return;
        }
        handshakeDone = true;
        incoming = incoming.subarray(boundary + 4);
        socket.write(makeClientTextFrame(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        })));
      }
      if (!handshakeDone) return;
      const parsed = readServerFrames(incoming);
      incoming = parsed.remainder;
      for (const message of parsed.messages) {
        const response = JSON.parse(message);
        if (response.id === 1) {
          if (response.error) finish(null, new Error(response.error.message));
          else finish(response.result?.result?.value ?? null);
          return;
        }
      }
    });
  });
}

function shouldTranslate(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && /[A-Za-z]{3}/.test(value)
    && !han.test(value)
    && !/^https?:/i.test(value);
}

async function loadTranslationCache() {
  try { return JSON.parse(await readFile(translationCachePath, 'utf8')); } catch { return {}; }
}

async function saveTranslationCache() {
  const temporary = new URL('./translation-cache.json.tmp', import.meta.url);
  await writeFile(temporary, `${JSON.stringify(liveTranslation.cache, null, 2)}\n`, 'utf8');
  await rename(temporary, translationCachePath);
}

async function translateText(value, field) {
  if (field === 'displayName' && titleOverrides[value]) {
    liveTranslation.cache[value] = titleOverrides[value];
    return titleOverrides[value];
  }
  if (liveTranslation.cache[value]) return liveTranslation.cache[value];
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', 'zh-CN');
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', value);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`翻译服务返回 HTTP ${response.status}`);
  const payload = await response.json();
  let translated = payload?.[0]?.map(segment => segment[0]).join('')?.trim() || value;
  if (field === 'displayName' && !han.test(translated)) translated = `${translated}（插件）`;
  liveTranslation.cache[value] = translated;
  return translated;
}

async function evaluateMainPage(expression) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Debug endpoint returned HTTP ${response.status}`);
  const target = (await response.json()).find(page => page.type === 'page' && page.url === 'app://-/index.html');
  if (target?.webSocketDebuggerUrl == null) return null;
  return evaluateOverCdp(target.webSocketDebuggerUrl, expression);
}

async function loadLiveCatalog() {
  if (liveTranslation.loaded) return;
  if (liveTranslation.loading != null) return liveTranslation.loading;
  liveTranslation.loading = (async () => {
    liveTranslation.cache = await loadTranslationCache();
    const serialized = await evaluateMainPage(`(async () => {
      const api = await import('./assets/use-host-config-Cpc-C-H3.js');
      const result = await api.Bn('list-plugins', { hostId: 'local' });
      const fields = ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'defaultPrompt', 'keywords'];
      const plugins = result.marketplaces
        .filter(marketplace => marketplace.name === 'openai-curated-remote')
        .flatMap(marketplace => marketplace.plugins ?? [])
        .map(plugin => Object.fromEntries(fields.map(field => [field, plugin.interface?.[field] ?? plugin[field] ?? null])));
      return JSON.stringify(plugins);
    })()`);
    for (const plugin of JSON.parse(serialized ?? '[]')) {
      for (const [field, raw] of Object.entries(plugin)) {
        const values = Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          if (!shouldTranslate(value)) continue;
          if (field === 'displayName' || !liveTranslation.fields.has(value)) liveTranslation.fields.set(value, field);
        }
      }
    }
    liveTranslation.loaded = true;
  })().finally(() => { liveTranslation.loading = null; });
  return liveTranslation.loading;
}

const visiblePluginTextExpression = `(() => {
  if (!document.getElementById('plugins-page-search')) return [];
  const values = new Set();
  for (const element of document.querySelectorAll('body *')) {
    if (element.children.length !== 0) continue;
    const rect = element.getBoundingClientRect();
    const text = element.textContent.trim();
    if (rect.left < 400 || rect.width === 0 || rect.height === 0 || text.length === 0 || text.length > 5000) continue;
    values.add(text);
  }
  return [...values];
})()`;

async function applyVisibleTranslations(translations) {
  if (Object.keys(translations).length === 0) return 0;
  return evaluateMainPage(`(() => {
    if (!document.getElementById('plugins-page-search')) return 0;
    const translations = ${JSON.stringify(translations)};
    let changed = 0;
    for (const element of document.querySelectorAll('body *')) {
      if (element.children.length !== 0) continue;
      const rect = element.getBoundingClientRect();
      const original = element.textContent.trim();
      const translated = translations[original];
      if (rect.left < 400 || translated == null || original === translated) continue;
      element.textContent = translated;
      element.dataset.codexCnTranslated = 'true';
      changed += 1;
    }
    return changed;
  })()`);
}

async function translateVisiblePluginText() {
  await loadLiveCatalog();
  const visible = await evaluateMainPage(visiblePluginTextExpression);
  if (!Array.isArray(visible)) return;
  const candidates = visible.filter(value => liveTranslation.fields.has(value)
    && (!liveTranslation.cache[value] || (liveTranslation.fields.get(value) === 'displayName' && titleOverrides[value]))).slice(0,12);
  if (candidates.length > 0) {
    await Promise.all(candidates.map(async value => {
      try { await translateText(value, liveTranslation.fields.get(value)); } catch { /* retry next cycle */ }
    }));
    await saveTranslationCache();
  }
  const translations = Object.fromEntries(visible
    .filter(value => liveTranslation.cache[value])
    .map(value => [value, liveTranslation.cache[value]]));
  await applyVisibleTranslations(translations);
}

async function injectStyle() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Debug endpoint returned HTTP ${response.status}`);
  const targets = await response.json();
  const expression = `(() => {
    const id = ${JSON.stringify(styleId)};
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.documentElement.appendChild(style);
    }
    style.textContent = ${JSON.stringify(css)};
    return Boolean(document.querySelector('div[class~="group/plugin-row"]'));
  })()`;
  const pages = targets.filter(target => target.type === 'page' && target.webSocketDebuggerUrl);
  return Promise.all(pages.map(page => evaluateOverCdp(page.webSocketDebuggerUrl, expression)));
}

async function codexIsRunning() {
  return (await runPowerShell("[bool](Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ChatGPT.exe' -and $_.CommandLine -match 'OpenAI\\.Codex' })")) === 'True';
}

async function stopCodex() {
  await runPowerShell("Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'ChatGPT.exe' -and $_.CommandLine -match 'OpenAI\\.Codex' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }");
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (!(await codexIsRunning())) return;
    await sleep(500);
  }
  throw new Error('Codex 未能停止；请先从托盘图标退出后再试。');
}

async function codexExecutable() {
  const installLocation = await runPowerShell('(Get-AppxPackage OpenAI.Codex).InstallLocation');
  if (!installLocation) throw new Error('Unable to locate the installed Codex application');
  return path.join(installLocation, 'app', 'ChatGPT.exe');
}

async function waitForDebugEndpoint() {
  let latestError;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      await injectStyle();
      return;
    } catch (error) {
      latestError = error;
      await sleep(1000);
    }
  }
  throw latestError ?? new Error('Codex debug endpoint did not become available');
}

async function main() {
  const translation = await syncChineseMarketplace();
  const runtime = await applyChineseMarketplaceToRuntime();
  const installed = await translateActiveInstalledPlugins();
  if (await codexIsRunning() && globalThis.process?.argv?.includes('--restart')) {
    await stopCodex();
  } else if (await codexIsRunning()) {
    throw new Error('Codex 仍在运行。请从托盘图标完全退出 Codex，再双击此启动器。');
  }
  const executable = await codexExecutable();
  const child = spawn(executable, [
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  await waitForDebugEndpoint();
  await loadLiveCatalog();
  await translateVisiblePluginText().catch(() => {});
  setInterval(() => {
    injectStyle().catch(() => {});
    translateVisiblePluginText().catch(() => {});
  }, 1500);
  console.log(JSON.stringify({ translation, runtime, installed, remoteCatalogPlugins: liveTranslation.fields.size, status: 'Codex 已启动；在线插件目录将随滚动自动翻译。' }, null, 2));
}

main().catch(error => {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});

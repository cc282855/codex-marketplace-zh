import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = 'C:/Users/Administrator/.codex/.tmp/plugins';
const targetRoot = path.dirname(fileURLToPath(import.meta.url));
const translatedRoot = path.join(targetRoot, 'marketplace');
const cachePath = path.join(targetRoot, 'translation-cache.json');
const han = /[\u3400-\u9fff]/;

const visibleTextFields = ['displayName', 'shortDescription', 'longDescription', 'category'];
const promptsField = 'defaultPrompt';
const displayNameOverrides = {
  Base44: 'Base44（应用构建平台）',
  Chrome: 'Chrome 浏览器',
  'Computer Use': '计算机控制',
  'Data Analytics': '数据分析',
  Documents: '文档',
  Gmail: 'Gmail 邮箱',
  'Google Drive': 'Google 云端硬盘',
  GitHub: 'GitHub（代码托管）',
  PDF: 'PDF 文档',
  Presentations: '演示文稿',
  Shutterstock: 'Shutterstock（图片素材）',
  Spreadsheets: '电子表格',
  'Template Creator': '模板创建器',
};

function needsTranslation(value) {
  return typeof value === 'string' && value.trim() && !han.test(value) && !/^https?:\/\//i.test(value);
}

function chunks(value, limit = 4200) {
  if (value.length <= limit) return [value];
  const parts = [];
  let rest = value;
  while (rest.length > limit) {
    let cut = Math.max(rest.lastIndexOf('\n', limit), rest.lastIndexOf(' ', limit), rest.lastIndexOf('。', limit));
    if (cut < limit * 0.55) cut = limit;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

async function loadJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

async function atomicJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

async function googleTranslate(value) {
  const result = [];
  for (const part of chunks(value)) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', 'zh-CN');
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', part);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Translation request failed: HTTP ${response.status}`);
    const payload = await response.json();
    result.push(payload[0].map(segment => segment[0]).join(''));
  }
  return result.join('');
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }));
}

function translatedInterfaceValue(field, original, cache) {
  if (!needsTranslation(original)) return original;
  const translated = field === 'displayName'
    ? (displayNameOverrides[original] ?? cache[original] ?? original)
    : (cache[original] ?? original);
  return field === 'displayName' && !han.test(translated) ? `${translated}（插件）` : translated;
}

async function fillTranslationCache(texts, cache) {
  const pending = [...texts].filter(text => !cache[text]);
  let completed = 0;
  await mapLimit(pending, 6, async text => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        cache[text] = await googleTranslate(text);
        completed += 1;
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 900 * attempt));
      }
    }
  });
  return completed;
}

async function pluginManifestFiles(root) {
  const files = [];
  async function visit(directory, depth) {
    if (depth < 0) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate, depth - 1);
      else if (entry.isFile() && entry.name === 'plugin.json' && candidate.includes(`${path.sep}.codex-plugin${path.sep}`)) files.push(candidate);
    }
  }
  await visit(root, 8);
  return files;
}

async function translateManifests(files, cache) {
  const manifests = [];
  const texts = new Set();
  for (const file of files) {
    const manifest = await loadJson(file, null);
    if (!manifest?.interface) continue;
    manifests.push({ file, manifest });
    for (const field of visibleTextFields) if (needsTranslation(manifest.interface[field])) texts.add(manifest.interface[field]);
    if (needsTranslation(manifest.description)) texts.add(manifest.description);
    for (const prompt of manifest.interface[promptsField] ?? []) if (needsTranslation(prompt)) texts.add(prompt);
    for (const capability of manifest.interface.capabilities ?? []) if (needsTranslation(capability)) texts.add(capability);
  }
  const newlyTranslated = await fillTranslationCache(texts, cache);
  for (const { file, manifest } of manifests) {
    for (const field of visibleTextFields) {
      manifest.interface[field] = translatedInterfaceValue(field, manifest.interface[field], cache);
    }
    if (needsTranslation(manifest.description)) manifest.description = cache[manifest.description] ?? manifest.description;
    if (Array.isArray(manifest.interface[promptsField])) {
      manifest.interface[promptsField] = manifest.interface[promptsField].map(value => needsTranslation(value) ? (cache[value] ?? value) : value);
    }
    if (Array.isArray(manifest.interface.capabilities)) {
      manifest.interface.capabilities = manifest.interface.capabilities.map(value => needsTranslation(value) ? (cache[value] ?? value) : value);
    }
    await atomicJson(file, manifest);
  }
  return { manifests: manifests.length, newlyTranslated };
}

export async function syncChineseMarketplace() {
  await mkdir(targetRoot, { recursive: true });
  await cp(sourceRoot, translatedRoot, { recursive: true, force: true });
  const cache = await loadJson(cachePath, {});
  const translation = await translateManifests(await pluginManifestFiles(path.join(translatedRoot, 'plugins')), cache);
  await atomicJson(cachePath, cache);

  const marketplaceFile = path.join(translatedRoot, '.agents', 'plugins', 'marketplace.json');
  const marketplace = await loadJson(marketplaceFile, null);
  if (marketplace?.interface?.displayName && needsTranslation(marketplace.interface.displayName)) {
    marketplace.interface.displayName = cache[marketplace.interface.displayName] ?? await googleTranslate(marketplace.interface.displayName);
    await atomicJson(marketplaceFile, marketplace);
  }
  return { plugins: translation.manifests, newlyTranslated: translation.newlyTranslated, targetRoot: translatedRoot };
}

export async function applyChineseMarketplaceToRuntime() {
  const runtimeRoots = [
    'C:/Users/Administrator/.codex/.tmp/plugins',
    'C:/Users/Administrator/.codex-hidden/.tmp/plugins',
  ];
  for (const runtimeRoot of runtimeRoots) {
    await cp(translatedRoot, runtimeRoot, { recursive: true, force: true });
  }
  return { updatedCaches: runtimeRoots };
}

export async function translateActiveInstalledPlugins() {
  const activeRoots = [
    'C:/Users/Administrator/.codex/plugins',
    'C:/Users/Administrator/.codex/.tmp/bundled-marketplaces',
    'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/plugins',
  ];
  const cache = await loadJson(cachePath, {});
  const files = (await Promise.all(activeRoots.map(pluginManifestFiles))).flat();
  const result = await translateManifests(files, cache);
  await atomicJson(cachePath, cache);
  return { ...result, activeRoots };
}

if (globalThis.process?.argv?.[1] && path.resolve(globalThis.process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await syncChineseMarketplace();
  if (globalThis.process.argv.includes('--apply')) result.runtime = await applyChineseMarketplaceToRuntime();
  if (globalThis.process.argv.includes('--active')) result.installed = await translateActiveInstalledPlugins();
  console.log(result);
}

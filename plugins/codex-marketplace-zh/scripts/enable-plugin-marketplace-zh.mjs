import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const launcherPath = path.resolve(
  scriptDirectory,
  '..',
  'runtime',
  'codex-cn-stable-launcher.mjs',
);

async function main() {
  await access(launcherPath);
  const child = spawn(process.execPath, [launcherPath], {
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', error => {
    console.error(`无法启动 Codex 插件市场中文化运行时：${error.message}`);
    process.exitCode = 1;
  });
  child.on('close', code => {
    if (code && code !== 0) process.exitCode = code;
  });
}

main().catch(error => {
  console.error(`Codex 插件市场中文化启动失败：${error.message}`);
  process.exitCode = 1;
});

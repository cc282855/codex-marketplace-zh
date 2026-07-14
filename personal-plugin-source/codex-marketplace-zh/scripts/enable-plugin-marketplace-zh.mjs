import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const canonicalLauncher = 'E:/ZTY/CODEX存储目录/codex-cn-plugin-marketplace/codex-cn-stable-launcher.mjs';

async function main() {
  try {
    await access(canonicalLauncher);
  } catch {
    throw new Error('未找到中文插件翻译运行时：' + canonicalLauncher);
  }

  const child = spawn(process.execPath, [canonicalLauncher], {
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', error => {
    console.error('无法启动中文插件翻译器：' + error.message);
    process.exitCode = 1;
  });
  child.on('close', code => {
    if (code && code !== 0) process.exitCode = code;
  });
}

main().catch(error => {
  console.error('插件中文翻译器启动失败：' + error.message);
  process.exitCode = 1;
});

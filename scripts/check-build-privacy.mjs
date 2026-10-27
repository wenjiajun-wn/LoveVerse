import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.next');
let count = 0;
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await inspect(file);
    else if (item.name.endsWith('.nft.json')) {
      const trace = JSON.parse(await readFile(file, 'utf8')); count++;
      for (const value of trace.files || []) {
        const resolved = path.resolve(directory, value).replaceAll('\\', '/');
        if (/\/(private|test-results|playwright-report)\//.test(resolved) || /\/\.env[^/]*$/.test(resolved)) throw Error('构建依赖追踪包含私人目录、环境文件或测试产物');
      }
    }
  }
}
await inspect(root);
if (!count) throw Error('未找到构建追踪文件，请先运行 npm run build');
console.log(`已检查 ${count} 份构建追踪，未包含私人目录、环境文件或测试产物。`);

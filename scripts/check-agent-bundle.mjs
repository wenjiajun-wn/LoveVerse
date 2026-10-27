import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const forbidden = ['LOVEVERSE_BUILD_SECRET_CANARY_V3', 'process.env.DEEPSEEK_API_KEY'];
if (process.env.DEEPSEEK_API_KEY) forbidden.push(process.env.DEEPSEEK_API_KEY);
let checked = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|map|html|css)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      checked++;
      if (forbidden.some((secret) => text.includes(secret)))
        throw Error('客户端构建发现服务端密钥标识，已停止检查；不输出敏感内容');
    }
  }
}
await scan(path.resolve('.next/static'));
if (!checked) throw Error('请先构建项目');
console.log(`已检查 ${checked} 份客户端资源，未发现测试密钥标记或配置密钥。`);

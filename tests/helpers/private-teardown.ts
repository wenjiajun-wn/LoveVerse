import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
export default async function teardown() {
  const root = process.env.LOVEVERSE_E2E_DIR!;
  if (
    path.dirname(root) !== path.resolve(tmpdir()) ||
    !/^loveverse-e2e-[a-f0-9-]+$/.test(path.basename(root))
  )
    throw Error('测试目录校验失败');
  await fs.rm(root, { recursive: true, force: true });
}

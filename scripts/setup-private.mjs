import { mkdir, readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { resolve, join, dirname, parse, sep } from 'node:path';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
const root = resolve(process.env.LOVEVERSE_DATA_DIR || 'private');
if (
  root === process.cwd() ||
  ['public', 'src', '.next', '.git', 'node_modules'].some(
    (p) =>
      root.toLowerCase() === resolve(p).toLowerCase() ||
      root.toLowerCase().startsWith(resolve(p).toLowerCase() + sep),
  )
)
  throw Error('私人目录不能位于公开目录或源码目录');
let current = parse(root).root;
for (const part of root.slice(current.length).split(sep).filter(Boolean)) {
  current = join(current, part);
  try {
    if ((await lstat(current)).isSymbolicLink()) throw Error('不允许符号链接目录');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
const directory = join(root, 'auth');
try {
  if ((await lstat(directory)).isSymbolicLink()) throw Error('不允许符号链接账号目录');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
await mkdir(directory, { recursive: true, mode: 0o700 });
const file = join(directory, 'users.json');
try {
  await readFile(file);
  throw Error(
    '账号已存在。修改密码请先停服务，备份并移走 private/auth/users.json 后重新设置；旧会话自动失效。',
  );
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const cli = createInterface({ input: process.stdin, output: process.stdout });
const users = [];
const credentials = [];
try {
  for (let i = 0; i < 2; i++) {
    const email = (
      await cli.question(i === 0 ? '第一位成员邮箱：' : '第二位成员邮箱（回车跳过）：')
    )
      .trim()
      .toLowerCase();
    if (!email && i === 1) break;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 160 ||
      users.some((u) => u.email === email)
    )
      throw Error('邮箱无效或重复');
    const password = randomBytes(18).toString('base64url');
    const salt = randomBytes(16).toString('hex');
    const key = await new Promise((res, rej) =>
      scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
        err ? rej(err) : res(key),
      ),
    );
    users.push({ email, passwordHash: `scrypt$${salt}$${key.toString('hex')}` });
    credentials.push({ email, password });
  }
  const temp = join(dirname(file), `${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(users, null, 2), { flag: 'wx', mode: 0o600 });
  await rename(temp, file);
  console.log('账号已创建。以下随机密码仅显示这一次，请存入密码管理器，不要提交或分享终端输出。');
  for (const item of credentials) console.log(`${item.email}：${item.password}`);
  console.log('设置 LOVEVERSE_MODE=private 和 LOVEVERSE_ORIGIN 后启动。远程使用必须为 HTTPS。');
} finally {
  cli.close();
}

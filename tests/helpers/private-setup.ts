import { promises as fs } from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../../src/lib/auth/password';
export default async function setup() {
  const root = process.env.LOVEVERSE_E2E_DIR!;
  await fs.mkdir(path.join(root, 'auth'), { recursive: true });
  const passwordHash = await hashPassword('fixture-password-only-1234');
  await fs.writeFile(
    path.join(root, 'auth/users.json'),
    JSON.stringify([
      { email: 'first@example.test', passwordHash },
      { email: 'second@example.test', passwordHash },
    ]),
  );
}

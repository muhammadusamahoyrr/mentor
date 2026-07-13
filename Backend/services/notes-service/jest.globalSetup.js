// Creates a throwaway SQLite database and applies the real Prisma migrations to
// it, once, before the suite runs. Tests therefore exercise the actual schema
// (foreign keys, unique constraints and all) rather than a mock, and dev.db is
// never touched.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = () => {
  const testDb = path.join(__dirname, 'prisma', 'test.db');

  // Start from a clean slate so a previous run can't leak rows into this one.
  for (const f of [testDb, `${testDb}-journal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  execSync('npx prisma migrate deploy', {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  });
};

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs build script without types
import { neonSetupSql } from '../scripts/db-setup.mjs';

describe('db/neon-setup.sql (ADR-022)', () => {
  it('is up to date with db/migrations (run `node scripts/db-setup.mjs` after adding a migration)', () => {
    expect(fs.readFileSync('db/neon-setup.sql', 'utf8')).toBe((neonSetupSql as () => string)());
  });
  it('has the sign-up columns and no example accounts', () => {
    const sql = fs.readFileSync('db/neon-setup.sql', 'utf8');
    for (const col of ['password_hash', 'owner_name', 'store_name', 'phone', 'city']) expect(sql).toContain(`add column if not exists ${col}`);
    expect(sql).not.toMatch(/insert into (accounts|payments|merchant_daily|campaigns)/i);
  });
});

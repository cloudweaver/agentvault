#!/usr/bin/env tsx

import { createLogger } from '../utils/logger.js';
import { MIGRATIONS } from './postgres.js';

const logger = createLogger('migrate');

/**
 * Run database migrations
 * 
 * Usage:
 *   pnpm --filter runtime migrate
 *   pnpm --filter runtime migrate:up
 *   pnpm --filter runtime migrate:status
 */

interface MigrationRecord {
  version: number;
  name: string;
  applied_at: Date;
}

async function getMigrationStatus(pool: any): Promise<MigrationRecord[]> {
  // Create migrations table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const result = await pool.query('SELECT * FROM schema_migrations ORDER BY version');
  return result.rows;
}

async function runMigration(pool: any, migration: typeof MIGRATIONS[0]): Promise<void> {
  logger.info({ version: migration.version, name: migration.name }, 'Running migration');

  await pool.query('BEGIN');
  try {
    await pool.query(migration.sql);
    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
    await pool.query('COMMIT');
    logger.info({ version: migration.version }, 'Migration completed');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const command = process.argv[2] || 'up';
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // In production:
  // const { Pool } = await import('pg');
  // const pool = new Pool({ connectionString });

  logger.info({ command }, 'Starting migration');

  try {
    // const applied = await getMigrationStatus(pool);
    // const appliedVersions = new Set(applied.map(m => m.version));

    // switch (command) {
    //   case 'status':
    //     logger.info({ applied }, 'Current migration status');
    //     const pending = MIGRATIONS.filter(m => !appliedVersions.has(m.version));
    //     logger.info({ pending: pending.map(m => ({ version: m.version, name: m.name })) }, 'Pending migrations');
    //     break;

    //   case 'up':
    //     for (const migration of MIGRATIONS) {
    //       if (!appliedVersions.has(migration.version)) {
    //         await runMigration(pool, migration);
    //       }
    //     }
    //     logger.info('All migrations applied');
    //     break;

    //   default:
    //     logger.error({ command }, 'Unknown command');
    //     process.exit(1);
    // }

    logger.info('Migration script ready (pg package required for execution)');
    
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    // await pool.end();
  }
}

main();

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const configMap = new Map<string, string>();
let initialized = false;

export function initConfig(): void {
  if (initialized) throw new Error('Config already initialized');

  // ── Source 1: app.config.json (lowest priority, non-sensitive defaults) ──
  const configFilePath = path.resolve(__dirname, 'app.config.json');
  if (fs.existsSync(configFilePath)) {
    const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as Record<string, string>;
    for (const [key, value] of Object.entries(fileConfig)) {
      if (value !== undefined) configMap.set(key, String(value));
    }
  }

  // ── Source 2: .env (highest priority — overrides app.config.json) ────────
  dotenv.config();
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) configMap.set(key, value);
  }

  // ── Validation: sensitive keys must not appear in app.config.json ─────────
  // Imported lazily to avoid circular dependency at module load time
  const { CONFIG } = require('./keys') as typeof import('./keys');
  for (const entry of Object.values(CONFIG)) {
    if (entry.sensitive && fs.existsSync(configFilePath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) as Record<string, unknown>;
      if (fileConfig[entry.key] !== undefined) {
        throw new Error(`Sensitive config key "${entry.key}" must not be stored in app.config.json`);
      }
    }
    if (entry.required && entry.getValue() === undefined) {
      throw new Error(`Missing required config: ${entry.key}`);
    }
  }

  initialized = true;
}

export function getRawValue(key: string): string | undefined {
  return configMap.get(key);
}

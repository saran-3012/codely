import { getRawValue } from './loader';

class ConfigKey {
  constructor(
    readonly key: string,
    readonly required: boolean = false,
    readonly defaultValue?: string,
    readonly sensitive: boolean = false,
    readonly mutable: boolean = false,
  ) {
    Object.freeze(this);
  }

  getValue(): string | undefined {
    return getRawValue(this.key) ?? this.defaultValue;
  }

  getStringValue(): string {
    const val = this.getValue();
    if (val === undefined) throw new Error(`Missing required config: ${this.key}`);
    return val;
  }

  getIntegerValue(): number {
    const val = parseInt(this.getStringValue(), 10);
    if (isNaN(val)) throw new Error(`Config ${this.key} is not a valid integer`);
    return val;
  }

  getBooleanValue(): boolean {
    return this.getStringValue().toLowerCase() === 'true';
  }
}

//                                          key                         required  default        sensitive  mutable
export const CONFIG = Object.freeze({
  // ── Sensitive + immutable (env only) ──────────────────────────────────────
  DATABASE_URL:             new ConfigKey('DATABASE_URL',             true,  undefined,     true,  false),
  JWT_SECRET:               new ConfigKey('JWT_SECRET',               true,  undefined,     true,  false),
  REFRESH_TOKEN_SECRET:     new ConfigKey('REFRESH_TOKEN_SECRET',     true,  undefined,     true,  false),

  // ── Non-sensitive + immutable (app.config.json) ────────────────────────────
  PORT:                     new ConfigKey('PORT',                     false, '3000',        false, false),
  NODE_ENV:                 new ConfigKey('NODE_ENV',                 false, 'development', false, false),
  FRONTEND_URL:             new ConfigKey('FRONTEND_URL',             false, 'http://localhost:5173,http://localhost:5174', false, false),
  BCRYPT_ROUNDS:            new ConfigKey('BCRYPT_ROUNDS',            false, '12',          false, false),
  ACCESS_TOKEN_EXPIRY:      new ConfigKey('ACCESS_TOKEN_EXPIRY',      false, '15m',         false, false),
  REFRESH_TOKEN_EXPIRY:     new ConfigKey('REFRESH_TOKEN_EXPIRY',     false, '7d',          false, false),
  REFRESH_TOKEN_MAX_AGE_MS: new ConfigKey('REFRESH_TOKEN_MAX_AGE_MS', false, '604800000',   false, false),

  // ── Non-sensitive + mutable (can be updated at runtime in future) ──────────
  PISTON_URL:               new ConfigKey('PISTON_URL',               false, undefined,    false, true),
  RATE_LIMIT_WINDOW_MS:     new ConfigKey('RATE_LIMIT_WINDOW_MS',     false, '900000',      false, true),
  RATE_LIMIT_MAX:           new ConfigKey('RATE_LIMIT_MAX',           false, '10',          false, true),
  EXEC_TIMEOUT_MS:          new ConfigKey('EXEC_TIMEOUT_MS',          false, '10000',       false, true),
} satisfies Record<string, ConfigKey>);

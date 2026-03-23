import { Router } from 'express';
import axios from 'axios';
import { exec } from 'child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { ValidationError, AppError } from '../lib/errors';
import { asyncHandler } from '../lib/asyncHandler';
import { Permission } from '../lib/acl';
import { logger } from '../lib/logger';

const execAsync = promisify(exec);
const router = Router();

import { CONFIG } from '../config';

const EXEC_TIMEOUT    = CONFIG.EXEC_TIMEOUT_MS.getIntegerValue();
const PISTON_URL      = CONFIG.PISTON_URL.getValue();

// ── Sandbox constants ─────────────────────────────────────────────────────────
// Applied only on Linux (production containers). macOS (dev) uses plain exec.
const SANDBOX_MEM_KB      = 256 * 1024;   // 256 MB virtual memory cap
const SANDBOX_FILE_BLOCKS = 20_480;        // 10 MB max file write (512-byte blocks)
const SANDBOX_MAX_PROCS   = 32;            // fork-bomb protection
const SANDBOX_MAX_FDS     = 64;            // max open file descriptors
const OUTPUT_MAX_BYTES    = 100 * 1024;    // 100 KB stdout/stderr cap

/**
 * Wraps a shell command with ulimit-based resource limits (Linux only).
 * Limits: virtual memory, file size, CPU time, process count, file descriptors.
 * The parent process is unaffected — limits live only inside the spawned subshell.
 */
function sandboxCmd(cmd: string, cpuTimeSec: number): string {
  if (process.platform !== 'linux') return cmd;
  const escaped = cmd.replace(/'/g, `'\\''`);
  return (
    `sh -c 'ulimit -v ${SANDBOX_MEM_KB} ` +
    `&& ulimit -f ${SANDBOX_FILE_BLOCKS} ` +
    `&& ulimit -t ${cpuTimeSec} ` +
    `&& ulimit -u ${SANDBOX_MAX_PROCS} ` +
    `&& ulimit -n ${SANDBOX_MAX_FDS} ` +
    `&& ${escaped}'`
  );
}

/** Env passed to every sandboxed subprocess — strips all host secrets. */
function safeEnv(tmpDir: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    HOME: tmpDir,     // redirect HOME so code can't find ~/.ssh, ~/.aws etc.
    TMPDIR: tmpDir,
    LANG: 'C',
    TERM: 'dumb',
  };
}

// Resolve the ts-node binary bundled with ts-node-dev
const TS_NODE = resolve(__dirname, '../../node_modules/.bin/ts-node');

interface LangConfig {
  filename: string;
  buildCmd?: (dir: string) => string;
  runCmd: (dir: string) => string;
  version: string;
}

const LANG_MAP: Record<string, LangConfig> = {
  python: {
    filename: 'main.py',
    runCmd: (dir) => `python3 "${join(dir, 'main.py')}"`,
    version: '3.x',
  },
  javascript: {
    filename: 'main.js',
    runCmd: (dir) => `node "${join(dir, 'main.js')}"`,
    version: process.version,
  },
  typescript: {
    filename: 'main.ts',
    runCmd: (dir) => `"${TS_NODE}" --transpile-only "${join(dir, 'main.ts')}"`,
    version: '5.x',
  },
  'c++': {
    filename: 'main.cpp',
    buildCmd: (dir) => `g++ "${join(dir, 'main.cpp')}" -o "${join(dir, 'main')}"`,
    runCmd: (dir) => `"${join(dir, 'main')}"`,
    version: 'g++',
  },
  c: {
    filename: 'main.c',
    buildCmd: (dir) => `gcc "${join(dir, 'main.c')}" -o "${join(dir, 'main')}"`,
    runCmd: (dir) => `"${join(dir, 'main')}"`,
    version: 'gcc',
  },
  java: {
    filename: 'Main.java',
    buildCmd: (dir) => `javac "${join(dir, 'Main.java')}"`,
    runCmd: (dir) => `java -cp "${dir}" Main`,
    version: 'openjdk',
  },
  go: {
    filename: 'main.go',
    runCmd: (dir) => `go run "${join(dir, 'main.go')}"`,
    version: '1.x',
  },
  rust: {
    filename: 'main.rs',
    buildCmd: (dir) => `rustc "${join(dir, 'main.rs')}" -o "${join(dir, 'main')}"`,
    runCmd: (dir) => `"${join(dir, 'main')}"`,
    version: 'rustc',
  },
};

router.post('/', authMiddleware, requirePermission(Permission.CODE_EXECUTE), asyncHandler<AuthRequest>(async (req, res) => {
  const { language, version, code } = req.body;
  const langKey = (language as string)?.toLowerCase();

  if (!langKey || !code) throw new ValidationError('language and code are required', 'MISSING_FIELDS');

  // ── Try self-hosted Piston first ─────────────────────────────
  if (PISTON_URL) {
    try {
      const response = await axios.post(`${PISTON_URL}/execute`, {
        language: langKey,
        version: version || '*',
        files: [{ content: code }],
      });
      res.json(response.data);
      return;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Piston is reachable but rejected the request — propagate as-is.
          throw new AppError(
            error.response.status,
            'PISTON_ERROR',
            (error.response.data as { message?: string })?.message || 'Execution failed'
          );
        }
        // Network error (ECONNREFUSED / ETIMEDOUT) — Piston is down.
        // Fall through to local sandboxed execution.
        logger.warn('Piston unreachable, falling back to local sandbox', {
          url: PISTON_URL,
          error: error.message,
        });
      } else {
        throw error;
      }
    }
  }

  // ── Local sandboxed fallback ──────────────────────────────────
  // Restrictions applied to every subprocess:
  //   • Isolated temp directory (HOME redirected, cwd confined)
  //   • No host secrets in env (DATABASE_URL, JWT_SECRET etc. stripped)
  //   • Virtual memory cap (256 MB) — prevents memory bombs
  //   • File write cap (10 MB) — prevents disk exhaustion
  //   • CPU time cap — prevents infinite loops hogging CPU
  //   • Process count cap (32) — prevents fork bombs
  //   • File descriptor cap (64) — prevents fd exhaustion
  //   • Output capped at 100 KB — prevents log/buffer flooding
  //   • Wall-clock timeout from EXEC_TIMEOUT_MS config
  //   • (Linux only — ulimit flags are no-ops on macOS dev machines)
  const config = LANG_MAP[langKey];
  if (!config) throw new ValidationError(`Unsupported language: ${langKey}`, 'UNSUPPORTED_LANGUAGE');

  const cpuTimeSec = Math.ceil(EXEC_TIMEOUT / 1000);
  const execOpts = (dir: string) => ({
    timeout: EXEC_TIMEOUT,
    cwd: dir,
    env: safeEnv(dir),
    maxBuffer: OUTPUT_MAX_BYTES,
  });

  const tmpDir = mkdtempSync(join(tmpdir(), 'codely-'));
  try {
    writeFileSync(join(tmpDir, config.filename), code, 'utf8');

    // Compile step (not sandboxed — runs trusted toolchain binaries)
    if (config.buildCmd) {
      try {
        await execAsync(config.buildCmd(tmpDir), execOpts(tmpDir));
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string };
        const output = (e.stderr || e.stdout || String(err)).trim();
        res.json({
          language: langKey,
          version: config.version,
          run: { stdout: '', stderr: output, output, code: 1, signal: null },
        });
        return;
      }
    }

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let signal: string | null = null;

    try {
      const result = await execAsync(
        sandboxCmd(config.runCmd(tmpDir), cpuTimeSec),
        execOpts(tmpDir)
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number; signal?: string; killed?: boolean };
      stdout = e.stdout || '';
      stderr = e.stderr || '';
      exitCode = e.killed ? 124 : (e.code ?? 1);
      signal = e.signal || null;
    }

    res.json({
      language: langKey,
      version: config.version,
      run: { stdout, stderr, output: stdout + stderr, code: exitCode, signal },
    });
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}));

export default router;

import { Router, Response } from 'express';
import axios from 'axios';
import { exec } from 'child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const execAsync = promisify(exec);
const router = Router();

const EXEC_TIMEOUT = 10_000;
const PISTON_URL = process.env.PISTON_URL;

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

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { language, version, code } = req.body;
  const langKey = (language as string)?.toLowerCase();

  if (!langKey || !code) {
    res.status(400).json({ error: 'language and code are required' });
    return;
  }

  // ── Use self-hosted Piston when available (Docker) ───────────
  if (PISTON_URL) {
    try {
      const response = await axios.post(`${PISTON_URL}/execute`, {
        language: langKey,
        version: version || '*',
        files: [{ content: code }],
      });
      res.json(response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        res.status(error.response.status).json({ error: error.response.data });
      } else {
        res.status(500).json({ error: 'Failed to execute code' });
      }
    }
    return;
  }

  // ── Local fallback (no Docker) ────────────────────────────────
  const config = LANG_MAP[langKey];
  if (!config) {
    res.status(400).json({ error: `Unsupported language: ${langKey}` });
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'codely-'));
  try {
    writeFileSync(join(tmpDir, config.filename), code, 'utf8');

    // Compile if needed
    if (config.buildCmd) {
      try {
        await execAsync(config.buildCmd(tmpDir), { timeout: EXEC_TIMEOUT });
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
      const result = await execAsync(config.runCmd(tmpDir), { timeout: EXEC_TIMEOUT, cwd: tmpDir });
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
});

export default router;

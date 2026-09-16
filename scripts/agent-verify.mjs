#!/usr/bin/env node

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_CAPTURED_OUTPUT_BYTES = 1_000_000;

const checks = [
  {
    key: 'expo-deps',
    label: 'Expo dependency compatibility',
    command: 'pnpm',
    args: ['exec', 'expo', 'install', '--check'],
  },
  {
    key: 'expo-doctor',
    label: 'Expo Doctor',
    command: 'pnpm',
    args: ['exec', 'expo-doctor'],
  },
  {
    key: 'android-prebuild',
    label: 'Android prebuild',
    command: 'pnpm',
    args: ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'],
  },
  {
    key: 'format',
    label: 'Prettier',
    command: 'pnpm',
    args: ['format:check'],
  },
  {
    key: 'typecheck',
    label: 'TypeScript',
    command: 'pnpm',
    args: ['typecheck'],
  },
  {
    key: 'lint',
    label: 'ESLint',
    command: 'pnpm',
    args: ['lint'],
  },
  {
    key: 'i18n-parity',
    label: 'i18n key parity',
    command: 'node',
    args: ['scripts/verify-i18n-parity.mjs'],
  },
  {
    key: 'whats-new-registry',
    label: "What's New registry drift",
    command: 'node',
    args: ['scripts/verify-whats-new-registry.mjs'],
  },
  {
    key: 'maestro-flows',
    label: 'Maestro flow integrity',
    command: 'node',
    args: ['scripts/verify-maestro-flows.mjs'],
  },
  {
    key: 'test',
    label: 'Jest',
    command: 'pnpm',
    args: ['test:agent'],
  },
  {
    key: 'e2e-tools',
    label: 'Android E2E tooling',
    command: 'pnpm',
    args: ['test:e2e:tools:agent'],
  },
  {
    key: 'e2e-addon-types',
    label: 'E2E add-on TypeScript',
    command: 'pnpm',
    args: ['--filter', '@dodostream/e2e-addon', 'typecheck'],
  },
  {
    key: 'e2e-addon',
    label: 'E2E add-on tests',
    command: 'pnpm',
    args: ['--filter', '@dodostream/e2e-addon', 'test:agent'],
  },
];

const usage = `Usage: pnpm verify:agent [--only <keys>] [--json] [--verbose]

Runs the same checks as pnpm verify:ci with terse, phase-scoped output.

Options:
  --only <keys>  Comma-separated check keys to run
  --json         Emit newline-delimited JSON status events
  --verbose      Stream child-command output instead of retaining it for failures
  --list         Print check keys
  --help         Print this help

Check keys: ${checks.map(({ key }) => key).join(', ')}`;

const failUsage = (message) => {
  process.stderr.write(`${message}\n\n${usage}\n`);
  process.exitCode = 2;
};

const parseOptions = (args) => {
  const options = { json: false, only: null, verbose: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help') return { help: true };
    if (arg === '--list') return { list: true };
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }
    if (arg === '--only') {
      const value = args[index + 1];
      if (!value || value.startsWith('--'))
        return { error: '--only requires at least one check key' };
      options.only = value.split(',').filter(Boolean);
      index += 1;
      continue;
    }
    if (arg.startsWith('--only=')) {
      options.only = arg.slice('--only='.length).split(',').filter(Boolean);
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  if (options.json && options.verbose) {
    return { error: '--json and --verbose cannot be used together' };
  }

  return options;
};

const commandText = ({ command, args }) => [command, ...args].join(' ');

const runCheck = (check, { verbose }) =>
  new Promise((resolve) => {
    const output = [];
    let capturedOutputBytes = 0;
    let outputTruncated = false;
    const startedAt = Date.now();
    const child = spawn(check.command, check.args, {
      cwd: ROOT,
      env: {
        ...process.env,
        CI: 'true',
        EXPO_NO_TELEMETRY: '1',
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const collect = (stream, target) => {
      stream.on('data', (chunk) => {
        if (verbose) {
          target.write(chunk);
          return;
        }

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remainingBytes = MAX_CAPTURED_OUTPUT_BYTES - capturedOutputBytes;
        if (remainingBytes <= 0) {
          outputTruncated = true;
          return;
        }

        const capturedChunk = buffer.subarray(0, remainingBytes);
        output.push(capturedChunk);
        capturedOutputBytes += capturedChunk.length;
        outputTruncated ||= capturedChunk.length < buffer.length;
      });
    };

    const capturedOutput = () => {
      if (verbose) return '';

      const suffix = outputTruncated
        ? `\n[agent verifier truncated output after ${MAX_CAPTURED_OUTPUT_BYTES} bytes]\n`
        : '';
      return `${Buffer.concat(output).toString()}${suffix}`;
    };

    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);

    child.once('error', (error) => {
      resolve({
        command: commandText(check),
        durationMs: Date.now() - startedAt,
        error: error.message,
        key: check.key,
        label: check.label,
        ok: false,
        output: capturedOutput(),
      });
    });
    child.once('close', (code, signal) => {
      resolve({
        code,
        command: commandText(check),
        durationMs: Date.now() - startedAt,
        key: check.key,
        label: check.label,
        ok: code === 0,
        output: capturedOutput(),
        signal,
      });
    });
  });

const printEvent = (event, json) => {
  if (json) {
    const { output: _output, ...jsonEvent } = event;
    process.stdout.write(`${JSON.stringify(jsonEvent)}\n`);
    return;
  }

  if (event.event === 'start') {
    process.stdout.write(`… ${event.label}\n`);
    return;
  }

  if (event.event === 'check') {
    const symbol = event.ok ? '✓' : '✗';
    process.stdout.write(`${symbol} ${event.label} (${(event.durationMs / 1000).toFixed(1)}s)\n`);
    return;
  }

  process.stdout.write(
    `${event.ok ? '✓' : '✗'} Agent verification ${event.ok ? 'passed' : 'failed'} (${(
      event.durationMs / 1000
    ).toFixed(1)}s)\n`
  );
};

const options = parseOptions(process.argv.slice(2));
if (options.error) {
  failUsage(options.error);
} else if (options.help) {
  process.stdout.write(`${usage}\n`);
} else if (options.list) {
  process.stdout.write(`${checks.map(({ key }) => key).join('\n')}\n`);
} else {
  const selectedChecks = options.only
    ? checks.filter(({ key }) => options.only.includes(key))
    : checks;
  const unknownKeys =
    options.only?.filter((key) => !checks.some((check) => check.key === key)) ?? [];

  if (unknownKeys.length > 0) {
    failUsage(`Unknown check key(s): ${unknownKeys.join(', ')}`);
  } else if (selectedChecks.length === 0) {
    failUsage('No checks selected');
  } else {
    const startedAt = Date.now();
    let failed = false;

    for (const check of selectedChecks) {
      printEvent({ event: 'start', key: check.key, label: check.label }, options.json);
      const result = await runCheck(check, options);
      printEvent({ event: 'check', ...result }, options.json);

      if (!result.ok) {
        failed = true;
        const failureOutput = result.output || result.error;
        if (failureOutput) {
          process.stderr.write(`\n${result.command}\n${failureOutput}`);
        }
        break;
      }
    }

    printEvent(
      {
        event: 'summary',
        durationMs: Date.now() - startedAt,
        ok: !failed,
      },
      options.json
    );
    process.exitCode = failed ? 1 : 0;
  }
}

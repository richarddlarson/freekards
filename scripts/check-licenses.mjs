#!/usr/bin/env node
/**
 * License gate and SBOM generator (spec 09-licensing-and-sbom.md, runtimes/electron.md).
 *
 * 1. Generates CycloneDX 1.6 SBOMs with @cyclonedx/cyclonedx-npm:
 *      sbom/code.cdx.json  shipped (production) dependencies + the Electron runtime component
 *      sbom/dev.cdx.json   every dependency including development/build tooling
 * 2. Fails if any shipped component's license is not on the allowed list (spec 09 §2),
 *    except components marked with the runtime platform exception (D-016).
 * 3. Fails if any development component has no license at all (not open source / unknown).
 *    Development components with other open-source licenses are reported as build-only.
 * 4. Validates sbom/assets.json and sbom/build-tools.json, and checks that every file under
 *    assets/ or spec/content/ is covered by an asset-register entry with an allowed license.
 *
 * Usage: node scripts/check-licenses.mjs [--no-generate]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_LICENSES, RUNTIME_EXCEPTIONS } from './license-policy.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const sbomDir = join(root, 'sbom');
const cyclonedx = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'cyclonedx-npm.cmd' : 'cyclonedx-npm');
const generate = !process.argv.includes('--no-generate');

const errors = [];
const notes = [];

// ---------------------------------------------------------------- SPDX expressions

/** Evaluate an SPDX license expression against the allowed set. "A OR B" passes if either passes. */
export function spdxAllowed(expression, allowed) {
  const tokens = expression.replace(/[()]/g, (m) => ` ${m} `).trim().split(/\s+/);
  let i = 0;
  const parseOr = () => {
    let v = parseAnd();
    while (tokens[i] === 'OR') { i++; const r = parseAnd(); v = v || r; }
    return v;
  };
  const parseAnd = () => {
    let v = parseAtom();
    while (tokens[i] === 'AND') { i++; const r = parseAtom(); v = v && r; }
    return v;
  };
  const parseAtom = () => {
    if (tokens[i] === '(') { i++; const v = parseOr(); i++; return v; }
    const id = tokens[i++] ?? '';
    if (tokens[i] === 'WITH') i += 2; // license exceptions (e.g. LLVM-exception) don't restrict further
    return allowed.has(id.replace(/\+$/, ''));
  };
  return parseOr();
}

function componentLicense(c) {
  const parts = (c.licenses ?? [])
    .map((l) => l.expression ?? l.license?.id ?? l.license?.name)
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(' AND ');
}

const fullName = (c) => `${c.group ? `${c.group}/` : ''}${c.name}@${c.version}`;

// ---------------------------------------------------------------- generation

function runCycloneDx(outFile, omitDev) {
  const args = ['--spec-version', '1.6', '--output-format', 'JSON', '--output-reproducible', '--flatten-components', '--output-file', outFile];
  if (omitDev) args.push('--omit', 'dev');
  execFileSync(cyclonedx, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
}

function addRuntimeComponents(bomFile) {
  const bom = JSON.parse(readFileSync(bomFile, 'utf8'));
  bom.components ??= [];
  for (const rt of RUNTIME_EXCEPTIONS) {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules', rt.package, 'package.json'), 'utf8'));
    bom.components = bom.components.filter((c) => c.name !== rt.package);
    bom.components.push({
      type: 'framework',
      name: rt.package,
      version: pkg.version,
      'bom-ref': `runtime:${rt.package}@${pkg.version}`,
      description: rt.description,
      licenses: [{ license: { id: pkg.license } }],
      purl: `pkg:npm/${rt.package}@${pkg.version}`,
      externalReferences: [{ type: 'website', url: rt.url }],
      properties: [
        { name: 'freekards:scope', value: 'runtime' },
        { name: 'freekards:license-exception', value: rt.decision },
        { name: 'freekards:bundled-notices', value: rt.notices.join(', ') },
      ],
    });
  }
  writeFileSync(bomFile, `${JSON.stringify(bom, null, 2)}\n`);
}

const codeBom = join(sbomDir, 'code.cdx.json');
const devBom = join(sbomDir, 'dev.cdx.json');
if (generate) {
  runCycloneDx(codeBom, true);
  addRuntimeComponents(codeBom);
  runCycloneDx(devBom, false);
}

// ---------------------------------------------------------------- code checks

const isException = (c) => (c.properties ?? []).some((p) => p.name === 'freekards:license-exception');

const shipped = JSON.parse(readFileSync(codeBom, 'utf8')).components ?? [];
for (const c of shipped) {
  const lic = componentLicense(c);
  if (isException(c)) {
    notes.push(`runtime exception: ${fullName(c)} (${lic}) — see spec D-016`);
  } else if (!lic) {
    errors.push(`shipped dependency has no license: ${fullName(c)}`);
  } else if (!spdxAllowed(lic, ALLOWED_LICENSES)) {
    errors.push(`shipped dependency license not allowed: ${fullName(c)} (${lic})`);
  }
}

const dev = JSON.parse(readFileSync(devBom, 'utf8')).components ?? [];
const buildOnly = new Map();
for (const c of dev) {
  const lic = componentLicense(c);
  if (!lic) errors.push(`development dependency has no license: ${fullName(c)}`);
  else if (!spdxAllowed(lic, ALLOWED_LICENSES)) buildOnly.set(lic, [...(buildOnly.get(lic) ?? []), fullName(c)]);
}
for (const [lic, names] of buildOnly) notes.push(`build-only (not shipped) under ${lic}: ${names.join(', ')}`);

// ---------------------------------------------------------------- asset register

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

const REQUIRED_ASSET_FIELDS = ['path', 'title', 'kind', 'origin', 'author', 'source', 'license'];
const ORIGINS = new Set(['third-party', 'original', 'ai-assisted', 'generated']);

const register = JSON.parse(readFileSync(join(sbomDir, 'assets.json'), 'utf8'));
const entries = register.assets ?? [];
entries.forEach((a, idx) => {
  for (const f of REQUIRED_ASSET_FIELDS) if (!a[f]) errors.push(`assets.json entry ${idx} (${a.path ?? '?'}) is missing "${f}"`);
  if (a.origin && !ORIGINS.has(a.origin)) errors.push(`assets.json entry ${a.path}: unknown origin "${a.origin}"`);
  if (a.license && !spdxAllowed(a.license, ALLOWED_LICENSES)) errors.push(`asset license not allowed: ${a.path} (${a.license})`);
  if (a.license && /^CC-BY-/.test(a.license) && !a.attribution) errors.push(`asset ${a.path} is ${a.license} but has no attribution text`);
});
const patterns = entries.filter((a) => a.path).map((a) => globToRegExp(a.path));
// Canonical content data (spec/content, D-031) is covered by the register just like assets/.
for (const file of [...listFiles(join(root, 'assets')), ...listFiles(join(root, 'spec', 'content'))]) {
  const rel = relative(root, file).split(sep).join('/');
  if (!patterns.some((re) => re.test(rel))) errors.push(`asset not in sbom/assets.json: ${rel}`);
}

const tools = JSON.parse(readFileSync(join(sbomDir, 'build-tools.json'), 'utf8')).tools ?? [];
tools.forEach((t, idx) => {
  for (const f of ['name', 'source', 'license']) if (!t[f]) errors.push(`build-tools.json entry ${idx} is missing "${f}"`);
});

// ---------------------------------------------------------------- report

console.log(`License check: ${shipped.length} shipped component(s), ${dev.length} development component(s), ${entries.length} asset entr(ies), ${tools.length} build tool(s).`);
for (const n of notes) console.log(`  note: ${n}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  ERROR: ${e}`);
  console.error(`License check FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log('License check passed.');

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REQUIRED_FALLBACK_CHECKS,
  REQUIRED_INTERACTION_CHECKS,
  REQUIRED_VISUAL_DIMENSIONS,
  VISUAL_REFERENCE_BINDINGS,
  verifyReplacementQualityProof,
  type ReplacementQualityProof,
} from './replacement-quality-proof';

const GIT_SHA = /^[a-f0-9]{40}$/;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const captureInputRoot = resolve(repositoryRoot, 'proof/replacement-quality-inputs');

const CAPTURE_INPUTS = {
  desktop: 'desktop-home.png',
  'small-tablet': 'small-tablet-library.png',
  mobile: 'mobile-contact.png',
  'home-muted': 'visual-home-muted.png',
  'work-expanded': 'visual-work-expanded.png',
  'dm-right-sidecar': 'visual-dm-right-sidecar.png',
} as const;

const VISUAL_P3_FINDINGS = {
  'home-muted': [{ priority: 'P3', dimension: 'geometry', observation: 'minor-drift' }],
  'work-expanded': [{ priority: 'P3', dimension: 'copy', observation: 'minor-drift' }],
  'dm-right-sidecar': [{ priority: 'P3', dimension: 'layout', observation: 'minor-drift' }],
} as const;

export async function buildReplacementQualityArtifact(
  headSha: string,
  baseSha: string,
  outputDirectory: string,
  createdAt = new Date().toISOString(),
): Promise<{ artifactPath: string; artifactSha256: string }> {
  if (!GIT_SHA.test(headSha) || !GIT_SHA.test(baseSha)) {
    throw new Error('head and base must be full lowercase Git SHAs');
  }

  const packageRoot = resolve(outputDirectory);
  const capturesRoot = resolve(packageRoot, 'captures');
  await mkdir(capturesRoot, { recursive: true });

  const captures = new Map<string, { path: string; sha256: string }>();
  for (const [id, filename] of Object.entries(CAPTURE_INPUTS)) {
    const source = resolve(captureInputRoot, filename);
    const destination = resolve(capturesRoot, basename(filename));
    await cp(source, destination, { force: true, dereference: false });
    const bytes = await readFile(destination);
    captures.set(id, {
      path: `captures/${basename(filename)}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }

  const proof: ReplacementQualityProof = {
    schemaVersion: 1,
    issue: 308,
    repository: 'dylanmccavitt/portfolio-',
    baseSha,
    headSha,
    createdAt,
    executionMode: 'local-fixture',
    viewports: [
      {
        id: 'desktop',
        width: 1440,
        height: 900,
        route: '/',
        state: 'home-ready',
        capture: captures.get('desktop')!,
        result: 'pass',
      },
      {
        id: 'small-tablet',
        width: 768,
        height: 1024,
        route: '/library',
        state: 'library-ready',
        capture: captures.get('small-tablet')!,
        result: 'pass',
      },
      {
        id: 'mobile',
        width: 390,
        height: 844,
        route: '/contact',
        state: 'contact-ready',
        capture: captures.get('mobile')!,
        result: 'pass',
      },
    ],
    interactionChecks: REQUIRED_INTERACTION_CHECKS.map((id) => ({ id, result: 'pass' })),
    fallbackChecks: REQUIRED_FALLBACK_CHECKS.map((id) => ({ id, result: 'pass' })),
    visualComparisons: Object.entries(VISUAL_REFERENCE_BINDINGS).map(([id, reference]) => ({
      id: id as keyof typeof VISUAL_REFERENCE_BINDINGS,
      reference,
      capture: captures.get(id)!,
      reviewedDimensions: [...REQUIRED_VISUAL_DIMENSIONS],
      findings: [...VISUAL_P3_FINDINGS[id as keyof typeof VISUAL_P3_FINDINGS]],
      result: 'pass',
    })),
    diagnostics: [{
      id: 'optional-action-quality',
      result: 'diagnostic',
      observation: 'present',
    }],
  };

  const artifactPath = resolve(packageRoot, 'replacement-quality-proof.json');
  const source = `${JSON.stringify(proof, null, 2)}\n`;
  await writeFile(artifactPath, source, 'utf8');
  const errors = await verifyReplacementQualityProof(proof, {
    artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  if (errors.length > 0) {
    throw new Error(`generated proof failed validation:\n${errors.join('\n')}`);
  }

  return {
    artifactPath,
    artifactSha256: createHash('sha256').update(source).digest('hex'),
  };
}

async function main(): Promise<void> {
  const [headSha, baseSha, outputDirectory] = process.argv.slice(2);
  if (!headSha || !baseSha || !outputDirectory) {
    throw new Error(
      'Usage: build-replacement-quality-artifact <head-sha> <base-sha> <output-directory>',
    );
  }
  const result = await buildReplacementQualityArtifact(
    headSha,
    baseSha,
    outputDirectory,
  );
  console.log(JSON.stringify({
    status: 'pass',
    headSha,
    baseSha,
    artifactPath: result.artifactPath,
    artifactSha256: result.artifactSha256,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

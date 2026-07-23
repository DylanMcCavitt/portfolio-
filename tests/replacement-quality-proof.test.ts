import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  REQUIRED_FALLBACK_CHECKS,
  REQUIRED_INTERACTION_CHECKS,
  REQUIRED_VIEWPORTS,
  REQUIRED_VISUAL_DIMENSIONS,
  VISUAL_REFERENCE_BINDINGS,
  verifyReplacementQualityProof,
  type ReplacementQualityProof,
} from '../scripts/replacement-quality-proof';
import { buildReplacementQualityArtifact } from '../scripts/build-replacement-quality-artifact';

const repositoryRoot = resolve(new URL('..', import.meta.url).pathname);
const headSha = 'a'.repeat(40);
const baseSha = 'c'.repeat(40);

test('sanitized exact-head browser and visual proof passes every required gate', async (t) => {
  const fixture = await createFixture(t);
  const errors = await verifyReplacementQualityProof(fixture.proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.deepEqual(errors, []);
});

test('material drift, stale heads, missing checks, and sensitive fields fail closed', async (t) => {
  const fixture = await createFixture(t);
  const unsafe = structuredClone(fixture.proof) as ReplacementQualityProof & {
    prompt?: string;
  };
  unsafe.headSha = 'b'.repeat(40);
  unsafe.interactionChecks = unsafe.interactionChecks.filter((check) => check.id !== 'cancellation');
  unsafe.visualComparisons[0]!.findings.push({
    priority: 'P2',
    dimension: 'layout',
    observation: 'minor-drift',
  } as never);
  unsafe.prompt = 'must never persist';

  const errors = await verifyReplacementQualityProof(unsafe, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.ok(errors.some((error) => error.includes('exact current head')));
  assert.ok(errors.some((error) => error.includes('cancellation exactly once')));
  assert.ok(errors.some((error) => error.includes('material P2 drift')));
  assert.ok(errors.some((error) => error.includes('prompt is forbidden')));
});

test('optional action quality remains diagnostic and never becomes a presence veto', async (t) => {
  const fixture = await createFixture(t);
  fixture.proof.diagnostics[0]!.observation = 'absent';
  const errors = await verifyReplacementQualityProof(fixture.proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.deepEqual(errors, []);
});

test('visual captures must be readable PNGs at the exact gate dimensions', async (t) => {
  const fixture = await createFixture(t);
  const text = Buffer.from('not an image');
  await writeFile(join(fixture.directory, 'not-an-image.txt'), text);
  fixture.proof.visualComparisons[0]!.capture = {
    path: 'not-an-image.txt',
    sha256: sha256(text),
  };
  fixture.proof.visualComparisons[1]!.capture = fixture.captures.get('mobile')!;
  const corrupt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
  await writeFile(join(fixture.directory, 'corrupt.png'), corrupt);
  fixture.proof.visualComparisons[2]!.capture = {
    path: 'corrupt.png',
    sha256: sha256(corrupt),
  };

  const errors = await verifyReplacementQualityProof(fixture.proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.ok(errors.some((error) => error.includes('home-muted.capture must be a readable PNG')));
  assert.ok(errors.some((error) => error.includes('work-expanded.capture must be 1440x900')));
  assert.ok(errors.some((error) => error.includes('dm-right-sidecar.capture must be a readable PNG')));
});

test('capture paths reject direct and parent-directory symlinks', async (t) => {
  const fixture = await createFixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'replacement-quality-outside-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(outside, { recursive: true, force: true });
  });
  const outsideCapture = fixture.captures.get('desktop')!;
  const bytes = await readCapture(fixture.directory, outsideCapture.path);
  await writeFile(join(outside, 'outside.png'), bytes);
  await symlink(join(outside, 'outside.png'), join(fixture.directory, 'escape.png'));
  await symlink(outside, join(fixture.directory, 'escape-directory'));

  fixture.proof.viewports[0]!.capture = {
    path: 'escape.png',
    sha256: sha256(bytes),
  };
  fixture.proof.visualComparisons[0]!.capture = {
    path: 'escape-directory/outside.png',
    sha256: sha256(bytes),
  };

  const errors = await verifyReplacementQualityProof(fixture.proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.ok(errors.some((error) => error.includes('desktop.capture must use a safe relative path')));
  assert.ok(errors.some((error) => error.includes('home-muted.capture must use a safe relative path')));
});

test('runtime schema rejects unknown keys at every object level and private text', async (t) => {
  const fixture = await createFixture(t);
  const proof = fixture.proof as ReplacementQualityProof & Record<string, unknown>;
  proof.unexpectedVisitorText = 'private visitor statement';
  Object.assign(proof.viewports[0]!, { extra: 'private viewport note' });
  Object.assign(proof.viewports[0]!.capture, { extra: 'private capture note' });
  Object.assign(proof.interactionChecks[0]!, { extra: 'private interaction note' });
  Object.assign(proof.visualComparisons[0]!, { extra: 'private comparison note' });
  proof.visualComparisons[0]!.findings.push({
    priority: 'P3',
    dimension: 'layout',
    observation: 'minor-drift',
    extra: 'private finding note',
  } as never);
  Object.assign(proof.diagnostics[0]!, { extra: 'private diagnostic note' });

  const errors = await verifyReplacementQualityProof(proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  for (const path of [
    '$.unexpectedVisitorText',
    '$.viewports[0].extra',
    '$.desktop.capture.extra',
    '$.interactionChecks[0].extra',
    '$.visualComparisons[0].extra',
    '$.visualComparisons.home-muted.findings[0].extra',
    '$.diagnostics[0].extra',
  ]) {
    assert.ok(errors.some((error) => error.includes(`${path} is not allowed`)), path);
  }
});

test('base identity and canonical timestamps are exact', async (t) => {
  const fixture = await createFixture(t);
  fixture.proof.baseSha = 'd'.repeat(40);
  fixture.proof.createdAt = '2026';
  const errors = await verifyReplacementQualityProof(fixture.proof, {
    artifactPath: fixture.artifactPath,
    repositoryRoot,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
  });
  assert.ok(errors.some((error) => error.includes('exact reviewed base')));
  assert.ok(errors.some((error) => error.includes('canonical ISO timestamp')));
});

test('committed sanitized captures build an independently inspectable exact-head package', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'replacement-quality-package-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(directory, { recursive: true, force: true });
  });
  const result = await buildReplacementQualityArtifact(
    headSha,
    baseSha,
    directory,
    '2026-07-23T18:00:00.000Z',
  );
  const artifactSource = await readFile(result.artifactPath, 'utf8');
  const artifact = JSON.parse(artifactSource) as ReplacementQualityProof;
  assert.equal(artifact.headSha, headSha);
  assert.equal(artifact.baseSha, baseSha);
  assert.equal(artifact.diagnostics[0]?.observation, 'present');
  assert.equal(artifact.visualComparisons.every((comparison) =>
    comparison.findings.every((finding) => finding.priority === 'P3')), true);
  assert.equal(createHash('sha256').update(artifactSource).digest('hex'), result.artifactSha256);
  assert.deepEqual(
    (await readdir(join(directory, 'captures'))).sort(),
    [
      'desktop-home.png',
      'mobile-contact.png',
      'small-tablet-library.png',
      'visual-dm-right-sidecar.png',
      'visual-home-muted.png',
      'visual-work-expanded.png',
    ],
  );
});

async function createFixture(t: test.TestContext): Promise<{
  proof: ReplacementQualityProof;
  artifactPath: string;
  directory: string;
  captures: Map<string, { path: string; sha256: string }>;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'replacement-quality-proof-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(directory, { recursive: true, force: true });
  });
  const captures = new Map<string, { path: string; sha256: string }>();
  for (const [id, dimensions] of Object.entries(REQUIRED_VIEWPORTS)) {
    const path = `${id}.png`;
    const bytes = await sharp({
      create: {
        width: dimensions.width,
        height: dimensions.height,
        channels: 3,
        background: '#101725',
      },
    }).png().toBuffer();
    await writeFile(join(directory, path), bytes);
    captures.set(id, { path, sha256: sha256(bytes) });
  }
  const artifactPath = join(directory, 'proof.json');
  await writeFile(artifactPath, '{}');

  const proof: ReplacementQualityProof = {
    schemaVersion: 1,
    issue: 308,
    repository: 'dylanmccavitt/portfolio-',
    baseSha,
    headSha,
    createdAt: '2026-07-23T18:00:00.000Z',
    executionMode: 'local-fixture',
    viewports: Object.entries(REQUIRED_VIEWPORTS).map(([id, dimensions]) => ({
      id: id as keyof typeof REQUIRED_VIEWPORTS,
      ...dimensions,
      route: id === 'desktop' ? '/' : id === 'small-tablet' ? '/library' : '/contact',
      state: id === 'desktop' ? 'home-ready' : id === 'small-tablet' ? 'library-ready' : 'contact-ready',
      capture: captures.get(id)!,
      result: 'pass',
    })),
    interactionChecks: REQUIRED_INTERACTION_CHECKS.map((id) => ({ id, result: 'pass' })),
    fallbackChecks: REQUIRED_FALLBACK_CHECKS.map((id) => ({ id, result: 'pass' })),
    visualComparisons: Object.entries(VISUAL_REFERENCE_BINDINGS).map(([id, reference]) => ({
      id: id as keyof typeof VISUAL_REFERENCE_BINDINGS,
      reference,
      capture: captures.get('desktop')!,
      reviewedDimensions: [...REQUIRED_VISUAL_DIMENSIONS],
      findings: [],
      result: 'pass',
    })),
    diagnostics: [{
      id: 'optional-action-quality',
      result: 'diagnostic',
      observation: 'not-exercised',
    }],
  };
  return { proof, artifactPath, directory, captures };
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readCapture(directory: string, path: string): Promise<Buffer> {
  return readFile(join(directory, path));
}

import { describe, it, expect } from 'vitest';
import { LENSES, findLens } from './lenses';
import type { ReadableFile } from './iterative-agent';

const files: ReadableFile[] = [
  { path: 'src/core/index.ts', status: 'M' }, // api surface
  { path: 'src/core/logic.ts', status: 'M' }, // source
  { path: 'src/core/feature.ts', status: 'A' }, // added source
  { path: 'src/core/logic.test.ts', status: 'A' }, // test
  { path: 'vite.config.ts', status: 'M' }, // config
  { path: 'README.md', status: 'M' }, // docs
];

const order = (id: string): string[] => findLens(id)!.rankFiles!(files).map((f) => f.path);

describe('lens registry', () => {
  it('defines the specialized agents with explicit ids', () => {
    const ids = LENSES.map((l) => l.id).sort();
    expect(ids).toEqual(
      [
        'assess_merge_risk',
        'assess_performance_impact',
        'assess_test_coverage',
        'check_code_conventions',
        'explain_business_logic_changes',
        'find_breaking_changes',
        'orient_pr_review',
        'review_dependency_changes',
        'review_error_handling',
        'review_security_issues',
        'suggest_improvements',
        'summarize_pr_features',
      ].sort(),
    );
  });

  it('every lens has the required, explicit fields', () => {
    for (const l of LENSES) {
      expect(l.id).toMatch(/^[a-z]+(_[a-z]+)+$/); // explicit verb_object snake_case
      expect(l.label.length).toBeGreaterThan(3);
      expect(l.label).not.toContain('_'); // human label, never the raw id
      expect(l.examples.length).toBeGreaterThanOrEqual(2); // concrete trigger questions
      expect(l.instruction.length).toBeGreaterThan(20);
      expect(l.spokenAction).toMatch(/…$/); // present-tense action ending with an ellipsis
      expect(l.capability).toContain(l.id);
      expect(l.rankFiles).toBeTypeOf('function');
    }
  });

  it('every lens id is unique', () => {
    const ids = LENSES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('per-lens file bias (rankFiles)', () => {
  it('summarize_pr_features puts newly ADDED source first', () => {
    expect(order('summarize_pr_features')[0]).toBe('src/core/feature.ts');
  });

  it('find_breaking_changes puts the API surface (index/types) first', () => {
    expect(order('find_breaking_changes')[0]).toBe('src/core/index.ts');
  });

  it('explain_business_logic_changes ranks real source above tests and config', () => {
    const ranked = order('explain_business_logic_changes');
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('src/core/logic.test.ts'));
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('vite.config.ts'));
  });

  it('assess_merge_risk keeps tests high (it argues about missing/weak tests)', () => {
    const ranked = order('assess_merge_risk');
    expect(ranked.indexOf('src/core/logic.test.ts')).toBeLessThan(ranked.indexOf('README.md'));
  });

  it('orient_pr_review ranks entrypoints/source above config and docs', () => {
    const ranked = order('orient_pr_review');
    expect(ranked[0]).toBe('src/core/index.ts'); // api surface = where to start
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('vite.config.ts'));
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('README.md'));
  });
});

describe('per-lens file bias (added lenses)', () => {
  const files2: ReadableFile[] = [
    { path: 'src/core/logic.ts', status: 'M' }, // source
    { path: 'src/auth/login.ts', status: 'M' }, // security-sensitive (also source)
    { path: 'src/core/logic.test.ts', status: 'A' }, // test
    { path: 'package.json', status: 'M' }, // dependency manifest
  ];
  const ord = (id: string): string[] => findLens(id)!.rankFiles!(files2).map((f) => f.path);

  it('assess_test_coverage puts test files first', () => {
    expect(ord('assess_test_coverage')[0]).toBe('src/core/logic.test.ts');
  });

  it('review_security_issues puts security-sensitive (auth) files first', () => {
    expect(ord('review_security_issues')[0]).toBe('src/auth/login.ts');
  });

  it('review_dependency_changes puts the dependency manifest first', () => {
    expect(ord('review_dependency_changes')[0]).toBe('package.json');
  });

  it('assess_performance_impact ranks source above manifests/tests', () => {
    const ranked = ord('assess_performance_impact');
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('package.json'));
    expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('src/core/logic.test.ts'));
  });

  it('code-focused lenses rank source above manifests/tests', () => {
    for (const id of ['suggest_improvements', 'check_code_conventions', 'review_error_handling']) {
      const ranked = ord(id);
      expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('package.json'));
      expect(ranked.indexOf('src/core/logic.ts')).toBeLessThan(ranked.indexOf('src/core/logic.test.ts'));
    }
  });
});

import { describe, expect, it } from 'vitest';
import './ghostNets';
import { PUNTING_POLE_FACT } from './factCards';
import { PUNTING_POLE } from './movingHazards';

describe('module load order', () => {
  it('gives the punting pole its fact card when ghost nets load first', () => {
    expect(PUNTING_POLE_FACT).toBeDefined();
    expect(PUNTING_POLE.fact).toBeDefined();
    expect(PUNTING_POLE.fact).toBe(PUNTING_POLE_FACT);
  });
});

const LOGIC_SOURCES = import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true });
const VALUE_IMPORT = /^import\s+(?!type\s)[^;]*?from\s+'\.\/([\w]+)';/gm;

/** The modules a logic module imports at run time (type-only imports are erased and do not count). */
function readValueImports(moduleName: string): string[] {
  const source = LOGIC_SOURCES[`./${moduleName}.ts`];
  if (source === undefined) throw new Error(`moduleCycles: no source for ./${moduleName}.ts`);
  return [...source.matchAll(VALUE_IMPORT)].map((match) => match[1]);
}

/** Every module reachable from a logic module along run-time imports, the module itself included. */
function collectReachableModules(start: string): Set<string> {
  const seen = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...readValueImports(current));
  }
  return seen;
}

describe('pelican line imports', () => {
  it('never reaches layoutGaps, perks or trip along run-time imports', () => {
    const reachable = collectReachableModules('pelicanLine');
    for (const heavy of ['layoutGaps', 'perks', 'trip']) {
      expect(reachable.has(heavy), `pelicanLine reaches ${heavy}`).toBe(false);
    }
  });
});

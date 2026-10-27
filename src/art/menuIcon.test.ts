/**
 * The Home Tank Menu button icon (PRD C16, issue #148, ND-7; guide 8). Headless: the painter runs
 * against a recording context and a stub Path2D, as in src/art/refugeArt.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ICON_SIZE, paintIcon, type IconKind } from './drawUi';
import { INK } from './palette';
import texturesSource from './textures.ts?raw';

vi.mock('phaser', () => ({}));

type Cmd = [string, ...number[]];

class LogPath {
  readonly cmds: Cmd[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) =>
        key === 'cmds' ? target.cmds : (...args: number[]) => void target.cmds.push([String(key), ...args]),
    });
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
  readonly lineCap: string;
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt' };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      return (path?: LogPath) => {
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          out.push({
            op: name,
            cmds: path.cmds,
            style: String(name === 'fill' ? target.fillStyle : target.strokeStyle),
            lineWidth: target.lineWidth as number,
            lineCap: String(target.lineCap),
          });
        }
      };
    },
    set: (target, key, value) => {
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

const icon = (kind: IconKind): Painted[] => record((ctx) => paintIcon(ctx, kind, ICON_SIZE));
const strokes = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'stroke');
const fills = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'fill');
/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: Painted[]): string => JSON.stringify(painted.map((p) => [p.op, p.cmds]));

/** The horizontal bars of one stroke: each moveTo and the lineTo after it, as [x0, x1, y]. */
function bars(painted: Painted): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 1 < painted.cmds.length; i++) {
    const [moveName, x0, y0] = painted.cmds[i];
    const [lineName, x1, y1] = painted.cmds[i + 1];
    if (moveName === 'moveTo' && lineName === 'lineTo' && y0 === y1) out.push([x0, x1, y0]);
  }
  return out;
}

describe('menu icon', () => {
  it('is three rounded ink bars, at least 3 wide, with no fills', () => {
    const painted = icon('menu');
    expect(fills(painted)).toHaveLength(0);
    expect(strokes(painted)).toHaveLength(1);
    for (const s of strokes(painted)) {
      expect(s.style).toBe(INK);
      expect(s.lineWidth).toBeGreaterThanOrEqual(3);
      expect(s.lineCap).toBe('round');
    }
    expect(bars(painted[0])).toHaveLength(3);
    expect(painted[0].cmds).toHaveLength(6);
  });

  it('spaces the bars evenly, one length, centred in the 32 px icon box with the ink inside it', () => {
    const [stroke] = icon('menu');
    const found = bars(stroke);
    const ys = found.map(([, , y]) => y);
    expect(ys[1] - ys[0]).toBeCloseTo(ys[2] - ys[1], 9);
    expect((ys[0] + ys[2]) / 2).toBeCloseTo(ICON_SIZE / 2, 9);
    const half = stroke.lineWidth / 2;
    for (const [x0, x1, y] of found) {
      expect(x1 - x0).toBe(found[0][1] - found[0][0]);
      expect((x0 + x1) / 2).toBeCloseTo(ICON_SIZE / 2, 9);
      expect(x0 - half).toBeGreaterThanOrEqual(0);
      expect(x1 + half).toBeLessThanOrEqual(ICON_SIZE);
      expect(y - half).toBeGreaterThanOrEqual(0);
      expect(y + half).toBeLessThanOrEqual(ICON_SIZE);
    }
    expect(ys[1] - ys[0] - stroke.lineWidth).toBeGreaterThanOrEqual(stroke.lineWidth);
  });

  it('differs from the other hub icons', () => {
    const menu = signature(icon('menu'));
    for (const kind of ['play', 'decorate', 'chest', 'book', 'refuge', 'soundsOn', 'pause'] as const) {
      expect(menu).not.toBe(signature(icon(kind)));
    }
  });

  it('is baked with the other icons', () => {
    expect(texturesSource).toMatch(/ICON_KINDS[^=]*=\s*\[[^\]]*'menu'/);
  });
});

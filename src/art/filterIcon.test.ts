/**
 * The Treasure Chest Filter tile icon (funnel). Headless: the painter runs against a recording
 * context and a stub Path2D, as in src/art/menuIcon.test.ts.
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
  readonly lineJoin: string;
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  };
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
            lineJoin: String(target.lineJoin),
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
/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: Painted[]): string => JSON.stringify(painted.map((p) => [p.op, p.cmds]));

describe('filter icon', () => {
  it('is one ink outline, at least 3 wide, round joins and caps, no fills', () => {
    const painted = icon('filter');
    expect(painted).toHaveLength(1);
    const [stroke] = painted;
    expect(stroke.op).toBe('stroke');
    expect(stroke.style).toBe(INK);
    expect(stroke.lineWidth).toBeGreaterThanOrEqual(3);
    expect(stroke.lineCap).toBe('round');
    expect(stroke.lineJoin).toBe('round');
  });

  it('is a funnel: a wide top edge narrowing to a short stem, with the ink inside the 32 px box', () => {
    const [stroke] = icon('filter');
    const points = stroke.cmds.filter(([name]) => name === 'moveTo' || name === 'lineTo');
    const xs = points.map(([, x]) => x);
    const ys = points.map(([, , y]) => y);
    const half = stroke.lineWidth / 2;
    expect(Math.min(...xs) - half).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs) + half).toBeLessThanOrEqual(ICON_SIZE);
    expect(Math.min(...ys) - half).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys) + half).toBeLessThanOrEqual(ICON_SIZE);
    // Top edge: the two points at the smallest y are the widest span; the stem (largest y) is narrower.
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const span = (y: number): number => {
      const row = points.filter(([, , py]) => py === y).map(([, x]) => x);
      return Math.max(...row) - Math.min(...row);
    };
    expect(span(top)).toBeGreaterThan(span(bottom) * 2);
    // Centred on the box.
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(ICON_SIZE / 2, 9);
    expect(stroke.cmds.some(([name]) => name === 'closePath')).toBe(true);
  });

  it('differs from every other icon', () => {
    const filter = signature(icon('filter'));
    for (const kind of [
      'dash', 'pause', 'play', 'snack', 'home', 'bag', 'chest', 'decorate', 'close', 'left', 'right', 'check',
      'putAway', 'book', 'surprise', 'boy', 'girl', 'pencil', 'shirt', 'lock', 'paintDrop', 'refuge', 'musicOn',
      'musicOff', 'soundsOn', 'soundsOff', 'menu',
    ] as const satisfies readonly IconKind[]) {
      expect(filter).not.toBe(signature(icon(kind)));
    }
  });

  it('is baked with the other icons', () => {
    expect(texturesSource).toMatch(/ICON_KINDS[^=]*=\s*\[[^\]]*'filter'/);
  });
});

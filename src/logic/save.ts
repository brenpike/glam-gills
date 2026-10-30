/**
 * The save codec (PRD D1 to D8, X9, Implementation Decision 3): the hub as versioned JSON text, and
 * the text back as a hub. Pure; reading and writing browser storage lives in `src/platform/`.
 *
 * Only the hub is saved: banked treasure ids (so owned Dream colours), the owned axolotls with their
 * names, looks, worn Dream colours and outfits, the chosen explorer, the Home Tank layout, the
 * Collection Book, the best stars per area, the last chosen area and the hazards met. Never saved:
 * the Trip Bag, any trip state, legs, Shell blocks used this trip, and each area's memory: the trip
 * seed, the eaten snacks, the stranded axolotl left waiting and the lost treasures. Area memory
 * stays session-only, so a loaded game opens in the Home Tank and unbanked finds reappear on the
 * next trip in fresh spots (D3).
 *
 * Additive rule: a new hub field loads with its default when an older save lacks it, with no
 * version bump. Only a change an old save cannot load by default (a rename, a new meaning) bumps
 * SAVE_VERSION by appending one upgrade to SAVE_UPGRADES (D6).
 *
 * Repair rule: the hub is repaired field by field, so one bad field never wipes the rest. Unknown
 * ids, bad options and wrong types fall back to their defaults or are dropped. Only text that is
 * not a versioned save object at all is unreadable.
 *
 * Outfits and the explorer (#16) came under the additive rule: a missing outfit loads empty, and a
 * missing or unknown explorer loads as the first owned axolotl.
 *
 * First-find cards (#83) came under the additive rule: a missing or non-array firstFindsSeen loads
 * as none seen; unknown kinds are dropped; each kind is kept once, in FIRST_FIND_KINDS order. Start
 * over erases the save, so the cards show again in the new game.
 *
 * Areas (#73) came under the additive rule, with no version bump: the hub's `lastAreaId` and
 * `metHazards`. A missing, unknown or locked lastAreaId loads as the newest unlocked area. A missing
 * or non-array metHazards loads as none met; unknown ids are dropped; each id is kept once, in
 * areaFactCards order. Stars saved under an unknown area id are dropped.
 *
 * Refuge fact cards (#74) came under the additive rule, with no new field and no version bump: the
 * refuge card ids found join `metHazards`, after the hazard and predator ids, in bookFactCards order.
 * An older save has none, so they load as not found; an older build drops them as unknown ids.
 *
 * The Dash pot tip (#149) came under the additive rule, with no version bump: the hub's
 * `dashPotTipSeen` loads as true when exactly true. A save from before #149 lacks the field; it
 * loads as seen when a banked id is a Legendary (every Legendary then hid in a Dash pot), else as
 * not seen. A present but bad value loads as not seen. An older build drops it, so the tip may show
 * once more there.
 *
 * Legacy `book.tilapiaCard`: the Collection Book no longer holds the tilapia card, the hub's
 * `metHazards` does. The encoder still writes `book.tilapiaCard` (true when 'tilapia' is met), so
 * an older build reads the card, and the loader adds 'tilapia' to metHazards when it is exactly true.
 */
import { DEFAULT_LOOK, LOOK_FIELDS, LOOK_FIELD_OPTIONS, copyLook, type AxolotlLook, type LookField } from './axolotlLook';
import { cleanName, isValidName, unusedSuggestedName } from './axolotlNames';
import { areaById, resolveAreaId } from './areas';
import { ownedDreamColours, treasureById, type DreamColourId } from './catalogue';
import { wornDreamOrNone } from './dreamPaint';
import { TILAPIA_FACT } from './factCards';
import { FIRST_FIND_KINDS, type FirstFindKind } from './firstFind';
import { REAL_MORPHS, axolotlFindId, isAxolotlFindId, type RealMorphId } from './morphs';
import { repairOutfits, type Outfit } from './outfit';
import {
  STARTER_AXOLOTL_ID,
  createSession,
  orderedMetHazards,
  type CollectionBookState,
  type HubState,
  type OwnedAxolotl,
  type Session,
} from './session';
import type { AreaStars, AreaStarsRecord } from './stars';
import { SHIPPED_DECORATIONS, createTankLayout, sanitizeLayout, type TankLayout, type TankPlacement } from './tank';

/** One save upgrade: the hub of save version n made into the hub of version n + 1. May throw. */
export type SaveUpgrade = (hub: Record<string, unknown>) => Record<string, unknown>;

/** Save upgrades in order; entry n - 1 upgrades version n to n + 1 (D6). */
export const SAVE_UPGRADES: readonly SaveUpgrade[] = Object.freeze([]);

/** The version every new save is written with. */
export const SAVE_VERSION = SAVE_UPGRADES.length + 1;

/** Storage key of the save. */
export const SAVE_STORAGE_KEY = 'glam-gills:save';

/**
 * Storage key of the first unreadable save's text, kept until the next "Start over". A later
 * unreadable save is not backed up while this one is kept (ADR 0012, Known limits).
 */
export const SAVE_BACKUP_STORAGE_KEY = 'glam-gills:save-unreadable';

/** Every storage key the game uses; nothing else is ever stored. */
export const SAVE_STORAGE_KEYS: readonly string[] = Object.freeze([SAVE_STORAGE_KEY, SAVE_BACKUP_STORAGE_KEY]);

/** Registry key for the save gate. Never equals a `REGISTRY_KEYS`, `TRIP_REGISTRY_KEYS` or `SESSION_REGISTRY_KEY` value. */
export const SAVE_GATE_REGISTRY_KEY = 'saveGate';

/** Whether saving may write: 'closed' keeps a save this build cannot read, or storage that is unavailable, untouched. */
export type SaveGate = 'open' | 'closed';

/** What reading a save found: none, a hub, or text that is damaged or from a newer version. */
export type SaveRead =
  | { kind: 'fresh' }
  | { kind: 'loaded'; hub: HubState }
  | { kind: 'unreadable'; reason: 'damaged' | 'newer' };

/** What storage held: the save text (null when there is none), or no usable storage. */
export type StoredSave = { available: true; raw: string | null } | { available: false };

/** A loaded game: the session, the text to back up (null for none) and the save gate. */
export interface LoadedSave {
  session: Session;
  backup: string | null;
  gate: SaveGate;
}

/**
 * The Collection Book as saved: the CollectionBookState fields plus the legacy `tilapiaCard`, true
 * when the tilapia is met, so an older build still reads the tilapia card.
 */
type SavedBook = CollectionBookState & { tilapiaCard: boolean };

/** The hub as saved: every HubState field, with the book as a SavedBook. */
type SavedHub = Omit<HubState, 'book'> & { book: SavedBook };

/** The hub as save text: `{"version":SAVE_VERSION,"hub":{...}}`, with only the HubState fields and the legacy book.tilapiaCard. */
export function encodeSave(hub: HubState): string {
  return JSON.stringify({ version: SAVE_VERSION, hub: savedHub(hub) });
}

/** An allowlisted copy of `hub`. A new HubState field, optional or not, fails the build here until it is saved. */
function savedHub(hub: HubState): SavedHub {
  return {
    banked: [...hub.banked],
    axolotls: hub.axolotls.map(savedAxolotl),
    tank: { placed: hub.tank.placed.filter(isShippedPlacement).map(savedPlacement) },
    book: savedBook(hub.book, hub.metHazards),
    stars: savedStars(hub.stars),
    explorerId: hub.explorerId,
    firstFindsSeen: [...hub.firstFindsSeen],
    lastAreaId: hub.lastAreaId,
    metHazards: [...hub.metHazards],
    dashPotTipSeen: hub.dashPotTipSeen,
  } satisfies { [Key in keyof HubState]-?: unknown };
}

/** An allowlisted copy of `axolotl`. A new OwnedAxolotl field, optional or not, fails the build here until it is saved. */
function savedAxolotl(axolotl: OwnedAxolotl): OwnedAxolotl {
  return {
    id: axolotl.id,
    morph: axolotl.morph,
    name: axolotl.name,
    look: copyLook(axolotl.look),
    dreamColour: axolotl.dreamColour,
    outfit: savedOutfit(axolotl.outfit),
  } satisfies { [Key in keyof OwnedAxolotl]-?: unknown };
}

/** An allowlisted copy of `outfit`, slot by slot. A new slot fails the build here until it is saved. */
function savedOutfit(outfit: Outfit): Outfit {
  return {
    head: outfit.head,
    neck: outfit.neck,
    face: outfit.face,
    shirt: outfit.shirt,
    back: outfit.back,
    tail: outfit.tail,
    socks: outfit.socks,
    feet: outfit.feet,
  } satisfies { [Key in keyof Outfit]-?: unknown };
}

/** True when the placement is of a shipped Decoration; dev decorations are never saved. */
function isShippedPlacement(placement: TankPlacement): boolean {
  return SHIPPED_DECORATIONS.some((decoration) => decoration.id === placement.id);
}

function savedPlacement(placement: TankPlacement): TankPlacement {
  return { id: placement.id, x: placement.x, y: placement.y } satisfies { [Key in keyof TankPlacement]-?: unknown };
}

/** An allowlisted copy of `book` with the legacy tilapiaCard. A new CollectionBookState field fails the build here until it is saved. */
function savedBook(book: CollectionBookState, metHazards: readonly string[]): SavedBook {
  return {
    foundMorphs: [...book.foundMorphs],
    tilapiaCard: metHazards.includes(TILAPIA_FACT.id),
  } satisfies { [Key in keyof SavedBook]-?: unknown };
}

function savedStars(stars: AreaStarsRecord): AreaStarsRecord {
  return Object.fromEntries(Object.entries(stars).map(([areaId, earned]) => [areaId, savedAreaStars(earned)]));
}

function savedAreaStars(earned: AreaStars): AreaStars {
  return {
    exit: earned.exit,
    special: earned.special,
    legsOrRescue: earned.legsOrRescue,
  } satisfies { [Key in keyof AreaStars]-?: unknown };
}

/**
 * Reads save text. Never throws. null is fresh. Text that is not JSON, not an object, has no
 * integer version of at least 1 or no hub object, or whose upgrade throws is damaged; a version
 * past `upgrades.length + 1` is newer. Anything else loads, upgraded forward and repaired field by
 * field.
 */
export function decodeSave(raw: string | null, upgrades: readonly SaveUpgrade[] = SAVE_UPGRADES): SaveRead {
  if (raw === null) return { kind: 'fresh' };
  try {
    return decodeSaveText(raw, upgrades);
  } catch {
    return { kind: 'unreadable', reason: 'damaged' };
  }
}

function decodeSaveText(raw: string, upgrades: readonly SaveUpgrade[]): SaveRead {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return { kind: 'unreadable', reason: 'damaged' };
  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { kind: 'unreadable', reason: 'damaged' };
  }
  if (version > upgrades.length + 1) return { kind: 'unreadable', reason: 'newer' };
  let hub = parsed.hub;
  for (let index = version - 1; index < upgrades.length; index++) {
    if (!isRecord(hub)) break;
    hub = upgrades[index](hub);
  }
  if (!isRecord(hub)) return { kind: 'unreadable', reason: 'damaged' };
  return { kind: 'loaded', hub: repairedHub(hub) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A whole HubState from a saved hub, each field repaired on its own. Outfits are repaired once the
 * axolotls and the banked ids are (repairOutfits); the last chosen area once the stars are.
 */
function repairedHub(saved: Record<string, unknown>): HubState {
  const banked = repairedBanked(saved.banked);
  const axolotls = repairOutfits(repairedAxolotls(saved.axolotls, ownedDreamColours(banked)), banked);
  const stars = repairedStars(saved.stars);
  return {
    banked,
    axolotls,
    tank: repairedTank(saved.tank, banked),
    book: repairedBook(saved.book, axolotls),
    stars,
    explorerId: repairedExplorerId(saved.explorerId, axolotls),
    firstFindsSeen: repairedFirstFindsSeen(saved.firstFindsSeen),
    lastAreaId: resolveAreaId(saved.lastAreaId, stars),
    metHazards: repairedMetHazards(saved.metHazards, saved.book),
    dashPotTipSeen: repairedDashPotTipSeen(saved, banked),
  };
}

/**
 * Whether the Dash pot tip was seen: exactly true. A save without the field is from before #149,
 * when every Legendary hid in a Dash pot, so a banked Legendary counts as seen there.
 */
function repairedDashPotTipSeen(saved: Record<string, unknown>, banked: readonly string[]): boolean {
  if (!Object.hasOwn(saved, 'dashPotTipSeen')) {
    return banked.some((id) => treasureById(id)?.rarity === 'legendary');
  }
  return saved.dashPotTipSeen === true;
}

/** Whether `value` is a treasure id that can be banked: a catalogue id that is not an axolotl find id. */
function isBankableId(value: unknown): value is string {
  return typeof value === 'string' && treasureById(value) !== undefined && !isAxolotlFindId(value);
}

/** Bankable ids, each once (first kept), in saved order; a non-array is nothing banked. */
function repairedBanked(saved: unknown): string[] {
  if (!Array.isArray(saved)) return [];
  return [...new Set(saved.filter(isBankableId))];
}

function isRealMorphId(value: unknown): value is RealMorphId {
  return REAL_MORPHS.some((morph) => morph.id === value);
}

/** An owned axolotl whose saved outfit is not repaired yet. */
type UnrepairedOutfitAxolotl = Omit<OwnedAxolotl, 'outfit'> & { outfit: unknown };

/** A saved axolotl entry with a real morph; any other entry is dropped. */
type AxolotlEntry = Record<string, unknown> & { morph: RealMorphId };

function isAxolotlEntry(value: unknown): value is AxolotlEntry {
  return isRecord(value) && isRealMorphId(value.morph);
}

/**
 * Whether `entry` needs no repair: the starter's id or its morph's find id, a valid name and every
 * look field a valid option. Its Dream colour and outfit are not checked: a Dream colour that loads
 * as none or an outfit that loads empty never lets a duplicate take this entry's id or morph.
 */
function isIntactAxolotl(entry: AxolotlEntry): boolean {
  const look = entry.look;
  return (
    (entry.id === STARTER_AXOLOTL_ID || entry.id === axolotlFindId(entry.morph)) &&
    isValidName(entry.name) &&
    isRecord(look) &&
    LOOK_FIELDS.every((field) => repairedOption(field, look[field]) === look[field])
  );
}

/**
 * Owned axolotls with a real morph, one per id and per morph, in saved order. Intact entries claim
 * their id and morph first, so an entry needing repair never displaces an intact one; among entries
 * alike, the first in saved order is kept. An id that is neither the starter's nor the morph's find
 * id becomes the find id. A bad name becomes the first suggested name no axolotl kept before it uses.
 * A Dream colour that is missing, unknown or not in `owned` loads as none (additive rule). The saved
 * outfit is kept as it is, for repairOutfits.
 */
function repairedAxolotls(saved: unknown, owned: readonly DreamColourId[]): UnrepairedOutfitAxolotl[] {
  if (!Array.isArray(saved)) return [];
  const entries = saved.filter(isAxolotlEntry);
  const indices = [...entries.keys()];
  const intact = entries.map(isIntactAxolotl);
  const claimOrder = [...indices.filter((index) => intact[index]), ...indices.filter((index) => !intact[index])];
  const kept = new Map<number, UnrepairedOutfitAxolotl>();
  for (const index of claimOrder) {
    const entry = entries[index];
    const morph = entry.morph;
    const id = entry.id === STARTER_AXOLOTL_ID ? STARTER_AXOLOTL_ID : axolotlFindId(morph);
    const claimed = [...kept.values()];
    if (claimed.some((axolotl) => axolotl.id === id || axolotl.morph === morph)) continue;
    const look = repairedLook(entry.look);
    const dreamColour = wornDreamOrNone(entry.dreamColour, owned);
    const name = repairedName(entry.name, claimed, look);
    kept.set(index, { id, morph, name, look, dreamColour, outfit: entry.outfit });
  }
  return indices.flatMap((index) => kept.get(index) ?? []);
}

function repairedName(saved: unknown, earlier: readonly UnrepairedOutfitAxolotl[], look: AxolotlLook): string {
  const name = typeof saved === 'string' ? cleanName(saved) : '';
  if (isValidName(name)) return name;
  return unusedSuggestedName(earlier.map((axolotl) => axolotl.name), look.sex);
}

/** A look with each LOOK_FIELDS field's saved option id, or DEFAULT_LOOK's when it is not an option. */
function repairedLook(saved: unknown): AxolotlLook {
  const record = isRecord(saved) ? saved : {};
  const entries = LOOK_FIELDS.map((field): [LookField, string] => [field, repairedOption(field, record[field])]);
  return Object.fromEntries(entries) as unknown as AxolotlLook;
}

function repairedOption(field: LookField, saved: unknown): string {
  const options: readonly { readonly id: string }[] = LOOK_FIELD_OPTIONS[field];
  return options.find((option) => option.id === saved)?.id ?? DEFAULT_LOOK[field];
}

function isPlacementShape(value: unknown): value is TankPlacement {
  return isRecord(value) && typeof value.id === 'string' && typeof value.x === 'number' && typeof value.y === 'number';
}

/** The saved placements sanitized against `banked` (sanitizeLayout); an empty tank when unusable. */
function repairedTank(saved: unknown, banked: readonly string[]): TankLayout {
  if (!isRecord(saved) || !Array.isArray(saved.placed)) return createTankLayout();
  return sanitizeLayout({ placed: saved.placed.filter(isPlacementShape) }, banked);
}

/** Found morphs (known ids plus every owned morph) in REAL_MORPHS order. */
function repairedBook(saved: unknown, axolotls: readonly OwnedAxolotl[]): CollectionBookState {
  const record = isRecord(saved) ? saved : {};
  const savedFound: unknown[] = Array.isArray(record.foundMorphs) ? record.foundMorphs : [];
  const found = new Set<unknown>([...savedFound, ...axolotls.map((axolotl) => axolotl.morph)]);
  return { foundMorphs: REAL_MORPHS.map((morph) => morph.id).filter((id) => found.has(id)) };
}

/**
 * The saved fact cards found (hazards met and refuge cards), plus the tilapia when the saved book's
 * legacy tilapiaCard is exactly true: known ids only, each once, in bookFactCards order; a
 * non-array is none found.
 */
function repairedMetHazards(saved: unknown, savedBook: unknown): string[] {
  const met: unknown[] = Array.isArray(saved) ? saved : [];
  const legacyTilapia = isRecord(savedBook) && savedBook.tilapiaCard === true ? [TILAPIA_FACT.id] : [];
  return orderedMetHazards([...met, ...legacyTilapia]);
}

/** Stars of known areas only (own keys), each star true only when exactly true; missing is none. */
function repairedStars(saved: unknown): AreaStarsRecord {
  if (!isRecord(saved)) return {};
  const entries: [string, AreaStars][] = [];
  for (const areaId of Object.keys(saved)) {
    const earned = saved[areaId];
    if (areaById(areaId) !== undefined && isRecord(earned)) entries.push([areaId, repairedAreaStars(earned)]);
  }
  return Object.fromEntries(entries);
}

function repairedAreaStars(saved: Record<string, unknown>): AreaStars {
  return { exit: saved.exit === true, special: saved.special === true, legsOrRescue: saved.legsOrRescue === true };
}

/** The saved explorer id when an axolotl in `axolotls` has it, else the first one's id, or null with none. */
function repairedExplorerId(saved: unknown, axolotls: readonly OwnedAxolotl[]): string | null {
  const chosen = axolotls.find((axolotl) => axolotl.id === saved) ?? axolotls[0];
  return chosen?.id ?? null;
}

/** The saved first-find kinds seen, each once, in FIRST_FIND_KINDS order; unknown dropped, a non-array is none. */
function repairedFirstFindsSeen(saved: unknown): FirstFindKind[] {
  if (!Array.isArray(saved)) return [];
  return FIRST_FIND_KINDS.filter((kind) => saved.includes(kind));
}

/** The session a save read starts: the loaded hub with fresh memory for every area, else a new session. */
export function sessionFromSave(read: SaveRead): Session {
  const fresh = createSession();
  return read.kind === 'loaded' ? { hub: read.hub, areas: fresh.areas } : fresh;
}

/**
 * The game a stored save starts. No storage: fresh, gate closed. No save: fresh, gate open. A
 * loaded save: gate open. A damaged save: fresh, its text backed up, gate open. A newer save: fresh,
 * nothing backed up, gate closed so it is never overwritten.
 */
export function loadSave(stored: StoredSave): LoadedSave {
  if (!stored.available) return { session: createSession(), backup: null, gate: 'closed' };
  const read = decodeSave(stored.raw);
  const session = sessionFromSave(read);
  if (read.kind !== 'unreadable') return { session, backup: null, gate: 'open' };
  if (read.reason === 'newer') return { session, backup: null, gate: 'closed' };
  return { session, backup: stored.raw, gate: 'open' };
}

/** The save gate after "Start over": open once the save was erased, else unchanged. */
export function gateAfterErase(gate: SaveGate, erased: boolean): SaveGate {
  return erased ? 'open' : gate;
}

/**
 * The session with the bankable ids of `justBanked` (catalogue ids, never axolotl find ids) not
 * banked yet appended to the hub's banked ids, in order, each once. The same session object when
 * nothing is new.
 */
export function bankedMidTrip(session: Session, justBanked: readonly string[]): Session {
  const banked = new Set(session.hub.banked);
  const added = [...new Set(justBanked.filter(isBankableId))].filter((id) => !banked.has(id));
  if (added.length === 0) return session;
  return { ...session, hub: { ...session.hub, banked: [...session.hub.banked, ...added] } };
}

// Food Search section order + visibility (DATA-19, UX-18 `Search results`, UX-04).
import { z } from 'zod';

export const FOOD_SEARCH_SECTION_IDS = ['custom', 'saved', 'open_food_facts', 'usda'] as const;
export type FoodSearchSectionId = (typeof FOOD_SEARCH_SECTION_IDS)[number];
export type FoodSearchSection = { id: FoodSearchSectionId; visible: boolean };
export type FoodSearchSections = readonly FoodSearchSection[];

/** UX-18 default: `My foods` → `Saved` → `Open Food Facts` → `USDA`, all visible. Same as the DATA-19 column default. */
export const DEFAULT_FOOD_SEARCH_SECTIONS: FoodSearchSections = FOOD_SEARCH_SECTION_IDS.map((id) => ({
  id,
  visible: true,
}));

export const REMOTE_FOOD_SEARCH_SECTIONS: readonly FoodSearchSectionId[] = ['open_food_facts', 'usda'];

/** DATA-19: exactly the 4 ids, each once, at least one visible. */
export const foodSearchSectionsSchema = z
  .array(z.object({ id: z.enum(FOOD_SEARCH_SECTION_IDS), visible: z.boolean() }))
  .length(FOOD_SEARCH_SECTION_IDS.length)
  .refine((sections) => new Set(sections.map((s) => s.id)).size === FOOD_SEARCH_SECTION_IDS.length, 'duplicate id')
  .refine((sections) => sections.some((s) => s.visible), 'no visible section');

export function isValidFoodSearchSections(value: unknown): value is FoodSearchSections {
  return foodSearchSectionsSchema.safeParse(value).success;
}

/** DATA-19 read: stored JSON → sections; invalid or unparseable data falls back to the default (never throws). */
export function parseFoodSearchSections(json: unknown): FoodSearchSections {
  if (typeof json !== 'string') return DEFAULT_FOOD_SEARCH_SECTIONS;
  try {
    const parsed = foodSearchSectionsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : DEFAULT_FOOD_SEARCH_SECTIONS;
  } catch {
    return DEFAULT_FOOD_SEARCH_SECTIONS;
  }
}

/** Visible section ids in display order (UX-04 renders these, nothing else). */
export function visibleFoodSearchSections(sections: FoodSearchSections): FoodSearchSectionId[] {
  return sections.filter((s) => s.visible).map((s) => s.id);
}

export function isFoodSearchSectionVisible(sections: FoodSearchSections, id: FoodSearchSectionId): boolean {
  return sections.some((s) => s.id === id && s.visible);
}

/** UX-18: the last visible section can't be hidden (its switch is disabled). */
export function canHideFoodSearchSection(sections: FoodSearchSections, id: FoodSearchSectionId): boolean {
  return isFoodSearchSectionVisible(sections, id) && sections.filter((s) => s.visible).length > 1;
}

/** Switch change: the new sections, or `null` when it would hide the last visible section or changes nothing. */
export function setFoodSearchSectionVisible(
  sections: FoodSearchSections,
  id: FoodSearchSectionId,
  visible: boolean,
): FoodSearchSection[] | null {
  if (isFoodSearchSectionVisible(sections, id) === visible) return null;
  if (!visible && !canHideFoodSearchSection(sections, id)) return null;
  return sections.map((s) => (s.id === id ? { ...s, visible } : s));
}

/** Drop / a11y move: `id` moved to `toIndex` (clamped), or `null` when nothing moves. */
export function moveFoodSearchSection(
  sections: FoodSearchSections,
  id: FoodSearchSectionId,
  toIndex: number,
): FoodSearchSection[] | null {
  const from = sections.findIndex((s) => s.id === id);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(sections.length - 1, toIndex));
  if (to === from) return null;
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

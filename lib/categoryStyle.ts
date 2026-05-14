import type { Category } from '../store/useCategoriesStore';

export interface CategoryStyle {
  name: string;
  tint: string;
}

const FALLBACK_BY_NAME: Record<string, CategoryStyle> = {
  dining: { name: 'restaurant-outline', tint: '#FFB547' },
  food: { name: 'restaurant-outline', tint: '#FFB547' },
  transport: { name: 'car-outline', tint: '#5BA3FF' },
  entertainment: { name: 'film-outline', tint: '#A78BFA' },
  shopping: { name: 'bag-handle-outline', tint: '#FF5C7C' },
  groceries: { name: 'cart-outline', tint: '#5BE0B0' },
  bills: { name: 'receipt-outline', tint: '#FFB547' },
  'home & bills': { name: 'home-outline', tint: '#5BA3FF' },
  utilities: { name: 'flash-outline', tint: '#FFB547' },
  health: { name: 'medkit-outline', tint: '#FF5C7C' },
  travel: { name: 'airplane-outline', tint: '#A78BFA' },
  salary: { name: 'cash-outline', tint: '#5BE0B0' },
  income: { name: 'cash-outline', tint: '#5BE0B0' },
  crypto: { name: 'logo-bitcoin', tint: '#FFB547' },
  other: { name: 'apps-outline', tint: '#FF6B4A' },
};

const FALLBACK_DEFAULT: CategoryStyle = {
  name: 'card-outline',
  tint: '#FF6B4A',
};

const ROTATION_PALETTE = [
  '#FF6B4A',
  '#5BE0B0',
  '#5BA3FF',
  '#FFB547',
  '#FF5C7C',
  '#A78BFA',
  '#4ECDC4',
  '#F38BA8',
];

const hashTint = (key: string): string => {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return ROTATION_PALETTE[Math.abs(h) % ROTATION_PALETTE.length];
};

/**
 * Resolve the icon + tint for a given transaction category name, in
 * priority order:
 *   1. The user's Vault Config (Categories store) — case-insensitive.
 *   2. A built-in fallback table for common labels.
 *   3. A deterministic per-name color from a palette rotation, so even
 *      unknown categories render with a distinct color rather than the
 *      gray default.
 */
export const resolveCategoryStyle = (
  categoryName: string,
  categories: Category[],
): CategoryStyle => {
  const key = (categoryName || '').trim().toLowerCase();

  if (key) {
    const match = categories.find(c => c.name.toLowerCase() === key);
    if (match) {
      return { name: match.icon, tint: match.color };
    }
    const fallback = FALLBACK_BY_NAME[key];
    if (fallback) return fallback;
    if (key !== 'uncategorised' && key !== 'uncategorized') {
      return { name: FALLBACK_DEFAULT.name, tint: hashTint(key) };
    }
  }

  return FALLBACK_DEFAULT;
};

/**
 * Pick a deterministic accent color for a label name. Labels in the
 * store only carry `{id, name}`, so we hash the name into a fixed
 * palette to make every label render with a stable, distinct tone.
 */
export const resolveLabelColor = (labelName: string): string =>
  hashTint((labelName || '').trim().toLowerCase());

/**
 * Convert a hex tint into a translucent fill suitable for chip
 * backgrounds, returned alongside the original hex (for border/text).
 */
export const tintWithAlpha = (hex: string, alpha: number): string => {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

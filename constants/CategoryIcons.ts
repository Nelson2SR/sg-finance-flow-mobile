/**
 * Curated catalogues used by the Categories + Labels CRUD UI.
 *
 * We deliberately limit the icon set to a focused finance-relevant
 * subset of @expo/vector-icons' Ionicons so the picker grid is
 * fast to scan and stays visually consistent. Adding a new icon is
 * cheap: drop the Ionicons key into the appropriate group below.
 */

import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = keyof typeof Ionicons.glyphMap;

export interface IconGroup {
  label: string;
  icons: IoniconName[];
}

/**
 * Picker grid contents. Grouped so the search-free picker reads like
 * a quick taxonomy ('what kind of thing is this?') rather than a flat
 * alphabetical dump.
 */
export const CATEGORY_ICON_GROUPS: IconGroup[] = [
  {
    label: 'Food & Drink',
    icons: [
      'restaurant',
      'fast-food',
      'cafe',
      'beer',
      'wine',
      'pizza',
      'ice-cream',
      'nutrition',
    ],
  },
  {
    label: 'Transport',
    icons: ['car', 'bus', 'train', 'airplane', 'bicycle', 'walk', 'boat', 'subway'],
  },
  {
    label: 'Home & Bills',
    icons: ['home', 'bed', 'water', 'flash', 'wifi', 'phone-portrait', 'tv', 'flame'],
  },
  {
    label: 'Shopping',
    icons: ['cart', 'bag-handle', 'gift', 'basket', 'shirt', 'pricetag', 'storefront'],
  },
  {
    label: 'Health & Wellness',
    icons: ['medkit', 'fitness', 'heart', 'pulse', 'leaf', 'barbell'],
  },
  {
    label: 'Fun',
    icons: [
      'film',
      'game-controller',
      'musical-notes',
      'sparkles',
      'book',
      'camera',
      'paw',
    ],
  },
  {
    label: 'Work & Money',
    icons: [
      'briefcase',
      'business',
      'laptop',
      'cash',
      'card',
      'wallet',
      'trending-up',
      'analytics',
    ],
  },
  {
    label: 'People & Other',
    icons: [
      'people',
      'person',
      'happy',
      'school',
      'umbrella',
      'shield-checkmark',
      'star',
      'ellipsis-horizontal',
    ],
  },
];

/** Flat list — useful for searching, validation, and "did the user pick a known icon?" checks. */
export const ALL_CATEGORY_ICONS: IoniconName[] = CATEGORY_ICON_GROUPS.flatMap(g => g.icons);

/**
 * Color swatches for the category circle. First row matches the
 * accent palette already in the design system; second row adds
 * complementary hues so 20+ categories don't all look alike.
 */
export const CATEGORY_COLORS: string[] = [
  '#FF6B4A', // accent-coral
  '#FF5C7C', // accent-rose
  '#FFB547', // accent-amber
  '#5BE0B0', // accent-mint
  '#A78BFA', // violet
  '#5BA3FF', // azure
  '#FFD166', // sunshine
  '#94C57F', // sage
  '#C599B6', // mauve
  '#FB8500', // tangerine
  '#74D5FF', // sky
  '#9CA3AF', // slate (neutral fallback)
];

export const DEFAULT_CATEGORY_ICON: IoniconName = 'pricetag';
export const DEFAULT_CATEGORY_COLOR: string = CATEGORY_COLORS[0];

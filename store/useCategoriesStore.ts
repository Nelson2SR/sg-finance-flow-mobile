import { create } from 'zustand';

import type { IoniconName } from '../constants/CategoryIcons';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '../constants/CategoryIcons';

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: IoniconName;
  /** Hex string, e.g. '#FF6B4A'. */
  color: string;
}

export interface Label {
  id: string;
  name: string;
}

interface CategoriesState {
  categories: Category[];
  labels: Label[];

  // ── Category CRUD ──────────────────────────────────────────────────
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (kind: CategoryKind, orderedIds: string[]) => void;

  // ── Label CRUD ─────────────────────────────────────────────────────
  addLabel: (name: string) => Label;
  updateLabel: (id: string, name: string) => void;
  deleteLabel: (id: string) => void;
}

// Monotonic id minter — duplicate Date.now() collisions are unlikely for
// human CRUD speeds but cheap insurance for the reorder/import edge cases.
let _seq = 0;
const mintId = (prefix: string) => `${prefix}_${Date.now()}_${++_seq}`;

// ── Seeded defaults ────────────────────────────────────────────────
// Sensible SG-relevant starter set so a new install isn't a blank list.
// Users can rename/delete/reorder freely.

const seedCategories = (): Category[] => [
  // Expenses
  { id: 'cat_food', name: 'Food & Drink', kind: 'expense', icon: 'restaurant', color: '#FFB547' },
  { id: 'cat_transport', name: 'Transport', kind: 'expense', icon: 'car', color: '#5BA3FF' },
  { id: 'cat_shopping', name: 'Shopping', kind: 'expense', icon: 'bag-handle', color: '#FF5C7C' },
  { id: 'cat_home', name: 'Home & Bills', kind: 'expense', icon: 'home', color: '#94C57F' },
  { id: 'cat_health', name: 'Health', kind: 'expense', icon: 'medkit', color: '#5BE0B0' },
  { id: 'cat_fun', name: 'Entertainment', kind: 'expense', icon: 'film', color: '#A78BFA' },
  { id: 'cat_travel', name: 'Travel', kind: 'expense', icon: 'airplane', color: '#74D5FF' },
  { id: 'cat_education', name: 'Education', kind: 'expense', icon: 'school', color: '#5BA3FF' },
  { id: 'cat_other_expense', name: 'Other', kind: 'expense', icon: 'ellipsis-horizontal', color: '#9CA3AF' },

  // Income
  { id: 'cat_salary', name: 'Salary', kind: 'income', icon: 'cash', color: '#5BE0B0' },
  { id: 'cat_business', name: 'Business', kind: 'income', icon: 'briefcase', color: '#FFB547' },
  { id: 'cat_gifts', name: 'Gifts', kind: 'income', icon: 'gift', color: '#FF5C7C' },
  { id: 'cat_investment', name: 'Investment', kind: 'income', icon: 'trending-up', color: '#A78BFA' },
  { id: 'cat_other_income', name: 'Other', kind: 'income', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
];

// Seeded labels chosen for budgeting + tax + recurring-expense workflows
// common in a SG personal-finance context. Users can rename/delete any
// of them; this is just a starter taxonomy so a new install isn't blank.
const seedLabels = (): Label[] => [
  // Budget hygiene (50/30/20 split + classic envelope language)
  { id: 'lbl_needs', name: 'Needs' },
  { id: 'lbl_wants', name: 'Wants' },
  { id: 'lbl_savings', name: 'Savings' },

  // Recurring / commitment
  { id: 'lbl_subscription', name: 'Subscription' },
  { id: 'lbl_recurring', name: 'Recurring Bill' },

  // Tax + work
  { id: 'lbl_reimbursable', name: 'Reimbursable' },
  { id: 'lbl_tax_deductible', name: 'Tax Deductible' },
  { id: 'lbl_business', name: 'Business' },

  // Life events / shared
  { id: 'lbl_family', name: 'Family Shared' },
  { id: 'lbl_gift', name: 'Gift' },
  { id: 'lbl_emergency', name: 'Emergency' },
  { id: 'lbl_travel', name: 'Travel' },

  // SG-specific
  { id: 'lbl_cpf', name: 'CPF' },
];

export const useCategoriesStore = create<CategoriesState>(set => ({
  categories: seedCategories(),
  labels: seedLabels(),

  addCategory: cat => {
    const created: Category = {
      id: mintId('cat'),
      name: cat.name.trim() || 'Untitled',
      kind: cat.kind,
      icon: cat.icon || DEFAULT_CATEGORY_ICON,
      color: cat.color || DEFAULT_CATEGORY_COLOR,
    };
    set(state => ({ categories: [...state.categories, created] }));
    return created;
  },

  updateCategory: (id, patch) =>
    set(state => ({
      categories: state.categories.map(c =>
        c.id === id
          ? {
              ...c,
              ...patch,
              // Keep the name trimmed and never empty.
              name: patch.name !== undefined ? patch.name.trim() || c.name : c.name,
            }
          : c,
      ),
    })),

  deleteCategory: id =>
    set(state => ({ categories: state.categories.filter(c => c.id !== id) })),

  reorderCategories: (kind, orderedIds) =>
    set(state => {
      // Build the new array: the reordered subset for the given kind,
      // interleaved with untouched categories of the other kind in their
      // current relative position. Simplest correct version:
      //   1. Pull the ordered subset out by id.
      //   2. Replace the kind's slice in the master list with that subset.
      const byId = new Map(state.categories.map(c => [c.id, c]));
      const orderedSubset = orderedIds
        .map(id => byId.get(id))
        .filter((c): c is Category => !!c && c.kind === kind);
      const other = state.categories.filter(c => c.kind !== kind);
      // Preserve the original interleaving roughly: put the reordered
      // kind's slice where it first appeared.
      const firstKindIndex = state.categories.findIndex(c => c.kind === kind);
      const next = [...other];
      const insertAt = firstKindIndex === -1 ? next.length : firstKindIndex;
      next.splice(insertAt, 0, ...orderedSubset);
      return { categories: next };
    }),

  addLabel: name => {
    const created: Label = {
      id: mintId('lbl'),
      name: name.trim() || 'Untitled',
    };
    set(state => ({ labels: [...state.labels, created] }));
    return created;
  },

  updateLabel: (id, name) =>
    set(state => ({
      labels: state.labels.map(l =>
        l.id === id ? { ...l, name: name.trim() || l.name } : l,
      ),
    })),

  deleteLabel: id => set(state => ({ labels: state.labels.filter(l => l.id !== id) })),
}));

// Convenience selectors for views that don't need the full state.
export const selectExpenseCategories = (s: CategoriesState) =>
  s.categories.filter(c => c.kind === 'expense');
export const selectIncomeCategories = (s: CategoriesState) =>
  s.categories.filter(c => c.kind === 'income');

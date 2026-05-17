import { create } from 'zustand';

import type { IoniconName } from '../constants/CategoryIcons';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '../constants/CategoryIcons';
import {
  categoriesApi,
  labelsApi,
  ApiCategory,
  ApiLabel,
  CategoryKindDto,
} from '../services/apiClient';

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

  /**
   * Replace local state with the user's backend-persisted Vault Config.
   * If the backend lists are empty (new user), pushes the current local
   * seeds up first — that's the one-time bootstrap so a fresh install
   * doesn't have to manually rebuild the taxonomy. Idempotent; safe to
   * call on every authenticated app launch.
   */
  syncFromBackend: () => Promise<void>;

  // ── Category CRUD ──────────────────────────────────────────────────
  // CRUD methods stay synchronous so existing call sites don't need to
  // await. Backend writes are fire-and-forget; the next syncFromBackend
  // reconciles any divergence.
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (kind: CategoryKind, orderedIds: string[]) => void;

  // ── Label CRUD ─────────────────────────────────────────────────────
  addLabel: (name: string) => Label;
  updateLabel: (id: string, name: string) => void;
  deleteLabel: (id: string) => void;
}

// Monotonic id minter — used for transient local IDs before the backend
// assigns the canonical numeric id (which we then stringify and swap in).
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
  { id: 'lbl_needs', name: 'Needs' },
  { id: 'lbl_wants', name: 'Wants' },
  { id: 'lbl_savings', name: 'Savings' },
  { id: 'lbl_subscription', name: 'Subscription' },
  { id: 'lbl_recurring', name: 'Recurring Bill' },
  { id: 'lbl_reimbursable', name: 'Reimbursable' },
  { id: 'lbl_tax_deductible', name: 'Tax Deductible' },
  { id: 'lbl_business', name: 'Business' },
  { id: 'lbl_family', name: 'Family Shared' },
  { id: 'lbl_gift', name: 'Gift' },
  { id: 'lbl_emergency', name: 'Emergency' },
  { id: 'lbl_travel', name: 'Travel' },
  { id: 'lbl_cpf', name: 'CPF' },
];

const apiToCategory = (c: ApiCategory): Category => ({
  id: String(c.id),
  name: c.name,
  kind: c.kind as CategoryKind,
  icon: c.icon as IoniconName,
  color: c.color,
});

const apiToLabel = (l: ApiLabel): Label => ({ id: String(l.id), name: l.name });

// True when an id looks like a backend-assigned numeric id (post-sync).
// Local-seeded ids look like 'cat_food' / 'lbl_needs' / 'cat_<ts>_<seq>'
// and are skipped by write-through update / delete until the next sync
// turns them into numbers.
const isServerId = (id: string): boolean => /^\d+$/.test(id);

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: seedCategories(),
  labels: seedLabels(),

  syncFromBackend: async () => {
    try {
      const [catRes, lblRes] = await Promise.all([categoriesApi.list(), labelsApi.list()]);
      let serverCats = catRes.data;
      let serverLbls = lblRes.data;

      // One-time bootstrap: when the backend lists are empty but the
      // local store has the seeded defaults (or user customizations),
      // push them up so the user's first sync doesn't wipe their state.
      //
      // Parallelised with Promise.all — used to be a for-await loop
      // that fired 14 categories + 13 labels = 27 sequential POSTs,
      // adding ~3-30s to the first sync depending on backend latency.
      // Per-row failures are swallowed individually so one bad seed
      // doesn't block the rest, and Promise.allSettled keeps the
      // batch atomic even if some entries reject.
      if (serverCats.length === 0 && get().categories.length > 0) {
        const localCats = get().categories;
        const results = await Promise.allSettled(
          localCats.map((cat) =>
            categoriesApi.create({
              name: cat.name,
              kind: cat.kind as CategoryKindDto,
              icon: cat.icon as string,
              color: cat.color,
            }),
          ),
        );
        const pushed: ApiCategory[] = [];
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            pushed.push(res.value.data);
          } else {
            console.warn(
              'Failed to bootstrap category to backend',
              localCats[i].name,
              res.reason,
            );
          }
        });
        serverCats = pushed;
      }
      if (serverLbls.length === 0 && get().labels.length > 0) {
        const localLbls = get().labels;
        const results = await Promise.allSettled(
          localLbls.map((lbl) => labelsApi.create(lbl.name)),
        );
        const pushed: ApiLabel[] = [];
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') {
            pushed.push(res.value.data);
          } else {
            console.warn(
              'Failed to bootstrap label to backend',
              localLbls[i].name,
              res.reason,
            );
          }
        });
        serverLbls = pushed;
      }

      set({
        categories: serverCats.map(apiToCategory),
        labels: serverLbls.map(apiToLabel),
      });
    } catch (err) {
      // Backend unreachable / 401 / offline — keep local state and warn.
      console.warn('Vault Config sync failed; using local state', err);
    }
  },

  addCategory: cat => {
    const localId = mintId('cat');
    const created: Category = {
      id: localId,
      name: cat.name.trim() || 'Untitled',
      kind: cat.kind,
      icon: cat.icon || DEFAULT_CATEGORY_ICON,
      color: cat.color || DEFAULT_CATEGORY_COLOR,
    };
    set(state => ({ categories: [...state.categories, created] }));

    // Fire-and-forget backend write. On success, swap the temp id with
    // the server's numeric id so subsequent update / delete writes hit
    // the right row.
    categoriesApi
      .create({
        name: created.name,
        kind: created.kind as CategoryKindDto,
        icon: created.icon as string,
        color: created.color,
      })
      .then(res => {
        set(state => ({
          categories: state.categories.map(c =>
            c.id === localId ? { ...c, id: String(res.data.id) } : c,
          ),
        }));
      })
      .catch(err => console.warn('Failed to sync new category to backend', err));

    return created;
  },

  updateCategory: (id, patch) => {
    set(state => ({
      categories: state.categories.map(c =>
        c.id === id
          ? {
              ...c,
              ...patch,
              name: patch.name !== undefined ? patch.name.trim() || c.name : c.name,
            }
          : c,
      ),
    }));
    if (isServerId(id)) {
      const trimmedName =
        patch.name !== undefined ? patch.name.trim() || undefined : undefined;
      categoriesApi
        .update(Number(id), {
          name: trimmedName,
          kind: patch.kind as CategoryKindDto | undefined,
          icon: patch.icon as string | undefined,
          color: patch.color,
        })
        .catch(err => console.warn('Failed to sync category update', err));
    }
  },

  deleteCategory: id => {
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }));
    if (isServerId(id)) {
      categoriesApi
        .remove(Number(id))
        .catch(err => console.warn('Failed to sync category delete', err));
    }
  },

  reorderCategories: (kind, orderedIds) =>
    set(state => {
      const byId = new Map(state.categories.map(c => [c.id, c]));
      const orderedSubset = orderedIds
        .map(id => byId.get(id))
        .filter((c): c is Category => !!c && c.kind === kind);
      const other = state.categories.filter(c => c.kind !== kind);
      const firstKindIndex = state.categories.findIndex(c => c.kind === kind);
      const next = [...other];
      const insertAt = firstKindIndex === -1 ? next.length : firstKindIndex;
      next.splice(insertAt, 0, ...orderedSubset);
      return { categories: next };
    }),

  addLabel: name => {
    const localId = mintId('lbl');
    const created: Label = { id: localId, name: name.trim() || 'Untitled' };
    set(state => ({ labels: [...state.labels, created] }));

    labelsApi
      .create(created.name)
      .then(res => {
        set(state => ({
          labels: state.labels.map(l =>
            l.id === localId ? { ...l, id: String(res.data.id) } : l,
          ),
        }));
      })
      .catch(err => console.warn('Failed to sync new label to backend', err));

    return created;
  },

  updateLabel: (id, name) => {
    const trimmed = name.trim();
    set(state => ({
      labels: state.labels.map(l => (l.id === id ? { ...l, name: trimmed || l.name } : l)),
    }));
    if (isServerId(id) && trimmed) {
      labelsApi
        .update(Number(id), trimmed)
        .catch(err => console.warn('Failed to sync label update', err));
    }
  },

  deleteLabel: id => {
    set(state => ({ labels: state.labels.filter(l => l.id !== id) }));
    if (isServerId(id)) {
      labelsApi
        .remove(Number(id))
        .catch(err => console.warn('Failed to sync label delete', err));
    }
  },
}));

// Convenience selectors for views that don't need the full state.
export const selectExpenseCategories = (s: CategoriesState) =>
  s.categories.filter(c => c.kind === 'expense');
export const selectIncomeCategories = (s: CategoriesState) =>
  s.categories.filter(c => c.kind === 'income');

/**
 * CRUD coverage for ``useCategoriesStore`` — the Zustand store backing
 * the Categories + Labels management screens accessed from
 * Settings → Vault Config.
 *
 * The store now fires backend write-through calls via apiClient.
 * Tests mock the API so the synchronous CRUD assertions don't depend
 * on a live backend; the async writes resolve with sentinel ids but
 * the test focuses on the local-state behaviour the UI relies on.
 */

jest.mock('../../services/apiClient', () => {
  const fakeCreate = (prefix: string) =>
    jest.fn(async (..._args: any[]) => ({
      data: { id: 99999, name: 'mock' },
    }));
  return {
    categoriesApi: {
      list: jest.fn(async () => ({ data: [] })),
      create: fakeCreate('cat'),
      update: jest.fn(async () => ({ data: { id: 99999 } })),
      remove: jest.fn(async () => ({ data: { success: true } })),
    },
    labelsApi: {
      list: jest.fn(async () => ({ data: [] })),
      create: jest.fn(async (..._args: any[]) => ({ data: { id: 99999, name: 'mock' } })),
      update: jest.fn(async () => ({ data: { id: 99999 } })),
      remove: jest.fn(async () => ({ data: { success: true } })),
      setForTransaction: jest.fn(async () => ({ data: [] })),
    },
  };
});

import { useCategoriesStore } from '../../store/useCategoriesStore';

const reset = () => {
  // Re-seed by re-importing — store has only one module-level instance,
  // so we explicitly reset to a known minimal shape between tests.
  useCategoriesStore.setState({
    categories: [
      { id: 'c1', name: 'Food', kind: 'expense', icon: 'restaurant', color: '#FFB547' },
      { id: 'c2', name: 'Transport', kind: 'expense', icon: 'car', color: '#5BA3FF' },
      { id: 'c3', name: 'Salary', kind: 'income', icon: 'cash', color: '#5BE0B0' },
    ],
    labels: [
      { id: 'l1', name: 'Wants' },
      { id: 'l2', name: 'Needs' },
    ],
  });
};

describe('useCategoriesStore — categories', () => {
  beforeEach(reset);

  it('adds a category with a fresh id and trimmed name', () => {
    const created = useCategoriesStore.getState().addCategory({
      name: '  Coffee Runs  ',
      kind: 'expense',
      icon: 'cafe',
      color: '#FF6B4A',
    });

    expect(created.id).toMatch(/^cat_/);
    expect(created.name).toBe('Coffee Runs');
    const categories = useCategoriesStore.getState().categories;
    expect(categories).toHaveLength(4);
    expect(categories.at(-1)).toEqual(created);
  });

  it('falls back to "Untitled" if the name is empty after trimming', () => {
    const created = useCategoriesStore.getState().addCategory({
      name: '   ',
      kind: 'expense',
      icon: 'cafe',
      color: '#FF6B4A',
    });
    expect(created.name).toBe('Untitled');
  });

  it('updates a category without changing untouched fields', () => {
    useCategoriesStore.getState().updateCategory('c1', { name: 'Dining Out' });
    const cat = useCategoriesStore.getState().categories.find(c => c.id === 'c1')!;
    expect(cat.name).toBe('Dining Out');
    expect(cat.icon).toBe('restaurant');
    expect(cat.color).toBe('#FFB547');
  });

  it('keeps the existing name when the patch sends an empty string', () => {
    useCategoriesStore.getState().updateCategory('c1', { name: '  ' });
    const cat = useCategoriesStore.getState().categories.find(c => c.id === 'c1')!;
    expect(cat.name).toBe('Food');
  });

  it('deletes a category by id', () => {
    useCategoriesStore.getState().deleteCategory('c2');
    const ids = useCategoriesStore.getState().categories.map(c => c.id);
    expect(ids).toEqual(['c1', 'c3']);
  });

  it('reorders only the targeted kind, leaving the other kind untouched', () => {
    // Reverse the expense list, keep income alone.
    useCategoriesStore.getState().reorderCategories('expense', ['c2', 'c1']);
    const cats = useCategoriesStore.getState().categories;
    // The expense subset is now [c2, c1], in that order. The income row
    // (c3) is preserved.
    expect(cats.map(c => c.id)).toContain('c3');
    const expenses = cats.filter(c => c.kind === 'expense').map(c => c.id);
    expect(expenses).toEqual(['c2', 'c1']);
  });

  it('drops unknown ids from a reorder call', () => {
    useCategoriesStore
      .getState()
      .reorderCategories('expense', ['c2', 'does-not-exist', 'c1']);
    const expenses = useCategoriesStore
      .getState()
      .categories.filter(c => c.kind === 'expense')
      .map(c => c.id);
    expect(expenses).toEqual(['c2', 'c1']);
  });
});

describe('useCategoriesStore — labels', () => {
  beforeEach(reset);

  it('adds a label with a fresh id and trimmed name', () => {
    const created = useCategoriesStore.getState().addLabel('  Reimbursable  ');
    expect(created.id).toMatch(/^lbl_/);
    expect(created.name).toBe('Reimbursable');
    expect(useCategoriesStore.getState().labels).toHaveLength(3);
  });

  it('renames a label and trims whitespace', () => {
    useCategoriesStore.getState().updateLabel('l1', '  Trip-2026  ');
    const lbl = useCategoriesStore.getState().labels.find(l => l.id === 'l1')!;
    expect(lbl.name).toBe('Trip-2026');
  });

  it('keeps the existing label name when patched with an empty string', () => {
    useCategoriesStore.getState().updateLabel('l1', '  ');
    const lbl = useCategoriesStore.getState().labels.find(l => l.id === 'l1')!;
    expect(lbl.name).toBe('Wants');
  });

  it('deletes a label by id', () => {
    useCategoriesStore.getState().deleteLabel('l1');
    const ids = useCategoriesStore.getState().labels.map(l => l.id);
    expect(ids).toEqual(['l2']);
  });
});

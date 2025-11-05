/**
 * 剪贴板状态管理
 */
import { create } from 'zustand';
import type { ClipboardItem, ClipboardFilter } from '../types';

interface ClipboardState {
  items: ClipboardItem[];
  total: number;
  currentPage: number;
  pageSize: number;
  filter: ClipboardFilter;
  selectedIds: number[];

  setItems: (items: ClipboardItem[], total: number) => void;
  addItem: (item: ClipboardItem) => void;
  updateItem: (id: number, data: Partial<ClipboardItem>) => void;
  moveItemToTop: (id: number, updatedData?: Partial<ClipboardItem>) => void;
  removeItem: (id: number) => void;
  removeItems: (ids: number[]) => void;
  setFilter: (filter: Partial<ClipboardFilter>) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  reset: () => void;
}

const initialFilter: ClipboardFilter = {
  page: 1,
  page_size: 20,
};

export const useClipboardStore = create<ClipboardState>((set) => ({
  items: [],
  total: 0,
  currentPage: 1,
  pageSize: 20,
  filter: initialFilter,
  selectedIds: [],

  setItems: (items, total) => {
    set({ items, total });
  },

  addItem: (item) => {
    set((state) => ({
      items: [item, ...state.items],
      total: state.total + 1,
    }));
  },

  updateItem: (id, data) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...data } : item
      ),
    }));
  },

  moveItemToTop: (id, updatedData) => {
    set((state) => {
      const itemIndex = state.items.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        // 如果项不在当前列表中，不做处理
        return state;
      }

      // 获取该项并更新数据
      const item = state.items[itemIndex];
      const updatedItem = updatedData ? { ...item, ...updatedData } : item;

      // 移除该项并将其添加到顶部
      const newItems = [
        updatedItem,
        ...state.items.slice(0, itemIndex),
        ...state.items.slice(itemIndex + 1),
      ];

      return {
        items: newItems,
      };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      total: state.total - 1,
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }));
  },

  removeItems: (ids) => {
    set((state) => ({
      items: state.items.filter((item) => !ids.includes(item.id)),
      total: state.total - ids.length,
      selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
    }));
  },

  setFilter: (newFilter) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
      currentPage: newFilter.page || state.currentPage,
    }));
  },

  setPage: (page) => {
    set((state) => ({
      currentPage: page,
      filter: { ...state.filter, page },
    }));
  },

  setPageSize: (pageSize) => {
    set((state) => ({
      pageSize,
      filter: { ...state.filter, page_size: pageSize, page: 1 },
      currentPage: 1,
    }));
  },

  toggleSelection: (id) => {
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedIds, id],
    }));
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: state.items.map((item) => item.id),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  reset: () => {
    set({
      items: [],
      total: 0,
      currentPage: 1,
      pageSize: 20,
      filter: initialFilter,
      selectedIds: [],
    });
  },
}));

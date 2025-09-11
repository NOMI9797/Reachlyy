"use client";
import { create } from "zustand";

export const useScrapeStore = create((set) => ({
  items: [],
  setItems: (items) => set({ items: Array.isArray(items) ? items : [] }),
  clear: () => set({ items: [] }),
}));



"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useScrapeStore = create(
  persist(
    (set) => ({
      items: [],
      setItems: (items) => set({ items: Array.isArray(items) ? items : [] }),
      clear: () => set({ items: [] }),
      
      // Progress state (not persisted)
      progress: 0,
      status: "",
      isStreaming: false,
      setProgress: (progress) => set({ progress }),
      setStatus: (status) => set({ status }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      updateProgress: (progress, status) => set({ progress, status }),
      resetProgress: () => set({ progress: 0, status: "", isStreaming: false }),
    }),
    {
      name: "scrape-store", // unique name for localStorage key
      partialize: (state) => ({ items: state.items }), // only persist items, not progress state
    }
  )
);



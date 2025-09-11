"use client";
import { create } from "zustand";

export const useScrapeStore = create((set) => ({
  items: [],
  setItems: (items) => set({ items: Array.isArray(items) ? items : [] }),
  clear: () => set({ items: [] }),
  
  // Progress state
  progress: 0,
  status: "",
  isStreaming: false,
  setProgress: (progress) => set({ progress }),
  setStatus: (status) => set({ status }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  updateProgress: (progress, status) => set({ progress, status }),
  resetProgress: () => set({ progress: 0, status: "", isStreaming: false }),
}));



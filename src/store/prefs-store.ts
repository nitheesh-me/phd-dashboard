import { create } from "zustand";
import { loadUiPreferences, persistUiPreferences } from "@/lib/persistence";
import type { UiPreferences } from "@/lib/types/local";

function applyPrefsToDOM(prefs: UiPreferences) {
  document.documentElement.dataset.density = prefs.density;
  document.documentElement.dataset.tone = prefs.tone;
}

type PrefsStore = {
  prefs: UiPreferences;
  setPrefs: (updater: Partial<UiPreferences> | ((p: UiPreferences) => UiPreferences)) => void;
};

export const usePrefsStore = create<PrefsStore>((set) => ({
  prefs: (() => {
    const p = loadUiPreferences();
    applyPrefsToDOM(p);
    return p;
  })(),
  setPrefs: (updater) =>
    set((state) => {
      const next =
        typeof updater === "function"
          ? updater(state.prefs)
          : { ...state.prefs, ...updater };
      applyPrefsToDOM(next);
      persistUiPreferences(next);
      return { prefs: next };
    }),
}));

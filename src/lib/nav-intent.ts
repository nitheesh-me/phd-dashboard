/**
 * Simple module-level store for "navigate and select" intents.
 * Dashboard cards call setNavSelect(page, id) before navigating,
 * and each page calls consumeNavSelect(page) on mount to auto-select the item.
 */

type Page = "references" | "projects" | "venues" | "submissions";

const pending: Partial<Record<Page, string>> = {};

export function setNavSelect(page: Page, id: string): void {
  pending[page] = id;
}

export function consumeNavSelect(page: Page): string | null {
  const id = pending[page] ?? null;
  delete pending[page];
  return id;
}

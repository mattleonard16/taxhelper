"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcuts {
  [key: string]: () => void;
}

interface UseKeyboardShortcutsOptions {
  /** Whether to enable shortcuts (defaults to true) */
  enabled?: boolean;
  /** Shortcuts should not fire when focus is in an input/textarea */
  ignoreInputs?: boolean;
}

/**
 * Hook for handling keyboard shortcuts
 * 
 * @param shortcuts - Object mapping key combos to handlers
 *   - Simple keys: "n", "Escape"
 *   - With modifiers: "ctrl+k", "meta+shift+p"
 * @param options - Configuration options
 * 
 * @example
 * useKeyboardShortcuts({
 *   "n": () => setFormOpen(true),
 *   "Escape": () => setFormOpen(false),
 *   "ctrl+k": () => focusSearch(),
 * });
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcuts,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, ignoreInputs = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if shortcuts are disabled
      if (!enabled) return;

      // Skip if focus is in an input element
      if (ignoreInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          target.isContentEditable
        ) {
          // Still allow Escape in inputs
          if (event.key !== "Escape") {
            return;
          }
        }
      }

      // Build the key combo string
      const parts: string[] = [];
      if (event.ctrlKey) parts.push("ctrl");
      if (event.metaKey) parts.push("meta");
      if (event.altKey) parts.push("alt");
      if (event.shiftKey) parts.push("shift");
      parts.push(event.key.toLowerCase());
      const combo = parts.join("+");

      // Also check just the key for simple shortcuts
      const simpleKey = event.key.toLowerCase();

      // Try the full combo first, then the simple key
      const handler = shortcuts[combo] || shortcuts[simpleKey] || shortcuts[event.key];

      if (handler) {
        event.preventDefault();
        handler();
      }
    },
    [shortcuts, enabled, ignoreInputs]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

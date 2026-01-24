import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl !== undefined 
          ? (shortcut.ctrl ? (event.ctrlKey || event.metaKey) : (!event.ctrlKey && !event.metaKey))
          : true;
        const shiftMatch = shortcut.shift !== undefined
          ? (shortcut.shift ? event.shiftKey : !event.shiftKey)
          : true;
        const altMatch = shortcut.alt !== undefined
          ? (shortcut.alt ? event.altKey : !event.altKey)
          : true;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}


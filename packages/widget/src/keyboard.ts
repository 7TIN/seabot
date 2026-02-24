interface KeyboardShortcutOptions {
  onToggle: () => void;
  onClose: () => void;
}

interface KeyboardShortcutController {
  destroy: () => void;
}

export function registerKeyboardShortcuts(
  options: KeyboardShortcutOptions
): KeyboardShortcutController {
  const onKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      options.onToggle();
      return;
    }

    if (event.key === "Escape") {
      options.onClose();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
    }
  };
}

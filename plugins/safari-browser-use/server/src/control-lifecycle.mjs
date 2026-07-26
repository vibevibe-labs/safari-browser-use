export function createControlLifecycle({ show, refresh, hide }) {
  let activeTabId = null;

  return {
    activate(tabId) {
      const nextTabId = String(tabId);

      if (activeTabId === nextTabId) {
        refresh(nextTabId);
        return;
      }

      if (activeTabId !== null && activeTabId !== nextTabId) {
        hide(activeTabId);
      }

      activeTabId = nextTabId;
      show(nextTabId);
    },

    release() {
      if (activeTabId === null) {
        return;
      }

      const releasedTabId = activeTabId;
      activeTabId = null;
      hide(releasedTabId);
    }
  };
}

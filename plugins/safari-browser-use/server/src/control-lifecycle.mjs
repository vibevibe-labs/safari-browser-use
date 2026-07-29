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

export function restoreControlAfterNavigation(options) {
  const inspect = options.inspect;
  const restore = options.restore;
  const sleep = options.sleep;
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? 50;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const changeTimeoutMs = Math.min(
    options.changeTimeoutMs ?? 250,
    timeoutMs
  );
  const startedAt = now();
  const changeDeadline = startedAt + changeTimeoutMs;
  const deadline = startedAt + timeoutMs;
  let navigationStarted = false;
  let lastDocumentId = options.initialDocumentId;

  function result(changed, restored, documentId) {
    return { changed, documentId, restored };
  }

  function restoreAndVerify(state, changed) {
    if (
      state.readyState !== "interactive" &&
      state.readyState !== "complete"
    ) {
      return null;
    }

    if (state.controlVisible) {
      return result(changed, false, state.documentId);
    }

    try {
      restore();
      const verified = inspect();

      if (
        verified.documentId === state.documentId &&
        verified.controlVisible
      ) {
        return result(changed, true, state.documentId);
      }
    } catch (error) {
      // The replacement document may still be loading.
    }

    return null;
  }

  while (now() <= deadline) {
    try {
      const state = inspect();
      const changed =
        state.documentId !== options.initialDocumentId;
      const tabUrlChanged = state.tabUrl !== options.initialUrl;
      const pageMatchesTab = state.url === state.tabUrl;
      lastDocumentId = state.documentId;

      if (changed) {
        navigationStarted = true;
        const restored = restoreAndVerify(state, true);

        if (restored) {
          return restored;
        }
      } else if (!state.controlVisible && pageMatchesTab) {
        const restored = restoreAndVerify(state, false);

        if (restored) {
          return restored;
        }
      } else if (tabUrlChanged && pageMatchesTab) {
        return result(false, false, state.documentId);
      } else if (tabUrlChanged) {
        navigationStarted = true;
      } else if (!navigationStarted && now() >= changeDeadline) {
        return result(false, false, state.documentId);
      }
    } catch (error) {
      navigationStarted = true;
    }

    sleep(intervalMs);
  }

  if (navigationStarted) {
    throw new Error("control_indicator_restore_timeout");
  }

  return result(false, false, lastDocumentId);
}

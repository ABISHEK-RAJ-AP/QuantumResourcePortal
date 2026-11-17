let openPanel: (() => void) | null = null

export function registerNotificationPanelOpener(fn: () => void) {
  openPanel = fn
  return () => {
    if (openPanel === fn) openPanel = null
  }
}

export function openNotificationPanel() {
  openPanel?.()
}
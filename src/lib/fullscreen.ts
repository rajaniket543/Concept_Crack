export async function enterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  try {
    if (document.fullscreenElement) return true;
    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return true;
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
      return true;
    }
    if (root.msRequestFullscreen) {
      await root.msRequestFullscreen();
      return true;
    }
  } catch {
    // Some browsers block fullscreen outside a direct user gesture.
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };

  try {
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) return;
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    else if (doc.msExitFullscreen) await doc.msExitFullscreen();
  } catch {
    // Nothing to do if the browser refuses — the tab just stays fullscreen.
  }
}

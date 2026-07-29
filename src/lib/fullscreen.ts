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

/**
 * Shape of the `window.reachForTheSky` debug hook. Declared as a real
 * module (not just ambient types) so both the app (GameCanvas) and the e2e
 * test helpers can import it — no two separately-drifting declarations.
 */
export interface ReachForTheSkyDebug {
  getView: () =>
    | {
        panX: number;
        panY: number;
        zoom: number;
        lensMode: string;
        selectedTool: string | null;
      }
    | null;
  getClock: () => { day: number; tick: number; speed: number } | null;
  getItemCount: () => number;
}

declare global {
  interface Window {
    reachForTheSky?: ReachForTheSkyDebug;
  }
}

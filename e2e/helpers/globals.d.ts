// Mirror of the runtime debug hook declared in
// app/components/GameCanvas.tsx. e2e tests don't share the app's tsconfig
// so we re-declare the Window contract here for type-safe
// page.evaluate() bodies.

declare global {
  interface Window {
    reachForTheSky?: {
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
    };
  }
}

export {};

import { useEffect, useRef } from "react";

export function useGameLoop(
  tick: (deltaMs: number, elapsedMs: number) => void,
  deps: unknown[] = []
) {
  const tickRef = useRef(tick);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    let frame = 0;
    let start = 0;
    let last = 0;

    const loop = (time: number) => {
      if (start === 0) {
        start = time;
        last = time;
      }
      const delta = time - last;
      const elapsed = time - start;
      last = time;
      tickRef.current(delta, elapsed);
      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps is intentionally passed as a forwarded dependency array, matching the useEffect API
  }, deps);
}

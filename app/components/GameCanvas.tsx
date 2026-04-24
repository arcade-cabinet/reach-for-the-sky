import { createEffect, onCleanup, onMount } from 'solid-js';
import { CutawayRenderer, type RenderStats } from '@/rendering/cutawayRenderer';
import { inspectGridCell, setBuildDrag, setCamera } from '@/state/actions';
import { useTrait } from '@/state/solid';
import {
  BuildDragTrait,
  ClockTrait,
  EconomyTrait,
  MacroTrait,
  OperationsTrait,
  TowerTrait,
  ViewTrait,
} from '@/state/traits';
import { gameWorld } from '@/state/world';

function requireValue<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

declare global {
  interface Window {
    reachForTheSkyRenderer?: {
      getStats: () => RenderStats;
      resetStats: () => void;
    };
    reachForTheSky?: {
      /** Current ViewTrait snapshot (pan + zoom + lens + tool). Used by e2e
       * tests to translate grid coordinates into screen pixels for pointer
       * drags, without having to hard-code scenario pan/zoom values. */
      getView: () =>
        | { panX: number; panY: number; zoom: number; lensMode: string; selectedTool: string | null }
        | null;
      /** Current ClockTrait snapshot — day/tick/speed. */
      getClock: () => { day: number; tick: number; speed: number } | null;
      /** Count of built tower items (rooms/floors/elevators). */
      getItemCount: () => number;
    };
  }
}

export function GameCanvas(props: { onBuildCommitted: () => void }) {
  const tower = useTrait(gameWorld, TowerTrait);
  const economy = useTrait(gameWorld, EconomyTrait);
  const macro = useTrait(gameWorld, MacroTrait);
  const operations = useTrait(gameWorld, OperationsTrait);
  const clock = useTrait(gameWorld, ClockTrait);
  const view = useTrait(gameWorld, ViewTrait);
  const drag = useTrait(gameWorld, BuildDragTrait);
  let host!: HTMLDivElement;
  let renderer: CutawayRenderer;
  let panning = false;
  let lastX = 0;
  let lastY = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let canInspect = false;
  let dragStart: { gx: number; gy: number } | null = null;
  let renderFrame = 0;

  const renderCurrent = () => {
    renderer?.render({
      tower: requireValue(tower(), 'tower'),
      economy: requireValue(economy(), 'economy'),
      macro: requireValue(macro(), 'macro'),
      operations: requireValue(operations(), 'operations'),
      clock: requireValue(clock(), 'clock'),
      view: requireValue(view(), 'view'),
      drag: drag()?.drag ?? null,
    });
  };

  const requestRender = () => {
    if (renderFrame) return;
    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = 0;
      renderCurrent();
    });
  };

  onMount(() => {
    // Warn (don't crash) if a prior GameCanvas instance's onCleanup didn't
    // run — this happens when a browser test remounts without `cleanup()`
    // between cases and would otherwise leak a CutawayRenderer + WebGL
    // context per remount.
    if (window.reachForTheSkyRenderer || window.reachForTheSky) {
      // biome-ignore lint/suspicious/noConsole: testability warning
      console.warn(
        '[reach-for-the-sky] GameCanvas mounted while prior debug hooks still present — previous instance may have leaked. Call cleanup() between mounts.',
      );
    }
    renderer = new CutawayRenderer();
    window.reachForTheSkyRenderer = {
      getStats: () => renderer.getRenderStats(),
      resetStats: () => renderer.resetRenderStats(),
    };
    window.reachForTheSky = {
      getView: () => {
        const v = view();
        if (!v) return null;
        return {
          panX: v.panX,
          panY: v.panY,
          zoom: v.zoom,
          lensMode: v.lensMode,
          selectedTool: v.selectedTool,
        };
      },
      getClock: () => {
        const c = clock();
        return c ? { day: c.day, tick: c.tick, speed: c.speed } : null;
      },
      getItemCount: () => {
        const t = tower();
        if (!t) return 0;
        return (
          t.rooms.length + t.shafts.length + t.elevators.length
        );
      },
    };
    void renderer.init(host).then(requestRender);
    onCleanup(() => {
      if (renderFrame) window.cancelAnimationFrame(renderFrame);
      delete window.reachForTheSkyRenderer;
      delete window.reachForTheSky;
      renderer.destroy();
    });
  });

  createEffect(() => {
    tower();
    economy();
    macro();
    operations();
    clock();
    view();
    drag();
    requestRender();
  });

  const pointerToGrid = (event: PointerEvent) =>
    renderer.screenToGrid(event.clientX, event.clientY, requireValue(view(), 'view'));

  const onPointerDown = (event: PointerEvent) => {
    host.setPointerCapture(event.pointerId);
    const currentView = requireValue(view(), 'view');
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    canInspect =
      event.button === 0 && (!currentView.selectedTool || currentView.lensMode !== 'normal');
    if (
      event.button === 1 ||
      event.button === 2 ||
      !currentView.selectedTool ||
      currentView.lensMode !== 'normal'
    ) {
      panning = true;
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }
    dragStart = pointerToGrid(event);
    setBuildDrag({ start: dragStart, end: dragStart });
  };

  const onPointerMove = (event: PointerEvent) => {
    const currentView = requireValue(view(), 'view');
    if (panning) {
      setCamera(
        currentView.panX + event.clientX - lastX,
        currentView.panY + event.clientY - lastY,
        currentView.zoom,
      );
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }
    if (dragStart) setBuildDrag({ start: dragStart, end: pointerToGrid(event) });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (dragStart) props.onBuildCommitted();
    else if (panning && canInspect) {
      const moved = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
      if (moved < 6) inspectGridCell(pointerToGrid(event));
    }
    panning = false;
    canInspect = false;
    dragStart = null;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const currentView = requireValue(view(), 'view');
    const nextZoom = Math.max(0.35, Math.min(4, currentView.zoom - event.deltaY * 0.001));
    setCamera(currentView.panX, currentView.panY, nextZoom);
  };

  return (
    <div
      ref={host}
      class="canvas-host"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

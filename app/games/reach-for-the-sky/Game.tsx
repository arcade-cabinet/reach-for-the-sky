import {
  browserTestCanvasGlOptions,
  GameViewport,
  OverlayButton,
  PhaseTrait,
  StartScreen,
  useGameLoop,
} from "@app/shared";
import {
  advanceSkyState,
  calculatePopulation,
  canAffordBuilding,
  createInitialSkyState,
  createPlacedBuilding,
  createStarterTower,
} from "@logic/games/reach-for-the-sky/engine/towerPlanning";
import { BUILDINGS, type BuildingId } from "@logic/games/reach-for-the-sky/engine/types";
import { SkyTrait, TowerTrait } from "@logic/games/reach-for-the-sky/store/traits";
import { skyEntity, skyWorld } from "@logic/games/reach-for-the-sky/store/world";
import { Canvas } from "@react-three/fiber";
import { useTrait, WorldProvider } from "koota/react";
import { useCallback, useState } from "react";
import { World } from "./r3f/World";
import { HUD } from "./ui/HUD";

function SkyApp() {
  const phase = (useTrait(skyEntity, PhaseTrait) as { phase: string } | undefined)?.phase ?? "menu";
  const [selectedTool, setSelectedTool] = useState<BuildingId | null>(null);

  useGameLoop(
    (_deltaMs) => {
      if (phase !== "playing") return;

      const state = skyEntity.get(SkyTrait);
      if (!state) return;

      const tower = skyEntity.get(TowerTrait);
      skyEntity.set(SkyTrait, advanceSkyState(state, tower?.buildings ?? [], 1));
    },
    [phase]
  );

  const handleStart = () => {
    skyEntity.set(PhaseTrait, { phase: "playing" });
    skyEntity.set(SkyTrait, createInitialSkyState());
    skyEntity.set(TowerTrait, { buildings: createStarterTower() });
  };

  const placeSelectedBuilding = useCallback(() => {
    if (!selectedTool || phase !== "playing") return;

    const tower = skyEntity.get(TowerTrait);
    const state = skyEntity.get(SkyTrait);
    if (!tower || !state || !canAffordBuilding(state, selectedTool)) return;

    const newBuilding = createPlacedBuilding(
      tower.buildings,
      selectedTool,
      `${selectedTool}-${tower.buildings.length + 1}`
    );
    if (!newBuilding) return;

    const buildings = [...tower.buildings, newBuilding];
    skyEntity.set(TowerTrait, { buildings });
    skyEntity.set(SkyTrait, {
      ...state,
      funds: state.funds - BUILDINGS[selectedTool].cost,
      population: calculatePopulation(buildings),
    });
  }, [phase, selectedTool]);

  return (
    <GameViewport background="#050816">
      <Canvas
        shadows
        camera={{ position: [18, 34, 78], fov: 42 }}
        gl={browserTestCanvasGlOptions}
        onPointerDown={placeSelectedBuilding}
      >
        {phase === "playing" && <World />}
      </Canvas>

      {phase === "menu" && (
        <StartScreen
          accent="#1e88e5"
          title="REACH FOR THE SKY"
          subtitle="Architect, manage, and evolve your vertical empire."
          primaryAction={<OverlayButton onClick={handleStart}>Break Ground</OverlayButton>}
        />
      )}

      {phase === "playing" && (
        <HUD
          onBuildSelected={placeSelectedBuilding}
          onSelectTool={setSelectedTool}
          selectedTool={selectedTool}
        />
      )}
    </GameViewport>
  );
}

export default function Game() {
  return (
    <WorldProvider world={skyWorld}>
      <SkyApp />
    </WorldProvider>
  );
}

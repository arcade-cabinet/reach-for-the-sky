import {
  BUILDINGS,
  type BuildingData,
  type BuildingId,
  CONFIG,
} from "@logic/games/reach-for-the-sky/engine/types";
import { SkyTrait, TowerTrait } from "@logic/games/reach-for-the-sky/store/traits";
import { skyEntity } from "@logic/games/reach-for-the-sky/store/world";
import { Float, Sparkles } from "@react-three/drei";
import { useTrait } from "koota/react";

const ROOM_TYPES = new Set<BuildingId>(["lobby", "office", "condo", "cafe", "hotel", "maint"]);
const WINDOW_ROWS = [0.28, 0.5, 0.72] as const;
const RATING_GEMS = [
  "rating-gem-1",
  "rating-gem-2",
  "rating-gem-3",
  "rating-gem-4",
  "rating-gem-5",
];

function getBuildingDimensions(data: BuildingData) {
  const width = data.w * CONFIG.CELL_SIZE.w;
  const height = Math.max(data.h * CONFIG.CELL_SIZE.h, data.type === "floor" ? 0.2 : 1.2);
  const depth =
    data.type === "floor" ? 8.6 : data.type === "elevator" || data.type === "stairs" ? 7.4 : 9.8;

  return { depth, height, width };
}

function getBuildingPosition(data: BuildingData) {
  const { depth, height, width } = getBuildingDimensions(data);

  return [
    data.x * CONFIG.CELL_SIZE.w + width / 2,
    data.y * CONFIG.CELL_SIZE.h + height / 2,
    data.type === "floor" ? -0.18 : depth / 2 - 4.2,
  ] as [number, number, number];
}

function WindowGrid({ data }: { data: BuildingData }) {
  if (!ROOM_TYPES.has(data.type)) return null;

  const { depth, height, width } = getBuildingDimensions(data);
  const columns = Math.max(1, Math.floor(data.w * 1.8));
  const rows = data.type === "lobby" ? [0.46, 0.72] : WINDOW_ROWS;
  const color = data.type === "hotel" || data.type === "cafe" ? "#fde68a" : "#dbeafe";
  const windowColumns = Array.from({ length: columns }, (_, index) => ({
    id: `column-${index + 1}`,
    index,
  }));

  return (
    <group position={[0, 0, depth / 2 + 0.035]}>
      {windowColumns.map((column) =>
        rows.map((row) => (
          <mesh
            key={`window-${data.id}-${column.id}-${row}`}
            position={[
              -width / 2 + ((column.index + 1) / (columns + 1)) * width,
              -height / 2 + row * height,
              0,
            ]}
          >
            <planeGeometry args={[0.54, data.type === "lobby" ? 0.62 : 0.36]} />
            <meshBasicMaterial color={color} transparent opacity={0.74} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Building({ data }: { data: BuildingData }) {
  const info = BUILDINGS[data.type];
  const color = info.color;
  const { depth, height, width } = getBuildingDimensions(data);
  const position = getBuildingPosition(data);
  const isCore = data.type === "elevator" || data.type === "stairs";
  const isFloor = data.type === "floor";

  return (
    <group position={position}>
      <mesh castShadow={!isFloor} receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          emissive={isCore ? color : "#000000"}
          emissiveIntensity={isCore ? 0.22 : 0.03}
          metalness={isFloor ? 0.35 : 0.14}
          roughness={isFloor ? 0.42 : 0.58}
        />
      </mesh>
      {isFloor && (
        <>
          <mesh position={[0, 0.12, depth / 2 + 0.05]}>
            <boxGeometry args={[width + 0.5, 0.08, 0.2]} />
            <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.32} />
          </mesh>
          <mesh position={[0, 0.12, -depth / 2 - 0.05]}>
            <boxGeometry args={[width + 0.5, 0.08, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </>
      )}
      {isCore && (
        <mesh position={[0, 0, depth / 2 + 0.06]}>
          <boxGeometry args={[Math.max(0.34, width * 0.16), height * 0.94, 0.16]} />
          <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.42} />
        </mesh>
      )}
      <WindowGrid data={data} />
    </group>
  );
}

function TowerCrown({ rating, topY }: { rating: number; topY: number }) {
  return (
    <group position={[0, topY + 2.1, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[4.8, 5.8, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <octahedronGeometry args={[1.5]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.74} />
      </mesh>
      <Float floatIntensity={0.5} rotationIntensity={0.35} speed={0.75}>
        <mesh position={[0, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.2, 0.055, 8, 96]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.78} />
        </mesh>
      </Float>
      <pointLight position={[0, 2.4, 0]} color="#facc15" intensity={1.8} distance={34} />
      {RATING_GEMS.slice(0, rating).map((id, index) => (
        <mesh key={id} position={[(index - (rating - 1) / 2) * 1.2, 3.95, 0]}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function Tower() {
  const { buildings } = useTrait(skyEntity, TowerTrait);
  const state = useTrait(skyEntity, SkyTrait);
  const topFloor = Math.max(...buildings.map((building) => building.y + building.h));
  const topY = topFloor * CONFIG.CELL_SIZE.h;

  return (
    <group>
      <group position={[0, 0, 0]}>
        {buildings.map((building) => (
          <Building key={building.id} data={building} />
        ))}
      </group>

      <TowerCrown rating={state.stars} topY={topY} />

      <mesh position={[0, -0.52, 0]} receiveShadow>
        <boxGeometry args={[42, 0.9, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.72} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.02, 6.7]}>
        <boxGeometry args={[36, 0.16, 1.1]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0891b2" emissiveIntensity={0.34} />
      </mesh>
      <Sparkles
        count={24}
        scale={[20, topY + 8, 16]}
        position={[0, topY / 2, 2]}
        size={2}
        speed={0.22}
      />
    </group>
  );
}

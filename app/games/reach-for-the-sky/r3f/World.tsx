import { CONFIG } from "@logic/games/reach-for-the-sky/engine/types";
import { SkyTrait } from "@logic/games/reach-for-the-sky/store/traits";
import { skyEntity } from "@logic/games/reach-for-the-sky/store/world";
import { Cloud, ContactShadows, MapControls, Sky, Stars } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useTrait } from "koota/react";
import { useEffect } from "react";
import { Tower } from "./Tower";

function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    const portrait = size.height > size.width;
    camera.position.set(portrait ? 0 : 18, portrait ? 38 : 34, portrait ? 88 : 78);
    camera.lookAt(0, portrait ? 16 : 13, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

export function World() {
  const state = useTrait(skyEntity, SkyTrait);

  const hour = (state.tick / CONFIG.DAY_TICKS) * 24;
  const sunTheta = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  const sunPosition = [Math.cos(sunTheta) * 100, Math.sin(sunTheta) * 100, 50] as [
    number,
    number,
    number,
  ];
  const dayLight = state.tick > 500 && state.tick < 1550;

  return (
    <>
      <CameraRig />
      <color attach="background" args={[dayLight ? "#93c5fd" : "#07111f"]} />
      <fog attach="fog" args={[dayLight ? "#bfdbfe" : "#0f172a", 58, 170]} />
      <Sky sunPosition={sunPosition} rayleigh={dayLight ? 0.8 : 0.25} turbidity={5} />
      {!dayLight && <Stars radius={90} depth={45} count={800} factor={3} saturation={0.45} fade />}

      <ambientLight intensity={dayLight ? 0.8 : 0.28} color={dayLight ? "#e0f2fe" : "#bfdbfe"} />
      <hemisphereLight args={["#dbeafe", "#0f766e", dayLight ? 1.5 : 0.7]} />
      <directionalLight
        position={sunPosition}
        intensity={dayLight ? 1.6 : 0.22}
        color={dayLight ? "#fff7ed" : "#bfdbfe"}
        castShadow
      />
      <pointLight position={[0, 26, 28]} color="#38bdf8" intensity={1.7} distance={72} />
      <pointLight
        position={[-18, 12, 14]}
        color="#facc15"
        intensity={dayLight ? 1.3 : 0.5}
        distance={44}
      />

      <Tower />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, -3]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={dayLight ? "#0f766e" : "#052e2b"} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 18]}>
        <ringGeometry args={[24, 34, 96]} />
        <meshBasicMaterial color="#bae6fd" transparent opacity={dayLight ? 0.32 : 0.18} />
      </mesh>

      <Cloud
        position={[-36, 42, -34]}
        opacity={0.3}
        speed={0.08}
        bounds={[28, 8, 8]}
        segments={12}
      />
      <Cloud
        position={[32, 54, -48]}
        opacity={0.24}
        speed={0.06}
        bounds={[34, 10, 10]}
        segments={14}
      />
      <ContactShadows position={[0, -0.06, 0]} opacity={0.4} scale={70} blur={2.5} />

      <MapControls
        enableDamping
        enableRotate={false}
        maxDistance={120}
        minDistance={38}
        panSpeed={1.1}
        target={[0, 13, 0]}
        zoomSpeed={1.4}
      />
    </>
  );
}

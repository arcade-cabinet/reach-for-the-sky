import { HUDOverlay } from "@app/shared";
import { BUILDINGS, type BuildingId } from "@logic/games/reach-for-the-sky/engine/types";
import { SkyTrait } from "@logic/games/reach-for-the-sky/store/traits";
import { skyEntity } from "@logic/games/reach-for-the-sky/store/world";
import { useTrait } from "koota/react";
import {
  Bed,
  Briefcase,
  Coffee,
  Hammer,
  Home,
  type LucideIcon,
  Star,
  Users,
  Wrench,
} from "lucide-react";

interface HUDProps {
  onBuildSelected: () => void;
  onSelectTool: (toolId: BuildingId | null) => void;
  selectedTool: BuildingId | null;
}

export function HUD({ onBuildSelected, onSelectTool, selectedTool }: HUDProps) {
  const state = useTrait(skyEntity, SkyTrait);
  const selectedBuilding = selectedTool ? BUILDINGS[selectedTool] : null;

  const formatHour = (tick: number) => {
    const totalTicks = 2000;
    const hour = Math.floor((tick / totalTicks) * 24);
    const minute = Math.floor((((tick / totalTicks) * 24) % 1) * 60);
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const tools: { id: BuildingId; icon: LucideIcon }[] = [
    { id: "lobby", icon: Home },
    { id: "office", icon: Briefcase },
    { id: "condo", icon: Star },
    { id: "cafe", icon: Coffee },
    { id: "hotel", icon: Bed },
    { id: "maint", icon: Wrench },
  ];

  return (
    <HUDOverlay
      topLeft={
        <div style={{ fontFamily: "monospace", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>DAY {state.day}</div>
          <div style={{ fontSize: 32, fontWeight: "bold" }}>{formatHour(state.tick)}</div>
        </div>
      }
      topRight={
        <div style={{ textAlign: "right", fontFamily: "monospace", color: "#fff" }}>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#4ade80" }}>
            ${state.funds.toLocaleString()}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            <Users size={14} style={{ display: "inline", marginRight: 4 }} />
            {state.population}
          </div>
          <div style={{ color: "#facc15", fontSize: 13 }}>Rating {state.stars}/5</div>
        </div>
      }
      bottomLeft={
        <div style={{ display: "flex", gap: 8 }}>
          {tools.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => onSelectTool(selectedTool === t.id ? null : t.id)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: selectedTool === t.id ? "#3b82f6" : "rgba(15, 23, 42, 0.8)",
                border: `1px solid ${selectedTool === t.id ? "#60a5fa" : "rgba(51, 65, 85, 0.5)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title={BUILDINGS[t.id].name}
            >
              <t.icon size={24} />
            </button>
          ))}
        </div>
      }
      bottomRight={
        <div
          style={{
            alignItems: "center",
            color: "#e2e8f0",
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            minWidth: 190,
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: "0.14em" }}>
              {selectedBuilding?.name ?? "Select"}
            </div>
            <div style={{ color: "#facc15", fontFamily: "monospace", fontSize: 18 }}>
              {selectedBuilding ? `$${selectedBuilding.cost.toLocaleString()}` : "$0"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Build selected module"
            disabled={!selectedBuilding || state.funds < selectedBuilding.cost}
            onClick={onBuildSelected}
            style={{
              alignItems: "center",
              background:
                selectedBuilding && state.funds >= selectedBuilding.cost
                  ? "linear-gradient(135deg, #2563eb, #22d3ee)"
                  : "rgba(51, 65, 85, 0.72)",
              border: "1px solid rgba(226, 232, 240, 0.4)",
              borderRadius: 8,
              color: "#f8fafc",
              cursor: selectedBuilding ? "pointer" : "not-allowed",
              display: "flex",
              height: 48,
              justifyContent: "center",
              opacity: selectedBuilding ? 1 : 0.58,
              width: 48,
            }}
            title="Build selected module"
          >
            <Hammer size={24} />
          </button>
        </div>
      }
    />
  );
}

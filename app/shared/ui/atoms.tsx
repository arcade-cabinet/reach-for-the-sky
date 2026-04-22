import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

interface GameViewportProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  background?: string;
  testId?: string;
}

export const GameViewport = forwardRef<HTMLDivElement, GameViewportProps>(function GameViewport(
  { background = "#020617", className, style, testId = "game-viewport", children, ...props },
  ref
) {
  return (
    <div
      {...props}
      ref={ref}
      className={className}
      data-testid={testId}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background,
        color: "#f8fafc",
        userSelect: "none",
        touchAction: "none",
        isolation: "isolate",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        ...style,
      }}
    >
      {children}
    </div>
  );
});

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "1rem",
  color: "#f8fafc",
  fontFamily: "Inter, system-ui, sans-serif",
};

const panelStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.78)",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "8px",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.28)",
  backdropFilter: "blur(12px)",
};

interface HUDOverlayProps extends PropsWithChildren {
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
}

export function HUDOverlay({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  children,
}: HUDOverlayProps) {
  return (
    <div style={overlayStyle} data-testid="hud-overlay">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        {topLeft ? (
          <div
            style={{ ...panelStyle, padding: "0.9rem 1rem", pointerEvents: "auto", minWidth: 220 }}
          >
            {topLeft}
          </div>
        ) : null}
        {topRight ? (
          <div
            style={{ ...panelStyle, padding: "0.9rem 1rem", pointerEvents: "auto", minWidth: 220 }}
          >
            {topRight}
          </div>
        ) : null}
      </div>
      {children ? <div style={{ flex: 1, position: "relative" }}>{children}</div> : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-end",
        }}
      >
        {bottomLeft ? (
          <div
            style={{ ...panelStyle, padding: "0.9rem 1rem", pointerEvents: "auto", minWidth: 220 }}
          >
            {bottomLeft}
          </div>
        ) : null}
        {bottomRight ? (
          <div
            style={{ ...panelStyle, padding: "0.9rem 1rem", pointerEvents: "auto", minWidth: 220 }}
          >
            {bottomRight}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface ScreenProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  accent?: string;
  testId?: string;
}

function ScreenShell({ title, subtitle, actions, accent = "#38bdf8", testId }: ScreenProps) {
  return (
    <div
      data-testid={testId}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(180deg, rgba(2, 6, 23, 0.2), rgba(2, 6, 23, 0.88)), linear-gradient(135deg, ${accent}33, rgba(15, 23, 42, 0) 48%), repeating-linear-gradient(90deg, rgba(226, 232, 240, 0.06) 0 1px, transparent 1px 42px)`,
        padding: "1.5rem",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: "36%",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.74)), repeating-linear-gradient(90deg, rgba(148,163,184,0.2) 0 2px, transparent 2px 8vw)",
          clipPath: "polygon(0 42%, 100% 18%, 100% 100%, 0 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          bottom: "22%",
          height: 2,
          background: accent,
          boxShadow: `0 0 20px ${accent}`,
          opacity: 0.62,
        }}
      />
      <div
        style={{
          ...panelStyle,
          position: "relative",
          width: "min(560px, 100%)",
          padding: "2rem",
          textAlign: "center",
          pointerEvents: "auto",
          border: `1px solid ${accent}66`,
          background: "rgba(2, 6, 23, 0.74)",
        }}
      >
        <div
          style={{
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            fontSize: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          Arcade Cabinet
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.5rem)", color: "#f8fafc" }}>
          {title}
        </h1>
        <p style={{ marginTop: "1rem", lineHeight: 1.6, color: "#cbd5e1" }}>{subtitle}</p>
        {actions ? (
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface StartScreenProps extends ScreenProps {
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export function StartScreen({ primaryAction, secondaryAction, ...props }: StartScreenProps) {
  return (
    <ScreenShell
      {...props}
      testId={props.testId ?? "start-screen"}
      actions={
        <>
          {primaryAction}
          {secondaryAction}
        </>
      }
    />
  );
}

export function GameOverScreen(props: ScreenProps) {
  return <ScreenShell {...props} testId={props.testId ?? "game-over-screen"} accent="#fb7185" />;
}

export function OverlayButton({
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        borderRadius: 999,
        border: "1px solid rgba(148, 163, 184, 0.45)",
        background: "linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(59, 130, 246, 0.55))",
        color: "#f8fafc",
        padding: "0.8rem 1.1rem",
        fontWeight: 700,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export interface JoystickVector {
  x: number;
  y: number;
  magnitude: number;
  angle: number;
}

interface FloatingJoystickProps {
  onChange: (vector: JoystickVector) => void;
  disabled?: boolean;
  label?: string;
  radius?: number;
  deadZone?: number;
  accent?: string;
  allowMouse?: boolean;
}

interface JoystickVisualState {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

const neutralJoystick: JoystickVisualState = {
  active: false,
  originX: 0,
  originY: 0,
  knobX: 0,
  knobY: 0,
};

export function FloatingJoystick({
  onChange,
  disabled = false,
  label = "Movement joystick",
  radius = 58,
  deadZone = 0.12,
  accent = "#38bdf8",
  allowMouse = false,
}: FloatingJoystickProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);
  const [visual, setVisual] = useState<JoystickVisualState>(neutralJoystick);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (disabled) {
      activePointer.current = null;
      setVisual(neutralJoystick);
      onChangeRef.current({ x: 0, y: 0, magnitude: 0, angle: 0 });
      return undefined;
    }

    const readHost = () =>
      scopeRef.current?.closest<HTMLElement>('[data-testid="game-viewport"]') ??
      scopeRef.current?.parentElement ??
      null;

    const isInsideHost = (event: PointerEvent) => {
      const host = readHost();
      if (!host) return true;

      const target = event.target;
      if (target instanceof Node && !host.contains(target)) return false;

      const rect = host.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    };

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;

      return Boolean(
        target.closest(
          "button,a,input,textarea,select,summary,[role='button'],[data-joystick-ignore='true'],[data-joystick-ignore]"
        )
      );
    };

    const updateVector = (event: PointerEvent) => {
      const rawDx = event.clientX - origin.current.x;
      const rawDy = event.clientY - origin.current.y;
      const distance = Math.hypot(rawDx, rawDy);
      const clampedDistance = Math.min(radius, distance);
      const unitX = distance > 0 ? rawDx / distance : 0;
      const unitY = distance > 0 ? rawDy / distance : 0;
      const knobX = unitX * clampedDistance;
      const knobY = unitY * clampedDistance;
      const rawMagnitude = clampedDistance / radius;
      const magnitude =
        rawMagnitude <= deadZone ? 0 : (rawMagnitude - deadZone) / Math.max(0.01, 1 - deadZone);

      setVisual({
        active: true,
        originX: origin.current.x,
        originY: origin.current.y,
        knobX,
        knobY,
      });
      onChangeRef.current({
        x: unitX * magnitude,
        y: unitY * magnitude,
        magnitude,
        angle: Math.atan2(unitY, unitX),
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (activePointer.current !== null) return;
      if (event.pointerType === "mouse" && !allowMouse) return;
      if (!isInsideHost(event)) return;
      if (isInteractiveTarget(event.target)) return;

      if (event.cancelable) event.preventDefault();
      activePointer.current = event.pointerId;
      origin.current = { x: event.clientX, y: event.clientY };
      updateVector(event);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointer.current !== event.pointerId) return;
      if (event.cancelable) event.preventDefault();
      updateVector(event);
    };

    const endPointer = (event: PointerEvent) => {
      if (activePointer.current !== event.pointerId) return;

      activePointer.current = null;
      setVisual(neutralJoystick);
      onChangeRef.current({ x: 0, y: 0, magnitude: 0, angle: 0 });
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: false });
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      activePointer.current = null;
      onChangeRef.current({ x: 0, y: 0, magnitude: 0, angle: 0 });
    };
  }, [allowMouse, deadZone, disabled, radius]);

  return (
    <div
      ref={scopeRef}
      aria-hidden={!visual.active}
      data-floating-joystick="true"
      data-joystick-ignore="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 80,
      }}
    >
      {visual.active ? (
        <div
          data-testid="floating-joystick"
          title={label}
          style={{
            position: "fixed",
            left: visual.originX,
            top: visual.originY,
            width: radius * 2,
            height: radius * 2,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `2px solid ${accent}73`,
            background: "rgba(2, 6, 23, 0.28)",
            boxShadow: `0 0 22px ${accent}3d, inset 0 0 24px rgba(255,255,255,0.08)`,
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: radius * 0.76,
              height: radius * 0.76,
              transform: `translate(calc(-50% + ${visual.knobX}px), calc(-50% + ${visual.knobY}px))`,
              borderRadius: "50%",
              background: `linear-gradient(135deg, rgba(255,255,255,0.92), ${accent})`,
              border: "2px solid rgba(255,255,255,0.72)",
              boxShadow: `0 8px 18px rgba(0,0,0,0.35), 0 0 18px ${accent}8f`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

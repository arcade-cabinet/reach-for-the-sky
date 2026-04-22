import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FloatingJoystick, type JoystickVector } from "./atoms";

afterEach(() => {
  cleanup();
});

test("FloatingJoystick opens at the pointer origin and emits normalized movement", async () => {
  const vectors: JoystickVector[] = [];
  const { getByTestId } = render(
    <div data-testid="game-viewport" style={{ width: 320, height: 320 }}>
      <FloatingJoystick allowMouse onChange={(vector) => vectors.push(vector)} />
    </div>
  );

  const host = getByTestId("game-viewport");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  host.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 120,
      clientY: 120,
      isPrimary: true,
      pointerId: 11,
      pointerType: "mouse",
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      clientX: 178,
      clientY: 120,
      isPrimary: true,
      pointerId: 11,
      pointerType: "mouse",
    })
  );

  await waitFor(() => {
    expect(document.querySelector('[data-testid="floating-joystick"]')).not.toBeNull();
    expect(vectors.at(-1)?.x).toBeGreaterThan(0.9);
    expect(Math.abs(vectors.at(-1)?.y ?? 1)).toBeLessThan(0.01);
  });

  window.dispatchEvent(
    new PointerEvent("pointerup", {
      clientX: 178,
      clientY: 120,
      isPrimary: true,
      pointerId: 11,
      pointerType: "mouse",
    })
  );

  await waitFor(() => {
    expect(vectors.at(-1)).toEqual({ x: 0, y: 0, magnitude: 0, angle: 0 });
  });
});

test("FloatingJoystick can claim a non-primary touch pointer for multi-touch controls", async () => {
  const vectors: JoystickVector[] = [];
  const { getByTestId } = render(
    <div data-testid="game-viewport" style={{ width: 320, height: 320 }}>
      <FloatingJoystick onChange={(vector) => vectors.push(vector)} />
    </div>
  );

  const host = getByTestId("game-viewport");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  host.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 80,
      clientY: 140,
      isPrimary: false,
      pointerId: 22,
      pointerType: "touch",
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      clientX: 80,
      clientY: 82,
      isPrimary: false,
      pointerId: 22,
      pointerType: "touch",
    })
  );

  await waitFor(() => {
    expect(document.querySelector('[data-testid="floating-joystick"]')).not.toBeNull();
    expect(vectors.at(-1)?.y).toBeLessThan(-0.9);
  });
});

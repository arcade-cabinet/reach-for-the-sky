import { verifyBrowserGameStartFlow } from "@app/test/browserGameHarness";
import { cleanup } from "@testing-library/react";
import { afterEach, test } from "vitest";
import Game from "./Game";

afterEach(() => {
  cleanup();
});

test("Reach for the Sky reaches gameplay from the start screen", async () => {
  await verifyBrowserGameStartFlow({
    Component: Game,
    title: "REACH FOR THE SKY",
    startFlow: ["Break Ground"],
    ready: /DAY/,
    expectsCanvas: true,
  });
});

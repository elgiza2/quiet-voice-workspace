import { it, expect } from "vitest";
import { BOT_SHAPES, lookFor } from "./botLooks";
it("never assigns star bot shapes", () => {
  expect(BOT_SHAPES.some((shape) => shape.id.includes("star"))).toBe(false);
  const shapes = Array.from({ length: 40 }, (_, i) => lookFor({ id: `bot-${i}`, name: "Bot" }).shape);
  expect(shapes.every((shape) => !shape.includes("star"))).toBe(true);
});
it("varies bot shapes", () => {
  const shapes = Array.from({ length: 40 }, (_, i) => lookFor({ id: `bot-${i}`, name: "Bot" }).shape);
  expect(new Set(shapes).size).toBeGreaterThan(4);
});
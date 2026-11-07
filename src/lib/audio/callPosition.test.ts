import { describe, expect, it } from "vitest";
import { clampCallPosition } from "./callPosition";
describe("restored call bounds", () => {
  it("keeps an expanded call inside the 434×764 conversation after dragging the small robot to an edge", () => {
    expect(clampCallPosition(370, 650, 260, 260, 434, 764)).toEqual({ x: 166, y: 416 });
  });
  it("keeps the call below the conversation header", () => {
    expect(clampCallPosition(-100, -100, 260, 260, 434, 764)).toEqual({ x: 8, y: 76 });
  });
});
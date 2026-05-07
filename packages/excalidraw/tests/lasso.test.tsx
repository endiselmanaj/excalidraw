import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

const h = window.h;

const activateLasso = () => {
  act(() => {
    h.app.setActiveTool({ type: "lasso" });
  });
};

/**
 * Drag a closed-ish loop around the rectangle (x..x+w, y..y+h) at the given
 * margin outside of it. Releases at the end.
 */
const lassoAroundRect = (
  pointer: Pointer,
  rect: { x: number; y: number; width: number; height: number },
  margin = 8,
) => {
  const left = rect.x - margin;
  const right = rect.x + rect.width + margin;
  const top = rect.y - margin;
  const bottom = rect.y + rect.height + margin;
  pointer.reset();
  pointer.downAt(left, top);
  pointer.moveTo(right, top);
  pointer.moveTo(right, bottom);
  pointer.moveTo(left, bottom);
  pointer.moveTo(left, top);
  pointer.upAt(left, top);
};

describe("lasso selection tool", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("selects a rectangle fully enclosed by the lasso", async () => {
    const rect = API.createElement({ type: "rectangle", x: 100, y: 100, width: 80, height: 60 });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    lassoAroundRect(mouse, rect);

    expect(h.state.selectedElementIds[rect.id]).toBe(true);
  });

  it("selects a rectangle whose edge is crossed by the lasso path", async () => {
    const rect = API.createElement({ type: "rectangle", x: 100, y: 100, width: 200, height: 80 });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    // a small loop that enters the rectangle's left edge, lives inside, then exits
    mouse.reset();
    mouse.downAt(80, 110);
    mouse.moveTo(160, 110);
    mouse.moveTo(160, 170);
    mouse.moveTo(80, 170);
    mouse.upAt(80, 110);

    expect(h.state.selectedElementIds[rect.id]).toBe(true);
  });

  it("selects a large filled rectangle when the lasso is drawn entirely inside it", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 600,
      height: 400,
      backgroundColor: "#ffcccc",
    });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    mouse.reset();
    mouse.downAt(200, 150);
    mouse.moveTo(260, 150);
    mouse.moveTo(260, 210);
    mouse.moveTo(200, 210);
    mouse.upAt(200, 150);

    expect(h.state.selectedElementIds[rect.id]).toBe(true);
  });

  it("only selects the rectangle the lasso encloses, not the other one", async () => {
    const inside = API.createElement({ type: "rectangle", x: 50, y: 50, width: 60, height: 60 });
    const outside = API.createElement({ type: "rectangle", x: 400, y: 400, width: 60, height: 60 });
    API.setElements([inside, outside]);
    activateLasso();

    const mouse = new Pointer("mouse");
    lassoAroundRect(mouse, inside);

    expect(h.state.selectedElementIds[inside.id]).toBe(true);
    expect(h.state.selectedElementIds[outside.id]).toBeUndefined();
  });

  it("does not select anything when the lasso has fewer than 3 points", async () => {
    const rect = API.createElement({ type: "rectangle", x: 100, y: 100, width: 80, height: 60 });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    mouse.reset();
    mouse.downAt(140, 130);
    mouse.upAt(140, 130);

    expect(h.state.selectedElementIds[rect.id]).toBeUndefined();
  });

  it("treats unfinished loops as closed via implicit closing segment", async () => {
    const rect = API.createElement({ type: "rectangle", x: 200, y: 200, width: 60, height: 60 });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    // U-shape that doesn't return to start, but the closing segment seals the loop
    mouse.reset();
    mouse.downAt(180, 180);
    mouse.moveTo(180, 280);
    mouse.moveTo(280, 280);
    mouse.upAt(280, 180);

    expect(h.state.selectedElementIds[rect.id]).toBe(true);
  });

  it("adds to the existing selection when shift is held", async () => {
    const a = API.createElement({ type: "rectangle", x: 50, y: 50, width: 60, height: 60 });
    const b = API.createElement({ type: "rectangle", x: 300, y: 50, width: 60, height: 60 });
    API.setElements([a, b]);

    activateLasso();
    // setAppState after activateLasso so the tool-switch reset doesn't drop the selection
    API.setAppState({ selectedElementIds: { [a.id]: true } });

    const mouse = new Pointer("mouse");
    Keyboard.withModifierKeys({ shift: true }, () => {
      lassoAroundRect(mouse, b);
    });

    expect(h.state.selectedElementIds[a.id]).toBe(true);
    expect(h.state.selectedElementIds[b.id]).toBe(true);
  });

  it("selects the container when its bound text is enclosed", async () => {
    const container = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      boundElements: [{ id: "text-1", type: "text" }],
    });
    const text = API.createElement({
      type: "text",
      id: "text-1",
      x: 130,
      y: 130,
      width: 80,
      height: 30,
      containerId: container.id,
    });
    API.setElements([container, text]);
    activateLasso();

    const mouse = new Pointer("mouse");
    // tight loop just around the text
    mouse.reset();
    mouse.downAt(125, 125);
    mouse.moveTo(215, 125);
    mouse.moveTo(215, 165);
    mouse.moveTo(125, 165);
    mouse.upAt(125, 125);

    expect(h.state.selectedElementIds[text.id]).toBe(true);
    expect(h.state.selectedElementIds[container.id]).toBe(true);
  });

  it("selects all members of a group when one member is enclosed", async () => {
    const groupId = "g-1";
    const a = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 60,
      height: 60,
      groupIds: [groupId],
    });
    const b = API.createElement({
      type: "rectangle",
      x: 400,
      y: 400,
      width: 60,
      height: 60,
      groupIds: [groupId],
    });
    API.setElements([a, b]);
    activateLasso();

    const mouse = new Pointer("mouse");
    lassoAroundRect(mouse, a);

    expect(h.state.selectedElementIds[a.id]).toBe(true);
    expect(h.state.selectedElementIds[b.id]).toBe(true);
  });

  it("selects a frame when enclosed by the lasso", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });
    API.setElements([frame]);
    activateLasso();

    const mouse = new Pointer("mouse");
    lassoAroundRect(mouse, frame);

    expect(h.state.selectedElementIds[frame.id]).toBe(true);
  });

  it("does not select a locked element inside the lasso", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 80,
      height: 60,
      locked: true,
    });
    API.setElements([rect]);
    activateLasso();

    const mouse = new Pointer("mouse");
    lassoAroundRect(mouse, rect);

    expect(h.state.selectedElementIds[rect.id]).toBeUndefined();
  });

  it("selects a thin diagonal arrow whose path is crossed by the lasso", async () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 200)],
    });
    API.setElements([arrow]);
    activateLasso();

    const mouse = new Pointer("mouse");
    // tight loop around the arrow's midpoint that crosses both edges
    mouse.reset();
    mouse.downAt(180, 220);
    mouse.moveTo(220, 220);
    mouse.moveTo(220, 180);
    mouse.moveTo(180, 180);
    mouse.upAt(180, 220);

    expect(h.state.selectedElementIds[arrow.id]).toBe(true);
  });
});

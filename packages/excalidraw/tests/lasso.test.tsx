import React from "react";

import { reseed } from "@excalidraw/common";
import { arrayToMap, KEYS } from "@excalidraw/common";
import { getElementLineSegments } from "@excalidraw/element";
import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";
import { getLassoSelectedElementIds } from "../lasso/utils";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  render,
  assertSelectedElements,
  unmountComponent,
} from "./test-utils";

unmountComponent();

beforeEach(() => {
  reseed(7);
});

const { h } = window;

const mouse = new Pointer("mouse");

// ---------------------------------------------------------------------------
// Unit tests: getLassoSelectedElementIds
// ---------------------------------------------------------------------------

describe("getLassoSelectedElementIds", () => {
  const makeElementsSegments = (
    elements: ReturnType<typeof API.createElement>[],
  ) => {
    const elementsMap = arrayToMap(elements);
    const segments = new Map<string, ReturnType<typeof getElementLineSegments>>();
    for (const el of elements) {
      segments.set(el.id, getElementLineSegments(el, elementsMap));
    }
    return segments;
  };

  it("selects an element fully enclosed by the lasso path", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 20,
      height: 20,
    });
    const elements = [rect];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    // Lasso path: large square around the rectangle
    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(100, 0),
      pointFrom(100, 100),
      pointFrom(0, 100),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).toContain(rect.id);
  });

  it("selects an element whose edge intersects the lasso path", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const elements = [rect];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    // Lasso path cuts through the element
    const lassoPath: GlobalPoint[] = [
      pointFrom(50, -20),
      pointFrom(150, -20),
      pointFrom(150, 50),
      pointFrom(50, 50),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).toContain(rect.id);
  });

  it("does not select an element outside the lasso path with no intersection", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
    });
    const elements = [rect];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    // Lasso path far away from element
    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(50, 0),
      pointFrom(50, 50),
      pointFrom(0, 50),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).not.toContain(rect.id);
  });

  it("does not select a locked element", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      locked: true,
    });
    const elements = [rect];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(100, 0),
      pointFrom(100, 100),
      pointFrom(0, 100),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).not.toContain(rect.id);
  });

  it("selects multiple elements with one lasso path", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 60,
      y: 10,
      width: 30,
      height: 30,
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 30,
      height: 30,
    });
    const elements = [rect1, rect2, rect3];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    // Lasso around only rect1 and rect2
    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(100, 0),
      pointFrom(100, 50),
      pointFrom(0, 50),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).toContain(rect1.id);
    expect(selectedElementIds).toContain(rect2.id);
    expect(selectedElementIds).not.toContain(rect3.id);
  });

  it("selects a diamond element enclosed by lasso", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 40,
      y: 40,
      width: 20,
      height: 20,
    });
    const elements = [diamond];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(100, 0),
      pointFrom(100, 100),
      pointFrom(0, 100),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).toContain(diamond.id);
  });

  it("selects an ellipse element enclosed by lasso", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 40,
      y: 40,
      width: 20,
      height: 20,
    });
    const elements = [ellipse];
    const elementsMap = arrayToMap(elements);
    const elementsSegments = makeElementsSegments(elements);

    const lassoPath: GlobalPoint[] = [
      pointFrom(0, 0),
      pointFrom(100, 0),
      pointFrom(100, 100),
      pointFrom(0, 100),
    ];

    const { selectedElementIds } = getLassoSelectedElementIds({
      lassoPath,
      elements,
      elementsMap,
      elementsSegments,
      intersectedElements: new Set(),
      enclosedElements: new Set(),
    });

    expect(selectedElementIds).toContain(ellipse.id);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: lasso tool in the app
// ---------------------------------------------------------------------------

describe("lasso tool", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("is registered as a tool type", () => {
    expect(h.app.setActiveTool).toBeDefined();
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });
    expect(h.state.activeTool.type).toBe("lasso");
  });

  it("can switch back to selection from lasso", () => {
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });
    expect(h.state.activeTool.type).toBe("lasso");

    act(() => {
      h.app.setActiveTool({ type: "selection" });
    });
    expect(h.state.activeTool.type).toBe("selection");
  });

  it("selects elements by drawing a lasso loop around them", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 30,
      height: 30,
    });
    API.setElements([rect1, rect2]);

    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    // Draw a lasso enclosing only rect1
    mouse.downAt(0, 0);
    mouse.moveTo(60, 0);
    mouse.moveTo(60, 60);
    mouse.moveTo(0, 60);
    mouse.moveTo(0, 0);
    mouse.upAt(0, 0);

    assertSelectedElements([rect1.id]);
  });

  it("does not select elements outside the lasso path", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
    });
    API.setElements([rect]);

    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    // Draw lasso far away from element
    mouse.downAt(0, 0);
    mouse.moveTo(50, 0);
    mouse.moveTo(50, 50);
    mouse.moveTo(0, 50);
    mouse.upAt(0, 0);

    assertSelectedElements([]);
  });

  it("adds to existing selection with shift+lasso", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 30,
      height: 30,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 30,
      height: 30,
    });
    API.setElements([rect1, rect2]);

    // First select rect1 with lasso
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });
    mouse.downAt(-10, -10);
    mouse.moveTo(50, -10);
    mouse.moveTo(50, 50);
    mouse.moveTo(-10, 50);
    mouse.upAt(-10, -10);
    assertSelectedElements([rect1.id]);

    // Then shift+lasso to add rect2
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.downAt(90, 90);
      mouse.moveTo(140, 90);
      mouse.moveTo(140, 140);
      mouse.moveTo(90, 140);
      mouse.upAt(90, 90);
    });

    assertSelectedElements([rect1.id, rect2.id]);
  });

  it("selects grouped elements together", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      groupIds: ["group1"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 40,
      y: 10,
      width: 20,
      height: 20,
      groupIds: ["group1"],
    });
    API.setElements([rect1, rect2]);

    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    // Lasso only around rect1; because they're grouped, rect2 should also be selected
    mouse.downAt(0, 0);
    mouse.moveTo(35, 0);
    mouse.moveTo(35, 40);
    mouse.moveTo(0, 40);
    mouse.upAt(0, 0);

    // Both should be selected because they're in the same group
    assertSelectedElements([rect1.id, rect2.id]);
  });

  it("clears lasso trail after pointer up", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });
    API.setElements([rect]);

    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    mouse.downAt(0, 0);
    mouse.moveTo(60, 0);
    mouse.moveTo(60, 60);
    mouse.upAt(0, 0);

    // After pointer up, the lasso trail should be cleared (no ongoing trail)
    expect(h.app.lassoTrail.hasCurrentTrail).toBe(false);
  });

  it("stays in lasso mode after selection (does not auto-reset to selection tool)", async () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 30,
      height: 30,
    });
    API.setElements([rect]);

    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    mouse.downAt(0, 0);
    mouse.moveTo(60, 0);
    mouse.moveTo(60, 60);
    mouse.moveTo(0, 60);
    mouse.upAt(0, 0);

    // Lasso tool is sticky - should remain in lasso mode
    expect(h.state.activeTool.type).toBe("lasso");
  });
});

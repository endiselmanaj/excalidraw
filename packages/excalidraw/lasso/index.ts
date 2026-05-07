import { THEME } from "@excalidraw/common";

import {
  getBoundTextElementId,
  getElementsInGroup,
  hasBoundTextElement,
  isBoundToContainer,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";

import { buildLassoGeometry, isElementInsideLasso } from "./utils";

import type { AnimationFrameHandler } from "../animation-frame-handler";

import type App from "../components/App";

export class LassoTrail extends AnimatedTrail {
  private selectedIds: Set<ExcalidrawElement["id"]> = new Set();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      animateTrail: true,
      streamline: 0.4,
      sizeMapping: () => 1,
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(105, 101, 219, 0.1)"
          : "rgba(177, 174, 248, 0.1)",
      stroke: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(105, 101, 219, 0.9)"
          : "rgba(177, 174, 248, 0.9)",
    });
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.selectedIds.clear();
  }

  addPointToPath(x: number, y: number) {
    super.addPointToPath(x, y);
    this.recomputeSelection();
    return Array.from(this.selectedIds);
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.selectedIds.clear();
  }

  selectionFromPath(): readonly ExcalidrawElement["id"][] {
    return Array.from(this.selectedIds);
  }

  private recomputeSelection() {
    const trail = super.getCurrentTrail();
    if (!trail) {
      return;
    }
    const geometry = buildLassoGeometry(
      trail.originalPoints.map((p) => [p[0], p[1]] as const),
    );
    if (!geometry) {
      this.selectedIds.clear();
      return;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const candidates = this.app.scene
      .getNonDeletedElements()
      .filter((el) => !el.locked);

    const next = new Set<ExcalidrawElement["id"]>();

    for (const element of candidates) {
      if (next.has(element.id)) {
        continue;
      }
      if (!isElementInsideLasso(element, elementsMap, geometry)) {
        continue;
      }

      next.add(element.id);

      // bound text -> container
      if (isBoundToContainer(element)) {
        next.add(element.containerId);
      }

      // container -> bound text
      if (hasBoundTextElement(element)) {
        const boundTextId = getBoundTextElementId(element);
        if (boundTextId) {
          next.add(boundTextId);
        }
      }

      // group -> all members of shallowest group
      const shallowestGroupId = element.groupIds.at(-1);
      if (shallowestGroupId) {
        const inGroup = getElementsInGroup(elementsMap, shallowestGroupId);
        for (const member of inGroup) {
          next.add(member.id);
        }
      }
    }

    this.selectedIds = next;
  }
}

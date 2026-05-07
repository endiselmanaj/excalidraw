import {
  doBoundsIntersect,
  getElementBounds,
  getElementLineSegments,
  getFreedrawOutlinePoints,
  isFreeDrawElement,
  isPointInElement,
  shouldTestInside,
} from "@excalidraw/element";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  polygon,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";
import type { GlobalPoint, LineSegment, Polygon } from "@excalidraw/math/types";

export type LassoGeometry = {
  points: readonly GlobalPoint[];
  polygon: Polygon<GlobalPoint>;
  bounds: Bounds;
  segments: readonly LineSegment<GlobalPoint>[];
};

export const buildLassoGeometry = (
  rawPoints: readonly (readonly [number, number])[],
): LassoGeometry | null => {
  if (rawPoints.length < 3) {
    return null;
  }

  const points = rawPoints.map(([x, y]) =>
    pointFrom<GlobalPoint>(x, y),
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const segments: LineSegment<GlobalPoint>[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }
  // implicit closing segment so an unfinished loop still selects
  segments.push(lineSegment(points[points.length - 1], points[0]));

  return {
    points,
    polygon: polygon(...points),
    bounds: [minX, minY, maxX, maxY] as Bounds,
    segments,
  };
};

export const isElementInsideLasso = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  geometry: LassoGeometry,
): boolean => {
  // 1. AABB pre-filter
  const elementBounds = getElementBounds(element, elementsMap);
  if (!doBoundsIntersect(elementBounds, geometry.bounds)) {
    return false;
  }

  // 2. Inside-fillable shortcut: lasso entirely inside a large filled shape
  if (
    shouldTestInside(element) &&
    isPointInElement(geometry.points[0], element, elementsMap)
  ) {
    return true;
  }

  // 3. Enclosure: any outline point inside the lasso polygon
  const outlinePoints = getElementOutlinePoints(element, elementsMap);
  for (const outlinePoint of outlinePoints) {
    if (polygonIncludesPointNonZero(outlinePoint, geometry.polygon)) {
      return true;
    }
  }

  // 4. Intersection: any element segment crosses any lasso segment
  const elementSegments = isFreeDrawElement(element)
    ? freedrawOutlineSegments(element)
    : getElementLineSegments(element, elementsMap);

  for (const elementSeg of elementSegments) {
    for (const lassoSeg of geometry.segments) {
      if (lineSegmentIntersectionPoints(elementSeg, lassoSeg) !== null) {
        return true;
      }
    }
  }

  return false;
};

const getElementOutlinePoints = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GlobalPoint[] => {
  if (isFreeDrawElement(element)) {
    return getFreedrawOutlinePoints(element).map(([x, y]) =>
      pointFrom<GlobalPoint>(element.x + x, element.y + y),
    );
  }
  // for other elements, derive outline points from element line segments;
  // each segment's endpoints are real points on the element's outline
  const segments = getElementLineSegments(element, elementsMap);
  const points: GlobalPoint[] = [];
  for (const seg of segments) {
    points.push(seg[0]);
  }
  // include the last segment's tail too, in case it's not a closed loop
  if (segments.length > 0) {
    points.push(segments[segments.length - 1][1]);
  }
  return points;
};

const freedrawOutlineSegments = (
  element: ExcalidrawElement,
): LineSegment<GlobalPoint>[] => {
  if (!isFreeDrawElement(element)) {
    return [];
  }
  const outline = getFreedrawOutlinePoints(element);
  const segments: LineSegment<GlobalPoint>[] = [];
  for (let i = 0; i < outline.length - 1; i++) {
    segments.push(
      lineSegment(
        pointFrom<GlobalPoint>(element.x + outline[i][0], element.y + outline[i][1]),
        pointFrom<GlobalPoint>(
          element.x + outline[i + 1][0],
          element.y + outline[i + 1][1],
        ),
      ),
    );
  }
  return segments;
};

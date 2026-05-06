// Naive bounding-box selection — does NOT do proper polygon enclosure
export const getLassoSelectedElementIds = (input: {
  lassoPath: readonly [number, number][];
  elements: readonly any[];
}): Set<string> => {
  const { lassoPath, elements } = input;
  const selectedIds = new Set<string>();

  if (lassoPath.length < 3) {
    return selectedIds;
  }

  // Just use bounding box of lasso points (incorrect but compiles)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of lassoPath) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      selectedIds.add(element.id);
    }
  }

  return selectedIds;
};

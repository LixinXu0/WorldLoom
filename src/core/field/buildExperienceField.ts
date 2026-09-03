import type { FieldCell, Stroke } from "../types";
import { distance } from "../geometry/distance";

export const FIELD_COLUMNS = 64;
export const FIELD_ROWS = 40;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function nearestSegmentDirection(stroke: Stroke, cell: FieldCell): { dx: number; dy: number; distance: number } {
  let best = { dx: 0, dy: 0, distance: Number.POSITIVE_INFINITY };
  for (let i = 1; i < stroke.points.length; i += 1) {
    const a = stroke.points[i - 1];
    const b = stroke.points[i];
    const segmentDistance = Math.min(distance(cell, a), distance(cell, b));
    if (segmentDistance < best.distance) {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      best = { dx: (b.x - a.x) / length, dy: (b.y - a.y) / length, distance: segmentDistance };
    }
  }
  return best;
}

export function buildExperienceField(strokes: Stroke[], width: number, height: number): FieldCell[] {
  const cells: FieldCell[] = [];
  for (let row = 0; row < FIELD_ROWS; row += 1) {
    for (let column = 0; column < FIELD_COLUMNS; column += 1) {
      const cell: FieldCell = {
        x: (column + 0.5) * (width / FIELD_COLUMNS),
        y: (row + 0.5) * (height / FIELD_ROWS),
        flowX: 0,
        flowY: 0,
        pressure: 0,
        relief: 0,
        branchPotential: 0,
      };
      for (const stroke of strokes.filter((item) => item.enabled)) {
        const sigma = Math.max(18, stroke.width * 4);
        const minDistance = Math.min(...stroke.points.map((point) => distance(cell, point)));
        const influence = stroke.intensity * Math.exp(-(minDistance * minDistance) / (2 * sigma * sigma));
        if (stroke.type === "flow") {
          const dir = nearestSegmentDirection(stroke, cell);
          const flowInfluence = influence * Math.exp(-(dir.distance * dir.distance) / (2 * sigma * sigma));
          cell.flowX += dir.dx * flowInfluence;
          cell.flowY += dir.dy * flowInfluence;
        } else if (stroke.type === "pressure") {
          cell.pressure += influence;
        } else if (stroke.type === "relief") {
          cell.relief += influence;
        } else {
          cell.branchPotential += influence;
        }
      }
      const flowMagnitude = Math.hypot(cell.flowX, cell.flowY);
      if (flowMagnitude > 1) {
        cell.flowX /= flowMagnitude;
        cell.flowY /= flowMagnitude;
      }
      cell.pressure = clamp01(cell.pressure);
      cell.relief = clamp01(cell.relief);
      cell.branchPotential = clamp01(cell.branchPotential);
      cells.push(cell);
    }
  }
  return cells;
}

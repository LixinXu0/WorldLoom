import type { FieldCell, Point } from "../types";
import { FIELD_COLUMNS, FIELD_ROWS } from "./buildExperienceField";

export function sampleField(cells: FieldCell[], point: Pick<Point, "x" | "y">, width: number, height: number): FieldCell {
  const column = Math.max(0, Math.min(FIELD_COLUMNS - 1, Math.floor((point.x / width) * FIELD_COLUMNS)));
  const row = Math.max(0, Math.min(FIELD_ROWS - 1, Math.floor((point.y / height) * FIELD_ROWS)));
  return cells[row * FIELD_COLUMNS + column];
}

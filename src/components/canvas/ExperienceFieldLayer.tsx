import { Rect, Arrow } from "react-konva";
import type { FieldCell } from "../../core/types";

function color(cell: FieldCell): string {
  const pressure = cell.pressure * 0.55;
  const relief = cell.relief * 0.48;
  const branch = cell.branchPotential * 0.45;
  return `rgba(${Math.round(226 * pressure + 40 * relief + 138 * branch)}, ${Math.round(74 * pressure + 165 * relief + 92 * branch)}, ${Math.round(59 * pressure + 106 * relief + 245 * branch)}, ${Math.min(0.42, pressure + relief + branch)})`;
}

export function ExperienceFieldLayer({ cells, cellWidth, cellHeight }: { cells: FieldCell[]; cellWidth: number; cellHeight: number }) {
  return <>{cells.map((cell, index) => <Rect key={index} x={cell.x - cellWidth / 2} y={cell.y - cellHeight / 2} width={cellWidth} height={cellHeight} fill={color(cell)} listening={false} />)}{cells.filter((_, index) => index % 180 === 0).map((cell, index) => <Arrow key={`a-${index}`} points={[cell.x - cell.flowX * 7, cell.y - cell.flowY * 7, cell.x + cell.flowX * 12, cell.y + cell.flowY * 12]} stroke="#2869ff" fill="#2869ff" opacity={0.38} pointerLength={4} pointerWidth={4} listening={false} />)}</>;
}

import { describe, expect, it } from "vitest";
import type { Stroke, WorldloomProject } from "../core/types";
import { seededRandom } from "../core/geometry/seededRandom";
import { simplifyStroke } from "../core/geometry/simplifyStroke";
import { compileConstraints } from "../core/compiler/compileConstraints";
import { detectConflicts } from "../core/compiler/detectConflicts";
import { buildExperienceField } from "../core/field/buildExperienceField";
import { generateVariants } from "../core/generator/generateVariants";
import { exportProject, importProjectJson } from "../core/serialization/projectJson";
import { createEmptyProject, createExampleStrokes } from "../examples/exampleProject";

const W = 960;
const H = 560;
const stroke = (id: string, type: Stroke["type"], points: Stroke["points"], intensity = 0.8, width = 18): Stroke => ({ id, type, points, intensity, width, enabled: true, createdAt: 1 });
const line = (x1: number, y1: number, x2: number, y2: number): Stroke["points"] => [{ x: x1, y: y1, time: 1 }, { x: (x1 + x2) / 2, y: (y1 + y2) / 2, time: 2 }, { x: x2, y: y2, time: 3 }];

function variants(strokes: Stroke[]) {
  const constraints = compileConstraints(strokes);
  const field = buildExperienceField(strokes, W, H);
  return generateVariants(strokes, constraints, field, 1234, W, H);
}

describe("Worldloom core", () => {
  it("seededRandom returns identical sequences for the same seed", () => {
    const a = seededRandom(12);
    const b = seededRandom(12);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("stroke simplification keeps first and last points", () => {
    const points = line(0, 0, 100, 0);
    const simplified = simplifyStroke(points, 100);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
  });

  it("Pressure creates positive and suppressive constraints", () => {
    const constraints = compileConstraints([stroke("P1", "pressure", line(100, 100, 240, 100), 0.82)]);
    expect(constraints.some((item) => item.target === "encounter_intensity" && item.preferredValue > 0.8)).toBe(true);
    expect(constraints.some((item) => item.target === "resource_density" && item.preferredValue < 0.2)).toBe(true);
  });

  it("Relief creates recovery and low encounter constraints", () => {
    const constraints = compileConstraints([stroke("R1", "relief", line(100, 100, 240, 100), 0.78)]);
    expect(constraints.some((item) => item.target === "recovery" && item.preferredValue > 0.7)).toBe(true);
    expect(constraints.some((item) => item.target === "encounter_intensity" && item.preferredValue < 0.3)).toBe(true);
  });

  it("Branch creates a branching constraint", () => {
    expect(compileConstraints([stroke("B1", "branch", line(100, 100, 240, 140))]).some((item) => item.target === "branching")).toBe(true);
  });

  it("overlapping high Pressure and Relief triggers a conflict", () => {
    const strokes = [stroke("P1", "pressure", line(250, 250, 340, 250), 0.9, 24), stroke("R1", "relief", line(260, 252, 350, 252), 0.88, 24)];
    const conflicts = detectConflicts(strokes, compileConstraints(strokes));
    expect(conflicts.some((item) => item.type === "pressure_relief_overlap")).toBe(true);
  });

  it("Flow can generate entrance and exit rooms", () => {
    const result = variants([stroke("F1", "flow", line(60, 280, 900, 280), 0.8, 8)])[0];
    expect(result.rooms.some((room) => room.role === "entrance")).toBe(true);
    expect(result.rooms.some((room) => room.role === "exit")).toBe(true);
  });

  it("generated topology connects entrance to exit", () => {
    expect(variants(createExampleStrokes())[0].validation.entranceExitConnected).toBe(true);
  });

  it("different strategies produce observable differences", () => {
    const result = variants(createExampleStrokes());
    const signatures = result.map((variant) => `${variant.rooms.length}-${Math.round(variant.rooms.reduce((sum, room) => sum + room.width, 0))}-${variant.intentFit}`);
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it("room provenance references real stroke and constraint ids", () => {
    const strokes = createExampleStrokes();
    const constraints = compileConstraints(strokes);
    const [variant] = generateVariants(strokes, constraints, buildExperienceField(strokes, W, H), 99, W, H);
    const strokeIds = new Set(strokes.map((item) => item.id));
    const constraintIds = new Set(constraints.map((item) => item.id));
    for (const room of variant.rooms) {
      expect(room.sourceStrokeIds.every((id) => strokeIds.has(id))).toBe(true);
      expect(room.sourceConstraintIds.every((id) => constraintIds.has(id))).toBe(true);
    }
  });

  it("JSON export/import preserves main project data", () => {
    const project: WorldloomProject = { ...createEmptyProject(), strokes: createExampleStrokes() };
    const imported = importProjectJson(exportProject(project));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.project.strokes.length).toBe(project.strokes.length);
      expect(imported.project.seed).toBe(project.seed);
    }
  });

  it("without Flow it generates a default path with warning", () => {
    const result = variants([stroke("P1", "pressure", line(300, 260, 420, 280), 0.8)])[0];
    expect(result.validation.entranceExitConnected).toBe(true);
    expect(result.validation.warnings.some((warning) => warning.includes("No Flow"))).toBe(true);
  });
});

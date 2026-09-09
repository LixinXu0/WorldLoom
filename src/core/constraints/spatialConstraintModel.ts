import { nanoid } from "nanoid";

import type {
  SharedBounds,
  SharedPoint,
  SharedProvenance,
  SharedSpatialConstraint,
  SpatialConstraintMode,
  SpatialConstraintObservation,
  SpatialConstraintProperty,
  SpatialConstraintValue,
  SpatialTolerance,
} from "../shared-state/types";

export type CreateSpatialConstraintInput = {
  id?: string;
  targetElementId: string;
  property: SpatialConstraintProperty;
  mode: SpatialConstraintMode;
  value?: SpatialConstraintValue;
  tolerance?: number | SpatialTolerance;
  unit?: string;
  generativeFreedom?: number;
  preserveOnRegeneration?: boolean;
  enabled?: boolean;
  provenance?: Partial<SharedProvenance>;
};

export type SpatialConstraintPatch = Partial<
  Omit<SharedSpatialConstraint, "id" | "targetElementId">
>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function defaultGenerativeFreedom(
  mode: SpatialConstraintMode,
): number {
  if (mode === "exact") return 0;
  if (mode === "free") return 1;
  return 0.5;
}

export function defaultToleranceForProperty(
  property: SpatialConstraintProperty,
  unit?: string,
): SpatialTolerance {
  switch (property) {
    case "position":
      return { kind: "radius", value: 24, unit: unit ?? "px" };
    case "rotation":
      return { kind: "angular", value: 15, unit: unit ?? "deg" };
    case "scale":
      return { kind: "absolute", value: 0.15, unit: unit ?? "ratio" };
    case "width":
    case "depth":
    case "height":
      return { kind: "absolute", value: 1, unit: unit ?? "m" };
    case "footprint":
    case "geometry":
    case "transform":
    case "spatial_relation":
      return { kind: "absolute", value: 16, unit: unit ?? "px" };
    case "identity":
    case "material":
      return { kind: "absolute", value: 0, unit };
  }
}

function normalizeTolerance(
  tolerance: number | SpatialTolerance | undefined,
  property: SpatialConstraintProperty,
  mode: SpatialConstraintMode,
  unit?: string,
): number | SpatialTolerance | undefined {
  if (mode !== "approximate") return undefined;
  if (tolerance === undefined) {
    return defaultToleranceForProperty(property, unit);
  }
  if (typeof tolerance === "number") {
    return Math.max(0, tolerance);
  }
  return {
    ...tolerance,
    value:
      tolerance.value === undefined
        ? undefined
        : Math.max(0, tolerance.value),
    minimum: tolerance.minimum,
    maximum: tolerance.maximum,
    region: tolerance.region ? { ...tolerance.region } : undefined,
  };
}

function normalizeConstraint(
  constraint: SharedSpatialConstraint,
): SharedSpatialConstraint {
  const mode = constraint.mode;
  return {
    ...constraint,
    tolerance: normalizeTolerance(
      constraint.tolerance,
      constraint.property,
      mode,
      constraint.unit,
    ),
    generativeFreedom:
      mode === "exact"
        ? 0
        : mode === "free"
          ? 1
          : clamp01(
              constraint.generativeFreedom ??
                defaultGenerativeFreedom(mode),
            ),
    preserveOnRegeneration:
      mode === "exact"
        ? true
        : mode === "free"
          ? false
          : constraint.preserveOnRegeneration ?? false,
  };
}

export function createSpatialConstraint(
  input: CreateSpatialConstraintInput,
  createdAt = Date.now(),
): SharedSpatialConstraint {
  if (!input.targetElementId.trim()) {
    throw new Error("A spatial constraint requires a target element id.");
  }

  return normalizeConstraint({
    id: input.id ?? `SC-${nanoid(8)}`,
    targetElementId: input.targetElementId,
    property: input.property,
    mode: input.mode,
    value: input.value,
    tolerance: input.tolerance,
    unit: input.unit,
    generativeFreedom: input.generativeFreedom,
    preserveOnRegeneration: input.preserveOnRegeneration,
    enabled: input.enabled ?? true,
    status: "committed",
    provenance: {
      source: input.provenance?.source ?? "user",
      sourceIds: input.provenance?.sourceIds
        ? [...input.provenance.sourceIds]
        : [input.targetElementId],
      explanation: input.provenance?.explanation,
      model: input.provenance?.model,
      createdAt: input.provenance?.createdAt ?? createdAt,
      updatedAt: input.provenance?.updatedAt ?? createdAt,
    },
  });
}

export function updateSpatialConstraintModel(
  constraint: SharedSpatialConstraint,
  patch: SpatialConstraintPatch,
  updatedAt = Date.now(),
): SharedSpatialConstraint {
  return normalizeConstraint({
    ...constraint,
    ...patch,
    provenance: {
      ...constraint.provenance,
      ...patch.provenance,
      sourceIds: patch.provenance?.sourceIds
        ? [...patch.provenance.sourceIds]
        : constraint.provenance.sourceIds,
      updatedAt,
    },
  });
}

export function setSpatialConstraintMode(
  constraint: SharedSpatialConstraint,
  mode: SpatialConstraintMode,
  updatedAt = Date.now(),
): SharedSpatialConstraint {
  return updateSpatialConstraintModel(
    constraint,
    {
      mode,
      tolerance:
        mode === "approximate"
          ? constraint.tolerance ??
            defaultToleranceForProperty(
              constraint.property,
              constraint.unit,
            )
          : undefined,
      generativeFreedom: defaultGenerativeFreedom(mode),
    },
    updatedAt,
  );
}

export function upsertConstraintInList(
  constraints: SharedSpatialConstraint[],
  constraint: SharedSpatialConstraint,
): SharedSpatialConstraint[] {
  const exists = constraints.some((item) => item.id === constraint.id);
  return exists
    ? constraints.map((item) =>
        item.id === constraint.id ? constraint : item,
      )
    : [...constraints, constraint];
}

export function removeConstraintFromList(
  constraints: SharedSpatialConstraint[],
  constraintId: string,
): SharedSpatialConstraint[] {
  return constraints.filter((constraint) => constraint.id !== constraintId);
}

export function constraintsForElement(
  constraints: SharedSpatialConstraint[],
  elementId: string,
): SharedSpatialConstraint[] {
  return constraints.filter(
    (constraint) =>
      constraint.targetElementId === elementId && constraint.enabled,
  );
}

function isPoint(value: unknown): value is SharedPoint {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as SharedPoint).x === "number" &&
      typeof (value as SharedPoint).y === "number",
  );
}

function isBounds(value: unknown): value is SharedBounds {
  return Boolean(
    isPoint(value) &&
      typeof (value as SharedBounds).width === "number" &&
      typeof (value as SharedBounds).height === "number",
  );
}

function pointDistance(a: SharedPoint, b: SharedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boundsDistance(a: SharedBounds, b: SharedBounds): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );
}

function angularDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function numericTolerance(
  tolerance: number | SpatialTolerance | undefined,
): number {
  if (typeof tolerance === "number") return tolerance;
  return tolerance?.value ?? 0;
}

function withinRegion(point: SharedPoint, region: SharedBounds): boolean {
  return (
    point.x >= region.x &&
    point.y >= region.y &&
    point.x <= region.x + region.width &&
    point.y <= region.y + region.height
  );
}

export function evaluateSpatialConstraint(
  constraint: SharedSpatialConstraint,
  observed: SpatialConstraintValue | undefined,
): SpatialConstraintObservation {
  if (!constraint.enabled || constraint.mode === "free") {
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: true,
      explanation: "Free or disabled constraints do not restrict generation.",
    };
  }

  if (observed === undefined || constraint.value === undefined) {
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: false,
      explanation: "Expected or observed value is missing.",
    };
  }

  if (constraint.mode === "exact") {
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: valuesEqual(constraint.value, observed),
    };
  }

  const tolerance = constraint.tolerance;

  if (
    typeof tolerance === "object" &&
    tolerance.kind === "range" &&
    typeof observed === "number"
  ) {
    const minimum = tolerance.minimum ?? Number.NEGATIVE_INFINITY;
    const maximum = tolerance.maximum ?? Number.POSITIVE_INFINITY;
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: observed >= minimum && observed <= maximum,
    };
  }

  if (
    typeof tolerance === "object" &&
    tolerance.kind === "region" &&
    tolerance.region &&
    isPoint(observed)
  ) {
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: withinRegion(observed, tolerance.region),
    };
  }

  let distance: number | undefined;

  if (
    typeof constraint.value === "number" &&
    typeof observed === "number"
  ) {
    distance =
      typeof tolerance === "object" && tolerance.kind === "angular"
        ? angularDistance(constraint.value, observed)
        : Math.abs(constraint.value - observed);
  } else if (isBounds(constraint.value) && isBounds(observed)) {
    distance = boundsDistance(constraint.value, observed);
  } else if (isPoint(constraint.value) && isPoint(observed)) {
    distance = pointDistance(constraint.value, observed);
  }

  if (distance === undefined) {
    return {
      constraintId: constraint.id,
      expected: constraint.value,
      observed,
      passed: valuesEqual(constraint.value, observed),
      explanation: "This value type uses equality for approximate comparison.",
    };
  }

  return {
    constraintId: constraint.id,
    expected: constraint.value,
    observed,
    distance,
    passed: distance <= numericTolerance(tolerance),
  };
}

export function evaluateSpatialConstraints(
  constraints: SharedSpatialConstraint[],
  observedValues: Record<string, SpatialConstraintValue | undefined>,
): SpatialConstraintObservation[] {
  return constraints.map((constraint) =>
    evaluateSpatialConstraint(constraint, observedValues[constraint.id]),
  );
}

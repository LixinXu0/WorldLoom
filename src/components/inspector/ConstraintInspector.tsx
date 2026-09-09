import type {
  SharedSpatialConstraint,
  SpatialConstraintMode,
  SpatialTolerance,
} from "../../core/shared-state/types";

import {
  useWorldloomStore,
} from "../../store/useWorldloomStore";

function formatValue(
  value: unknown,
): string {
  if (value === undefined) {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return String(value);
  }
}

function toleranceValue(
  tolerance:
    | number
    | SpatialTolerance
    | undefined,
): number | undefined {
  if (
    typeof tolerance ===
    "number"
  ) {
    return tolerance;
  }

  return tolerance?.value;
}

function toleranceKind(
  tolerance:
    | number
    | SpatialTolerance
    | undefined,
): string {
  if (
    typeof tolerance ===
    "number"
  ) {
    return "absolute";
  }

  return (
    tolerance?.kind ??
    "default"
  );
}

function toleranceUnit(
  constraint:
    SharedSpatialConstraint,
): string {
  if (
    typeof constraint.tolerance ===
    "object"
  ) {
    return (
      constraint.tolerance.unit ??
      constraint.unit ??
      ""
    );
  }

  return constraint.unit ?? "";
}

export function ConstraintInspector({
  id,
}: {
  id: string;
}) {
  const legacyConstraint =
    useWorldloomStore(
      (state) =>
        state.project.constraints.find(
          (item) =>
            item.id === id,
        ),
    );

  const spatialConstraint =
    useWorldloomStore(
      (state) =>
        state.project
          .sharedLevelDesignState
          .spatial
          .constraints
          .find(
            (item) =>
              item.id === id,
          ),
    );

  const updateSpatialConstraint =
    useWorldloomStore(
      (state) =>
        state.updateSpatialConstraint,
    );

  const setSpatialConstraintMode =
    useWorldloomStore(
      (state) =>
        state.setSpatialConstraintMode,
    );

  const removeSpatialConstraint =
    useWorldloomStore(
      (state) =>
        state.removeSpatialConstraint,
    );

  if (spatialConstraint) {
    const tolerance =
      toleranceValue(
        spatialConstraint.tolerance,
      );

    const updateTolerance = (
      value: number,
    ) => {
      const normalized =
        Math.max(
          0,
          value,
        );

      if (
        typeof spatialConstraint.tolerance ===
        "object"
      ) {
        updateSpatialConstraint(
          spatialConstraint.id,
          {
            tolerance: {
              ...spatialConstraint.tolerance,
              value:
                normalized,
            },
          },
        );

        return;
      }

      updateSpatialConstraint(
        spatialConstraint.id,
        {
          tolerance:
            normalized,
        },
      );
    };

    return (
      <section className="constraint-inspector">
        <h3>
          Spatial Constraint
        </h3>

        <dl>
          <dt>ID</dt>

          <dd>
            {
              spatialConstraint.id
            }
          </dd>

          <dt>
            Target
          </dt>

          <dd>
            {
              spatialConstraint.targetElementId
            }
          </dd>

          <dt>
            Property
          </dt>

          <dd>
            {
              spatialConstraint.property
            }
          </dd>

          <dt>
            Value
          </dt>

          <dd>
            {formatValue(
              spatialConstraint.value,
            )}
          </dd>

          <dt>
            Mode
          </dt>

          <dd>
            <select
              value={
                spatialConstraint.mode
              }
              onChange={(
                event,
              ) =>
                setSpatialConstraintMode(
                  spatialConstraint.id,
                  event.target
                    .value as
                    SpatialConstraintMode,
                )
              }
            >
              <option value="exact">
                Exact
              </option>

              <option value="approximate">
                Approximate
              </option>

              <option value="free">
                Free
              </option>
            </select>
          </dd>

          <dt>
            Generative freedom
          </dt>

          <dd>
            {(
              spatialConstraint
                .generativeFreedom ??
              (
                spatialConstraint.mode ===
                "exact"
                  ? 0
                  : spatialConstraint.mode ===
                      "free"
                    ? 1
                    : 0.5
              )
            ).toFixed(
              2,
            )}
          </dd>

          <dt>
            Preserve on regeneration
          </dt>

          <dd>
            <input
              type="checkbox"
              checked={
                spatialConstraint
                  .preserveOnRegeneration ??
                false
              }
              disabled={
                spatialConstraint.mode ===
                  "exact" ||
                spatialConstraint.mode ===
                  "free"
              }
              onChange={(
                event,
              ) =>
                updateSpatialConstraint(
                  spatialConstraint.id,
                  {
                    preserveOnRegeneration:
                      event.target
                        .checked,
                  },
                )
              }
            />
          </dd>

          <dt>
            Enabled
          </dt>

          <dd>
            <input
              type="checkbox"
              checked={
                spatialConstraint.enabled
              }
              onChange={(
                event,
              ) =>
                updateSpatialConstraint(
                  spatialConstraint.id,
                  {
                    enabled:
                      event.target
                        .checked,
                  },
                )
              }
            />
          </dd>

          <dt>
            Status
          </dt>

          <dd>
            {
              spatialConstraint.status
            }
          </dd>
        </dl>

        {spatialConstraint.mode ===
          "exact" && (
          <div className="constraint-mode-note">
            <strong>
              Exact
            </strong>

            <p>
              Keep this property fixed
              during generation.
            </p>
          </div>
        )}

        {spatialConstraint.mode ===
          "approximate" && (
          <div className="constraint-tolerance">
            <strong>
              Tolerance
            </strong>

            <dl>
              <dt>
                Type
              </dt>

              <dd>
                {toleranceKind(
                  spatialConstraint.tolerance,
                )}
              </dd>

              <dt>
                Value
              </dt>

              <dd>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    tolerance ??
                    0
                  }
                  onChange={(
                    event,
                  ) =>
                    updateTolerance(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                  }
                />

                {toleranceUnit(
                  spatialConstraint,
                ) && (
                  <span>
                    {" "}
                    {toleranceUnit(
                      spatialConstraint,
                    )}
                  </span>
                )}
              </dd>
            </dl>

            <p>
              The generator may
              adjust this property
              within the allowed
              tolerance.
            </p>
          </div>
        )}

        {spatialConstraint.mode ===
          "free" && (
          <div className="constraint-mode-note">
            <strong>
              Free
            </strong>

            <p>
              The generator may decide
              this property freely.
            </p>
          </div>
        )}

        {spatialConstraint
          .provenance
          .explanation && (
          <p>
            {
              spatialConstraint
                .provenance
                .explanation
            }
          </p>
        )}

        <button
          type="button"
          onClick={() =>
            removeSpatialConstraint(
              spatialConstraint.id,
            )
          }
        >
          Remove constraint
        </button>
      </section>
    );
  }

  /*
   * Legacy constraint fallback.
   * 保留旧项目和旧 UI 的显示能力。
   */
  if (legacyConstraint) {
    return (
      <section className="constraint-inspector">
        <h3>
          Constraint
        </h3>

        <dl>
          <dt>
            ID
          </dt>

          <dd>
            {
              legacyConstraint.id
            }
          </dd>

          <dt>
            Source strokes
          </dt>

          <dd>
            {legacyConstraint
              .sourceStrokeIds
              .join(", ") ||
              "default"}
          </dd>

          <dt>
            Target
          </dt>

          <dd>
            {
              legacyConstraint.target
            }
          </dd>

          <dt>
            Preferred
          </dt>

          <dd>
            {legacyConstraint
              .preferredValue
              .toFixed(
                2,
              )}
          </dd>

          <dt>
            Confidence
          </dt>

          <dd>
            {legacyConstraint
              .weight
              .toFixed(
                2,
              )}
          </dd>

          <dt>
            Hard
          </dt>

          <dd>
            {legacyConstraint.hard
              ? "yes"
              : "no"}
          </dd>

          <dt>
            Enabled
          </dt>

          <dd>
            {legacyConstraint.enabled
              ? "yes"
              : "no"}
          </dd>
        </dl>

        <p>
          {
            legacyConstraint.explanation
          }
        </p>

        <small>
          Legacy constraint. New
          spatial constraints use
          exact / approximate / free
          modes.
        </small>
      </section>
    );
  }

  return null;
}
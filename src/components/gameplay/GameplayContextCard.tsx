import { useMemo } from "react";

import type {
  GameplayValidationConflict,
  SharedGameplayCandidate,
  SharedSpatialConstraint,
} from "../../core/shared-state/types";

import { useWorldloomStore } from "../../store/useWorldloomStore";

export type GameplayContextCardProps = {
  selectedGameplayNodeIds?: string[];
  selectedSceneElementIds?: string[];
};

function confidenceLabel(
  value: number,
): string {
  return `${Math.round(value * 100)}%`;
}

function candidateTouchesSelection(
  candidate: SharedGameplayCandidate,
  selectedGameplayNodeIds: string[],
  selectedSceneElementIds: string[],
): boolean {
  if (
    selectedGameplayNodeIds.length === 0 &&
    selectedSceneElementIds.length === 0
  ) {
    return true;
  }

  const selectedGameplayIds =
    new Set(selectedGameplayNodeIds);

  const selectedSceneIds =
    new Set(selectedSceneElementIds);

  return (
    candidate.proposedNodes.some(
      (node) =>
        selectedGameplayIds.has(node.id),
    ) ||
    candidate.sourceSceneElementIds.some(
      (id) =>
        selectedSceneIds.has(id),
    )
  );
}

function conflictTouchesSelection(
  conflict: GameplayValidationConflict,
  selectedGameplayNodeIds: string[],
): boolean {
  if (
    selectedGameplayNodeIds.length === 0
  ) {
    return true;
  }

  const selectedIds =
    new Set(selectedGameplayNodeIds);

  return conflict.nodeIds.some(
    (id) => selectedIds.has(id),
  );
}

function constraintLabel(
  constraint: SharedSpatialConstraint,
): string {
  return `${constraint.property} · ${constraint.mode}`;
}

export function GameplayContextCard({
  selectedGameplayNodeIds = [],
  selectedSceneElementIds = [],
}: GameplayContextCardProps) {
  const sharedState =
    useWorldloomStore(
      (state) =>
        state.project
          .sharedLevelDesignState,
    );

  const generateGameplayCandidates =
    useWorldloomStore(
      (state) =>
        state.generateGameplayCandidates,
    );

  const selectGameplayCandidate =
    useWorldloomStore(
      (state) =>
        state.selectGameplayCandidate,
    );

  const commitGameplayCandidate =
    useWorldloomStore(
      (state) =>
        state.commitGameplayCandidate,
    );

  const rejectGameplayCandidate =
    useWorldloomStore(
      (state) =>
        state.rejectGameplayCandidate,
    );

  const setSpatialConstraintMode =
    useWorldloomStore(
      (state) =>
        state.setSpatialConstraintMode,
    );

  const validateGameplay =
    useWorldloomStore(
      (state) =>
        state.validateGameplay,
    );

  const generateGameplayRepairs =
    useWorldloomStore(
      (state) =>
        state.generateGameplayRepairs,
    );

  const applyGameplayRepair =
    useWorldloomStore(
      (state) =>
        state.applyGameplayRepair,
    );

  const negotiation =
    sharedState.gameplay.negotiation;

  const validation =
    sharedState.gameplay.validation;

  const repairs =
    sharedState.gameplay.repairs ?? [];

  const candidates =
    useMemo(
      () =>
        (
          negotiation?.candidates ??
          []
        ).filter(
          (candidate) =>
            candidateTouchesSelection(
              candidate,
              selectedGameplayNodeIds,
              selectedSceneElementIds,
            ),
        ),
      [
        negotiation?.candidates,
        selectedGameplayNodeIds,
        selectedSceneElementIds,
      ],
    );

  const constraints =
    useMemo(
      () =>
        sharedState.spatial.constraints.filter(
          (constraint) =>
            selectedSceneElementIds.length ===
              0 ||
            selectedSceneElementIds.includes(
              constraint.targetElementId,
            ),
        ),
      [
        sharedState.spatial.constraints,
        selectedSceneElementIds,
      ],
    );

  const conflicts =
    useMemo(
      () =>
        (
          validation?.conflicts ??
          []
        ).filter(
          (conflict) =>
            conflictTouchesSelection(
              conflict,
              selectedGameplayNodeIds,
            ),
        ),
      [
        validation?.conflicts,
        selectedGameplayNodeIds,
      ],
    );

  const selectedCandidateId =
    negotiation?.selectedCandidateId ??
    null;

  return (
    <aside className="gameplay-context-card">
      <header className="gameplay-context-card__header">
        <div>
          <strong>
            Gameplay Context
          </strong>

          <p>
            Confirm meaning, constraints,
            and local repairs.
          </p>
        </div>
      </header>

      <section className="gameplay-context-card__section">
        <div className="gameplay-context-card__section-header">
          <strong>
            Interpretation
          </strong>

          <button
            type="button"
            onClick={
              generateGameplayCandidates
            }
          >
            Generate
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="gameplay-context-card__empty">
            No gameplay candidates yet.
          </p>
        ) : (
          <div className="gameplay-context-card__list">
            {candidates.map(
              (candidate) => {
                const selected =
                  selectedCandidateId ===
                  candidate.id;

                return (
                  <article
                    key={candidate.id}
                    className={
                      selected
                        ? "gameplay-context-candidate selected"
                        : "gameplay-context-candidate"
                    }
                  >
                    <button
                      type="button"
                      className="gameplay-context-candidate__main"
                      onClick={() =>
                        selectGameplayCandidate(
                          candidate.id,
                        )
                      }
                    >
                      <span>
                        <strong>
                          {
                            candidate.label
                          }
                        </strong>

                        <small>
                          Confidence{" "}
                          {confidenceLabel(
                            candidate.confidence,
                          )}
                        </small>
                      </span>

                      <span>
                        {selected
                          ? "Selected"
                          : "Select"}
                      </span>
                    </button>

                    <p>
                      {candidate.summary}
                    </p>

                    <div className="gameplay-context-card__chips">
                      {candidate.choices.map(
                        (
                          choice,
                          index,
                        ) => (
                          <span
                            key={`${candidate.id}-${choice.dimension}-${index}`}
                          >
                            {
                              choice.dimension
                            }
                            :{" "}
                            {
                              choice.value
                            }
                          </span>
                        ),
                      )}
                    </div>

                    {selected && (
                      <div className="gameplay-context-card__actions">
                        <button
                          type="button"
                          onClick={() =>
                            commitGameplayCandidate(
                              candidate.id,
                            )
                          }
                        >
                          Confirm
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            rejectGameplayCandidate(
                              candidate.id,
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      <section className="gameplay-context-card__section">
        <div className="gameplay-context-card__section-header">
          <strong>
            Spatial Constraints
          </strong>

          <span>
            {constraints.length}
          </span>
        </div>

        {constraints.length === 0 ? (
          <p className="gameplay-context-card__empty">
            No constraints for this
            selection.
          </p>
        ) : (
          <div className="gameplay-context-card__list">
            {constraints.map(
              (constraint) => (
                <div
                  key={constraint.id}
                  className="gameplay-context-constraint"
                >
                  <div>
                    <strong>
                      {constraintLabel(
                        constraint,
                      )}
                    </strong>

                    <small>
                      {
                        constraint.targetElementId
                      }
                    </small>
                  </div>

                  <select
                    value={constraint.mode}
                    onChange={(event) =>
                      setSpatialConstraintMode(
                        constraint.id,
                        event.target
                          .value as
                          | "exact"
                          | "approximate"
                          | "free",
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

                  {constraint.mode ===
                    "approximate" && (
                    <small>
                      Tolerance:{" "}
                      {constraint.tolerance ===
                      undefined
                        ? "default"
                        : typeof constraint.tolerance ===
                            "number"
                          ? constraint.tolerance
                          : constraint.tolerance
                                .value ??
                            constraint.tolerance
                              .kind}
                    </small>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <section className="gameplay-context-card__section">
        <div className="gameplay-context-card__section-header">
          <strong>
            Validation
          </strong>

          <button
            type="button"
            onClick={validateGameplay}
          >
            Check
          </button>
        </div>

        {!validation ? (
          <p className="gameplay-context-card__empty">
            Gameplay has not been
            validated yet.
          </p>
        ) : validation.valid ? (
          <p className="gameplay-context-card__valid">
            Gameplay graph is valid.
          </p>
        ) : (
          <>
            <div className="gameplay-context-card__list">
              {conflicts.map(
                (conflict) => (
                  <div
                    key={conflict.id}
                    className={`gameplay-context-conflict ${conflict.severity}`}
                  >
                    <strong>
                      {conflict.type}
                    </strong>

                    <p>
                      {conflict.message}
                    </p>
                  </div>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={
                generateGameplayRepairs
              }
            >
              Generate repairs
            </button>
          </>
        )}
      </section>

      {repairs.length > 0 && (
        <section className="gameplay-context-card__section">
          <strong>
            Repair Suggestions
          </strong>

          <div className="gameplay-context-card__list">
            {repairs.map(
              (repair) => (
                <article
                  key={repair.id}
                  className="gameplay-context-repair"
                >
                  <strong>
                    {repair.label}
                  </strong>

                  <p>
                    {
                      repair.description
                    }
                  </p>

                  <small>
                    {
                      repair.operations
                        .length
                    }{" "}
                    local operation
                    {repair.operations
                      .length === 1
                      ? ""
                      : "s"}
                  </small>

                  {repair.status ===
                  "proposed" ? (
                    <button
                      type="button"
                      onClick={() =>
                        applyGameplayRepair(
                          repair.id,
                        )
                      }
                    >
                      Apply repair
                    </button>
                  ) : (
                    <span>
                      {repair.status}
                    </span>
                  )}
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
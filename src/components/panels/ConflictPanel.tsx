import { useMemo } from "react";

import {
  useWorldloomStore,
} from "../../store/useWorldloomStore";

export function ConflictPanel() {
  const sharedState =
    useWorldloomStore(
      (state) =>
        state.project
          .sharedLevelDesignState,
    );

  const selected =
    useWorldloomStore(
      (state) =>
        state.selected,
    );

  const select =
    useWorldloomStore(
      (state) =>
        state.select,
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

  const validation =
    sharedState.gameplay.validation;

  const repairs =
    sharedState.gameplay.repairs ?? [];

  const conflicts =
    validation?.conflicts ?? [];

  const repairsByConflict =
    useMemo(() => {
      const map =
        new Map<
          string,
          typeof repairs
        >();

      for (const conflict of conflicts) {
        map.set(
          conflict.id,
          repairs.filter(
            (repair) =>
              conflict
                .suggestedRepairIds
                .includes(
                  repair.id,
                ),
          ),
        );
      }

      return map;
    }, [
      conflicts,
      repairs,
    ]);

  const focusConflict =
    (
      nodeIds: string[],
      relationIds: string[],
      routeIds: string[],
    ) => {
      if (nodeIds.length > 0) {
        select({
          kind: "gameplay-node",
          id: nodeIds[0],
        });

        return;
      }

      if (
        relationIds.length >
        0
      ) {
        select({
          kind:
            "gameplay-relation",
          id:
            relationIds[0],
        });

        return;
      }

      if (
        routeIds.length >
        0
      ) {
        select({
          kind:
            "gameplay-route",
          id:
            routeIds[0],
        });
      }
    };

  return (
    <section className="conflict-panel">
      <div className="conflict-panel__header">
        <div>
          <h3>
            Gameplay Conflicts
          </h3>

          <p>
            Review structural
            conflicts and apply
            local repair suggestions.
          </p>
        </div>

        <button
          type="button"
          onClick={
            validateGameplay
          }
        >
          Re-check
        </button>
      </div>

      {!validation ? (
        <div className="conflict-panel__empty">
          <p>
            Gameplay has not been
            validated yet.
          </p>

          <button
            type="button"
            onClick={
              validateGameplay
            }
          >
            Validate gameplay
          </button>
        </div>
      ) : validation.valid ? (
        <div className="conflict-panel__valid">
          <strong>
            No gameplay conflicts
          </strong>

          <p>
            The current gameplay
            graph passes validation.
          </p>
        </div>
      ) : (
        <>
          <div className="conflict-panel__summary">
            <strong>
              {conflicts.length}{" "}
              conflict
              {conflicts.length ===
              1
                ? ""
                : "s"}
            </strong>

            <span>
              {
                validation
                  .reachableNodeIds
                  .length
              }{" "}
              reachable nodes
            </span>
          </div>

          <div className="conflict-panel__list">
            {conflicts.map(
              (conflict) => {
                const conflictRepairs =
                  repairsByConflict.get(
                    conflict.id,
                  ) ?? [];

                const hasLocation =
                  conflict.nodeIds
                    .length > 0 ||
                  conflict.relationIds
                    .length > 0 ||
                  conflict.routeIds
                    .length > 0;

                return (
                  <article
                    key={
                      conflict.id
                    }
                    className={
                      `conflict-panel__item ${conflict.severity}`
                    }
                  >
                    <div className="conflict-panel__item-header">
                      <div>
                        <strong>
                          {
                            conflict.type
                          }
                        </strong>

                        <small>
                          {
                            conflict.severity
                          }
                        </small>
                      </div>

                      {hasLocation && (
                        <button
                          type="button"
                          onClick={() =>
                            focusConflict(
                              conflict.nodeIds,
                              conflict.relationIds,
                              conflict.routeIds,
                            )
                          }
                        >
                          Show location
                        </button>
                      )}
                    </div>

                    <p>
                      {
                        conflict.message
                      }
                    </p>

                    <div className="conflict-panel__location">
                      {conflict.nodeIds
                        .length >
                        0 && (
                        <div>
                          <span>
                            Nodes
                          </span>

                          {conflict.nodeIds.map(
                            (
                              id,
                            ) => (
                              <button
                                key={
                                  id
                                }
                                type="button"
                                className={
                                  selected
                                    ?.kind ===
                                    "gameplay-node" &&
                                  selected.id ===
                                    id
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  select(
                                    {
                                      kind:
                                        "gameplay-node",
                                      id,
                                    },
                                  )
                                }
                              >
                                {
                                  id
                                }
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {conflict
                        .relationIds
                        .length >
                        0 && (
                        <div>
                          <span>
                            Relations
                          </span>

                          {conflict.relationIds.map(
                            (
                              id,
                            ) => (
                              <button
                                key={
                                  id
                                }
                                type="button"
                                className={
                                  selected
                                    ?.kind ===
                                    "gameplay-relation" &&
                                  selected.id ===
                                    id
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  select(
                                    {
                                      kind:
                                        "gameplay-relation",
                                      id,
                                    },
                                  )
                                }
                              >
                                {
                                  id
                                }
                              </button>
                            ),
                          )}
                        </div>
                      )}

                      {conflict.routeIds
                        .length >
                        0 && (
                        <div>
                          <span>
                            Routes
                          </span>

                          {conflict.routeIds.map(
                            (
                              id,
                            ) => (
                              <button
                                key={
                                  id
                                }
                                type="button"
                                className={
                                  selected
                                    ?.kind ===
                                    "gameplay-route" &&
                                  selected.id ===
                                    id
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  select(
                                    {
                                      kind:
                                        "gameplay-route",
                                      id,
                                    },
                                  )
                                }
                              >
                                {
                                  id
                                }
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    {conflictRepairs.length >
                    0 ? (
                      <div className="conflict-panel__repairs">
                        <strong>
                          Repair suggestions
                        </strong>

                        {conflictRepairs.map(
                          (
                            repair,
                          ) => (
                            <div
                              key={
                                repair.id
                              }
                              className="conflict-panel__repair"
                            >
                              <div>
                                <strong>
                                  {
                                    repair.label
                                  }
                                </strong>

                                <p>
                                  {
                                    repair.description
                                  }
                                </p>

                                <small>
                                  {
                                    repair
                                      .operations
                                      .length
                                  }{" "}
                                  local
                                  operation
                                  {repair
                                    .operations
                                    .length ===
                                  1
                                    ? ""
                                    : "s"}
                                </small>
                              </div>

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
                                  Apply
                                </button>
                              ) : (
                                <span>
                                  {
                                    repair.status
                                  }
                                </span>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={
                          generateGameplayRepairs
                        }
                      >
                        Generate repair
                      </button>
                    )}
                  </article>
                );
              },
            )}
          </div>
        </>
      )}
    </section>
  );
}
# Convention Learning Design

## How Conventions Are Proposed

Worldloom builds transparent pattern signatures from sketch structure:

- mark kinds
- object types
- relation types
- closed region
- arrow presence
- bounding-box aspect ratio
- topology counts

In C3, if a selected composition has multiple elements, Worldloom may propose a new convention. If it matches an existing enabled convention, it proposes reuse.

## How Users Confirm Them

The system never silently learns. The grounding card asks whether to remember the expression:

- Remember for project
- Only this time
- No

Confirmed conventions are persisted in project JSON. Session and personal scopes exist in the schema; personal persistence is intentionally not backed by accounts.

## How Similarity Works

Similarity is feature-based and deterministic. It compares mark kind overlap, object type overlap, relation topology overlap, closed-region presence, arrow presence, and bounding-box proportions. The matcher returns both a score and reasons.

## Scope And Persistence

- Session: supported in runtime state.
- Project: persisted in `WorldloomProject.conventions`.
- Personal: schema-supported only; no account or cloud storage.

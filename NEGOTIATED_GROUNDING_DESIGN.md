# Negotiated Grounding Design

## Candidate vs Committed Intent

In C3 AI Negotiable mode, compilation creates a `CandidateIntentInterpretation`. It contains semantic interpretations, Authoring IR, confidence, clarification requests, and optional convention proposals.

The candidate does not become executable generator input until the designer presses `Commit Intent`. Commit creates `CommittedAuthoringIR`, then converts that IR through `intentToConstraints`.

## Clarification Policy

Clarification is controlled by Worldloom, not directly by the interpreter. The policy asks when it sees:

- Semantic ambiguity, such as a region mark that could mean combat, relief, or landmark.
- Stroke/text conflict.
- High-impact ambiguity, such as an arrow that may mean player flow or object relation.
- Low confidence below threshold.

Questions are compact grounding cards, not a chatbot.

## Negotiation States

The lifecycle is:

```text
Sketch changed
-> Compile
-> Candidate
-> Clarification / alternative / adjustment
-> Commit
-> Constraints
-> Generate
```

Clarification answers are stored and logged. A recovery correction updates the candidate Authoring IR before commit.

## AI Opaque vs AI Negotiable

C2 AI Opaque and C3 AI Negotiable call the same mock AI interpreter over the same sketch, annotation, and seed context. C2 hides semantics, confidence, alternatives, and clarification. C3 exposes and negotiates them.

C1 Rule-Based uses the deterministic baseline.

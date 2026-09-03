# Worldloom V4 Interaction Flow

## Default Workflow

```text
Asset Library
+ neutral sketch marks
+ relations
+ annotations
-> Interpret Together
-> candidate composition hypothesis
-> clarification / convention reuse
-> committed composition intent
-> asset edit plan preview
-> apply editable arrangement
```

## Research Conditions

- C1 AI Opaque: uses the same asset-aware interpreter, but hides hypothesis details before edit-plan preview.
- C2 AI Negotiable: shows interpretation, clarification, commit, and edit-plan preview.
- C3 Negotiable + Conventions: adds convention detection/reuse on top of C2.
- Legacy Rule-Based: preserves the old Flow / Pressure / Relief / Branch workflow and procedural generator.

## Default UI

The default workspace is:

```text
Asset Library | Asset-Aware Sketch Sandbox | Grounding Inspector
```

The old semantic brushes are available only in legacy mode.

## Required Demo A Path

Demo A places Watchtower, Barricade, Stone Stair, Enemy Shrine, and Reward Chest. The selected utterance combines tower, barricade, shrine, stair, loop, and arrow. Worldloom grounds it as:

```text
I think this is a defended high-ground encounter reached from the stair.
```

It asks whether Reward Chest is part of the encounter or a separate optional reward. The edit plan preserves Watchtower when locked, moves/roles other encounter assets, connects Stair to Tower, and keeps asset identities unchanged.

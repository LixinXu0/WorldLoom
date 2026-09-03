import { nanoid } from "nanoid";
import type { AuthoringIntentFragment, SketchPatternSignature, SketchState } from "../sketch/types";
import { buildSketchPatternSignature, compareSketchSignatures } from "../sketch/patternSignature";
import type { ConventionEntry, ConventionScope } from "./types";

export function createConventionEntry(patternSignature: SketchPatternSignature, semanticMeaning: AuthoringIntentFragment, humanReadableLabel: string, exampleSketchIds: string[], scope: ConventionScope = "project", now = Date.now()): ConventionEntry {
  return {
    id: `CONV-${nanoid(6)}`,
    patternSignature,
    semanticMeaning,
    humanReadableLabel,
    exampleSketchIds,
    scope,
    confidence: 0.65,
    confirmations: 1,
    corrections: 0,
    createdAt: now,
    updatedAt: now,
    enabled: true,
  };
}

export function findMatchingConvention(entries: ConventionEntry[], sketch: SketchState, ids?: string[], threshold = 0.72): { entry: ConventionEntry; similarity: number; reasons: string[] } | null {
  const signature = buildSketchPatternSignature(sketch, ids);
  const candidates = entries.filter((entry) => entry.enabled).map((entry) => ({ entry, ...compareSketchSignatures(entry.patternSignature, signature) })).sort((a, b) => b.similarity - a.similarity);
  const best = candidates[0];
  return best && best.similarity >= threshold ? best : null;
}

export function confirmConvention(entry: ConventionEntry, exampleSketchIds: string[], now = Date.now()): ConventionEntry {
  return { ...entry, confirmations: entry.confirmations + 1, confidence: Math.min(1, entry.confidence + 0.08), exampleSketchIds: Array.from(new Set([...entry.exampleSketchIds, ...exampleSketchIds])), updatedAt: now };
}

export function rejectConvention(entry: ConventionEntry, now = Date.now()): ConventionEntry {
  return { ...entry, corrections: entry.corrections + 1, confidence: Math.max(0, entry.confidence - 0.2), enabled: entry.confidence > 0.35, updatedAt: now };
}

export function correctConvention(entry: ConventionEntry, semanticMeaning: AuthoringIntentFragment, label: string, now = Date.now()): ConventionEntry {
  return { ...entry, semanticMeaning, humanReadableLabel: label, corrections: entry.corrections + 1, confidence: Math.max(0.55, entry.confidence), updatedAt: now };
}

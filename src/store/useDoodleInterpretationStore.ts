import { nanoid } from "nanoid";
import { create } from "zustand";

import type {
  DiffBoundingBox,
} from "../core/image/canvasDiff";
import type {
  SharedSceneElement,
} from "../core/shared-state/types";
import {
  useWorldloomStore,
} from "./useWorldloomStore";

export type ConfirmedDoodleMeaning = {
  id: string;
  confirmedAt: number;
  imageDataUrl: string;
  aiSummary: string;
  selectedLabel: string;
  selectedDescription: string;
  source:
    | "qwen_candidate"
    | "custom";
  boundingBox:
    | DiffBoundingBox
    | null;
};

export type FinalMapUnderstanding = {
  id: string;
  confirmedAt: number;
  worldSetting: string;
  doodles: ConfirmedDoodleMeaning[];
};

type ConfirmDoodleInput = Omit<
  ConfirmedDoodleMeaning,
  "id" | "confirmedAt"
>;

type DoodleMeaningPatch = {
  selectedLabel?: string;
  selectedDescription?: string;
};

type DoodleInterpretationState = {
  confirmedDoodles:
    ConfirmedDoodleMeaning[];

  finalMapUnderstanding:
    FinalMapUnderstanding | null;

  worldSetting: string;

  setWorldSetting: (
    worldSetting: string,
  ) => void;

  confirmDoodle: (
    input: ConfirmDoodleInput,
  ) => ConfirmedDoodleMeaning;

  updateConfirmedDoodle: (
    id: string,
    patch: DoodleMeaningPatch,
  ) => void;

  removeConfirmedDoodle: (
    id: string,
  ) => void;

  confirmOverallMap:
    () => FinalMapUnderstanding | null;

  reopenOverallMap: () => void;

  clearConfirmedDoodles: () => void;
};

function toSharedSceneElement(
  doodle: ConfirmedDoodleMeaning,
): SharedSceneElement {
  return {
    id: doodle.id,
    type: "doodle",
    name: doodle.selectedLabel,

    description:
      doodle.selectedDescription,

    bounds:
      doodle.boundingBox
        ? {
            x:
              doodle.boundingBox.x,

            y:
              doodle.boundingBox.y,

            width:
              doodle.boundingBox.width,

            height:
              doodle.boundingBox.height,
          }
        : undefined,

    semanticRoles: [
      doodle.selectedLabel,
    ],

    preserved: true,
    status: "committed",

    provenance: {
      source:
        doodle.source ===
        "qwen_candidate"
          ? "ai"
          : "user",

      sourceIds: [
        doodle.id,
      ],

      explanation:
        doodle.source ===
        "qwen_candidate"
          ? doodle.aiSummary
          : "Meaning supplied directly by the user.",

      updatedAt:
        doodle.confirmedAt,
    },
  };
}

function synchronizeDoodlesWithMainProject(
  doodles: ConfirmedDoodleMeaning[],
  worldSetting: string,
): void {
  const mainStore =
    useWorldloomStore.getState();

  const existingElements =
    mainStore.project
      .sharedLevelDesignState
      .scene
      .elements
      .filter(
        (element) =>
          element.type !==
          "doodle",
      );

  mainStore.updateSharedScene({
    worldSetting,

    elements: [
      ...existingElements,

      ...doodles.map(
        toSharedSceneElement,
      ),
    ],
  });
}

export const useDoodleInterpretationStore =
  create<DoodleInterpretationState>(
    (set, get) => ({
      confirmedDoodles: [],
      finalMapUnderstanding: null,
      worldSetting: "",

      setWorldSetting: (
        worldSetting,
      ) => {
        set({
          worldSetting,
          finalMapUnderstanding: null,
        });

        const state = get();

        synchronizeDoodlesWithMainProject(
          state.confirmedDoodles,
          worldSetting,
        );
      },

      confirmDoodle: (input) => {
        const confirmedDoodle:
        ConfirmedDoodleMeaning = {
          ...input,

          id:
            `doodle-${nanoid(8)}`,

          confirmedAt:
            Date.now(),
        };

        set((state) => ({
          confirmedDoodles: [
            ...state.confirmedDoodles,
            confirmedDoodle,
          ],

          finalMapUnderstanding: null,
        }));

        const state = get();

        synchronizeDoodlesWithMainProject(
          state.confirmedDoodles,
          state.worldSetting,
        );

        return confirmedDoodle;
      },

      updateConfirmedDoodle: (
        id,
        patch,
      ) => {
        set((state) => ({
          confirmedDoodles:
            state.confirmedDoodles.map(
              (item) =>
                item.id === id
                  ? {
                      ...item,
                      ...patch,

                      confirmedAt:
                        Date.now(),
                    }
                  : item,
            ),

          finalMapUnderstanding: null,
        }));

        const state = get();

        synchronizeDoodlesWithMainProject(
          state.confirmedDoodles,
          state.worldSetting,
        );
      },

      removeConfirmedDoodle: (
        id,
      ) => {
        set((state) => ({
          confirmedDoodles:
            state.confirmedDoodles.filter(
              (item) =>
                item.id !== id,
            ),

          finalMapUnderstanding: null,
        }));

        const state = get();

        synchronizeDoodlesWithMainProject(
          state.confirmedDoodles,
          state.worldSetting,
        );
      },

      confirmOverallMap: () => {
        const {
          confirmedDoodles,
          worldSetting,
        } = get();

        if (
          confirmedDoodles.length === 0
        ) {
          return null;
        }

        const finalMapUnderstanding:
        FinalMapUnderstanding = {
          id:
            `map-understanding-${nanoid(8)}`,

          confirmedAt:
            Date.now(),

          worldSetting:
            worldSetting.trim(),

          doodles:
            confirmedDoodles.map(
              (item) => ({
                ...item,

                boundingBox:
                  item.boundingBox
                    ? {
                        ...item.boundingBox,
                      }
                    : null,
              }),
            ),
        };

        synchronizeDoodlesWithMainProject(
          finalMapUnderstanding.doodles,
          finalMapUnderstanding
            .worldSetting,
        );

        set({
          finalMapUnderstanding,
        });

        return finalMapUnderstanding;
      },

      reopenOverallMap: () => {
        set({
          finalMapUnderstanding: null,
        });
      },

      clearConfirmedDoodles: () => {
        set({
          confirmedDoodles: [],
          finalMapUnderstanding: null,
          worldSetting: "",
        });

        synchronizeDoodlesWithMainProject(
          [],
          "",
        );
      },
    }),
  );
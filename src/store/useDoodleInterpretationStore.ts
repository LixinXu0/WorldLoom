import { nanoid } from "nanoid";
import { create } from "zustand";

import type {
  DiffBoundingBox,
} from "../core/image/canvasDiff";


export type ConfirmedDoodleMeaning = {
  id: string;
  confirmedAt: number;
  imageDataUrl: string;
  aiSummary: string;
  selectedLabel: string;
  selectedDescription: string;
  source: "qwen_candidate" | "custom";
  boundingBox: DiffBoundingBox | null;
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


export const useDoodleInterpretationStore =
  create<DoodleInterpretationState>(
    (set, get) => ({
      confirmedDoodles: [],
      finalMapUnderstanding: null,
      worldSetting: "",


      setWorldSetting: (worldSetting) => {
        set({
          worldSetting,
          finalMapUnderstanding: null,
        });
      },


      confirmDoodle: (input) => {
        const confirmedDoodle:
        ConfirmedDoodleMeaning = {
          ...input,

          id:
            `doodle-${nanoid(8)}`,

          confirmedAt: Date.now(),
        };

        set((state) => ({
          confirmedDoodles: [
            ...state.confirmedDoodles,
            confirmedDoodle,
          ],

          finalMapUnderstanding: null,
        }));

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
                    }
                  : item,
            ),

          finalMapUnderstanding: null,
        }));
      },


      removeConfirmedDoodle: (id) => {
        set((state) => ({
          confirmedDoodles:
            state.confirmedDoodles.filter(
              (item) =>
                item.id !== id,
            ),

          finalMapUnderstanding: null,
        }));
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

          confirmedAt: Date.now(),

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
      },
    }),
  );
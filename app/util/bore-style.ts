import type { TFunction } from "i18next";
import { getSoilColor } from "@bedrock-engineer/gef-parser";

export const BORE_LEGEND_CODES = ["Z", "K", "V", "L", "G", "NBE"] as const;

export type BoreLegendCode = (typeof BORE_LEGEND_CODES)[number];

export interface BoreStyleSettings {
  colors: Record<BoreLegendCode, string>;
  labels: Partial<Record<BoreLegendCode, string>>;
}

export interface ResolvedBoreLegendItem {
  code: BoreLegendCode;
  color: string;
  label: string;
}

const DEFAULT_BORE_COLORS: Record<BoreLegendCode, string> = {
  Z: getSoilColor("Z"),
  K: getSoilColor("K"),
  V: getSoilColor("V"),
  L: getSoilColor("L"),
  G: getSoilColor("G"),
  NBE: getSoilColor("NBE"),
};

export function createDefaultBoreStyle(): BoreStyleSettings {
  return {
    colors: { ...DEFAULT_BORE_COLORS },
    labels: {},
  };
}

export function normalizeBoreStyle(
  style?: Partial<BoreStyleSettings> | null,
): BoreStyleSettings {
  return {
    colors: {
      ...DEFAULT_BORE_COLORS,
      ...(style?.colors ?? {}),
    },
    labels: {
      ...(style?.labels ?? {}),
    },
  };
}

export function resolveBoreLegendItems(
  style: Partial<BoreStyleSettings> | null | undefined,
  t: TFunction,
): Array<ResolvedBoreLegendItem> {
  const normalized = normalizeBoreStyle(style);

  return BORE_LEGEND_CODES.map((code) => ({
    code,
    color: normalized.colors[code],
    label: normalized.labels[code]?.trim() || getDefaultLegendLabel(code, t),
  }));
}

export function getBoreLayerColor(
  soilCode: string,
  style?: Partial<BoreStyleSettings> | null,
): string {
  const normalized = normalizeBoreStyle(style);
  const legendCode = getLegendCodeForSoil(soilCode);

  if (legendCode) {
    return normalized.colors[legendCode];
  }

  return getSoilColor(soilCode);
}

function getLegendCodeForSoil(soilCode: string): BoreLegendCode | null {
  const normalizedCode = soilCode.trim().toUpperCase();

  if (normalizedCode === "NBE") {
    return "NBE";
  }

  const firstCharacter = normalizedCode.charAt(0);

  if (BORE_LEGEND_CODES.includes(firstCharacter as BoreLegendCode)) {
    return firstCharacter as BoreLegendCode;
  }

  return null;
}

function getDefaultLegendLabel(code: BoreLegendCode, t: TFunction): string {
  switch (code) {
    case "Z":
      return `Z - ${t("sand")}`;
    case "K":
      return `K - ${t("clay")}`;
    case "V":
      return `V - ${t("peat")}`;
    case "L":
      return `L - ${t("silt")}`;
    case "G":
      return `G - ${t("gravel")}`;
    case "NBE":
      return `NBE - ${t("notDescribed")}`;
  }
}


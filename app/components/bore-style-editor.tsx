import { RotateCcwIcon } from "lucide-react";
import { Button } from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  BORE_LEGEND_CODES,
  resolveBoreLegendItems,
  type BoreLegendCode,
  type BoreStyleSettings,
} from "~/util/bore-style";

interface BoreStyleEditorProps {
  boreStyle: BoreStyleSettings;
  onChange: (style: BoreStyleSettings) => void;
  onReset: () => void;
}

export function BoreStyleEditor({
  boreStyle,
  onChange,
  onReset,
}: BoreStyleEditorProps) {
  const { t } = useTranslation();
  const legendItems = resolveBoreLegendItems(boreStyle, t);

  const updateColor = (code: BoreLegendCode, color: string) => {
    onChange({
      ...boreStyle,
      colors: {
        ...boreStyle.colors,
        [code]: color,
      },
    });
  };

  const updateLabel = (code: BoreLegendCode, label: string) => {
    onChange({
      ...boreStyle,
      labels: {
        ...boreStyle.labels,
        [code]: label,
      },
    });
  };

  return (
    <details className="mt-4 border border-gray-200 rounded-sm p-3 bg-gray-50">
      <summary className="cursor-pointer font-medium text-sm text-gray-800">
        {t("customizeBoreLog")}
      </summary>

      <div className="mt-4 space-y-3">
        {BORE_LEGEND_CODES.map((code, index) => {
          const legendItem = legendItems[index]!;

          return (
            <div
              key={code}
              className="grid grid-cols-[56px_72px_minmax(0,1fr)] gap-2 items-center"
            >
              <span className="font-mono text-xs text-gray-600">{code}</span>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                <span className="sr-only">{t("legendColor")}</span>
                <input
                  type="color"
                  value={boreStyle.colors[code]}
                  onChange={(event) => {
                    updateColor(code, event.target.value);
                  }}
                  className="h-9 w-full cursor-pointer rounded border border-gray-300 bg-white"
                />
              </label>

              <label className="block">
                <span className="sr-only">{t("legendLabel")}</span>
                <input
                  type="text"
                  value={boreStyle.labels[code] ?? legendItem.label}
                  onChange={(event) => {
                    updateLabel(code, event.target.value);
                  }}
                  className="w-full rounded-sm border border-gray-300 px-2 py-2 text-sm bg-white"
                />
              </label>
            </div>
          );
        })}

        <Button
          className="button mt-2 ml-auto"
          onPress={onReset}
        >
          {t("resetBoreStyle")} <RotateCcwIcon size={14} />
        </Button>
      </div>
    </details>
  );
}


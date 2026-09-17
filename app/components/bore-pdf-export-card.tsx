import { FileOutputIcon, FileTextIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type {
  BorePdfExportOptions,
  PdfGraphOption,
} from "~/util/bore-pdf-export";
import { Card, CardTitle } from "./card";

interface ExportablePdfFileItem {
  filename: string;
  fileType: "BORE" | "CPT" | "DISS";
}

interface BorePdfExportCardProps {
  exportableFiles: Array<ExportablePdfFileItem>;
  selectedFilenames: Array<string>;
  availableGraphOptions: Array<PdfGraphOption>;
  selectedGraphKeys: Array<string>;
  exportOptions: BorePdfExportOptions;
  isExporting: boolean;
  isExportingGefFiles: boolean;
  isLoadingGraphOptions: boolean;
  statusMessage: string | null;
  gefExportStatusMessage: string | null;
  onToggleFilename: (filename: string) => void;
  onToggleGraphKey: (key: string) => void;
  onToggleExportOption: (option: keyof BorePdfExportOptions) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectAllGraphs: () => void;
  onClearGraphSelection: () => void;
  onExport: () => void;
  onExportGefFiles: () => void;
}

const FILE_TYPE_BADGE_CLASSNAMES: Record<
  ExportablePdfFileItem["fileType"],
  string
> = {
  BORE: "bg-amber-100 text-amber-800 border-amber-200",
  CPT: "bg-blue-100 text-blue-800 border-blue-200",
  DISS: "bg-green-100 text-green-800 border-green-200",
};

const MAX_VISIBLE_EXPORT_FILES = 300;

export function BorePdfExportCard({
  exportableFiles,
  selectedFilenames,
  availableGraphOptions,
  selectedGraphKeys,
  exportOptions,
  isExporting,
  isExportingGefFiles,
  isLoadingGraphOptions,
  statusMessage,
  gefExportStatusMessage,
  onToggleFilename,
  onToggleGraphKey,
  onToggleExportOption,
  onSelectAll,
  onClearSelection,
  onSelectAllGraphs,
  onClearGraphSelection,
  onExport,
  onExportGefFiles,
}: BorePdfExportCardProps) {
  const { t } = useTranslation();
  const [filterQuery, setFilterQuery] = useState("");

  const selectedFilenameSet = useMemo(
    () => new Set(selectedFilenames),
    [selectedFilenames],
  );

  const filteredExportableFiles = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return exportableFiles;
    }

    return exportableFiles.filter((file) =>
      `${file.filename} ${file.fileType}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [exportableFiles, filterQuery]);

  const visibleExportableFiles = useMemo(() => {
    if (filteredExportableFiles.length <= MAX_VISIBLE_EXPORT_FILES) {
      return filteredExportableFiles;
    }

    const selectedFiles = filteredExportableFiles.filter((file) =>
      selectedFilenameSet.has(file.filename),
    );
    const remainingFiles = filteredExportableFiles.filter(
      (file) => !selectedFilenameSet.has(file.filename),
    );

    return [...selectedFiles, ...remainingFiles].slice(
      0,
      MAX_VISIBLE_EXPORT_FILES,
    );
  }, [filteredExportableFiles, selectedFilenameSet]);

  if (exportableFiles.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardTitle>{t("borePdfExportTitle")}</CardTitle>

      <p className="text-sm text-gray-600 mb-3">
        {t("borePdfExportDescription")}
      </p>

      <div className="mb-4 rounded-sm border border-gray-200 bg-gray-50 p-3">
        <div className="mb-2 text-sm font-medium text-gray-700">
          {t("borePdfExportPageOptions")}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["includeSummaryPage", t("borePdfIncludeSummaryPage")],
              ["includeBorePlotPage", t("borePdfIncludePlotPage")],
              ["includeSpecimensPage", t("borePdfIncludeSpecimensPage")],
              ["includeTechnicalInfoPage", t("borePdfIncludeTechnicalPage")],
            ] satisfies Array<[keyof BorePdfExportOptions, string]>
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-sm bg-white px-3 py-2 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={exportOptions[key]}
                onChange={() => {
                  onToggleExportOption(key);
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {exportOptions.includeBorePlotPage ? (
        <div className="mb-4 rounded-sm border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-sm font-medium text-gray-700">
            {t("borePdfGraphSelectionTitle")}
          </div>

          <div className="mb-3 text-xs text-gray-500">
            {t("borePdfGraphSelectionDescription")}
          </div>

          {isLoadingGraphOptions ? (
            <div className="mb-3 rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {t("borePdfGraphSelectionLoading")}
            </div>
          ) : null}

          <div className="flex gap-2 mb-3">
            <Button className="button" onPress={onSelectAllGraphs}>
              {t("selectAllGraphs")}
            </Button>

            <Button className="button" onPress={onClearGraphSelection}>
              {t("clearGraphSelection")}
            </Button>
          </div>

          {availableGraphOptions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableGraphOptions.map((graphOption) => (
                <label
                  key={graphOption.key}
                  className="flex items-center gap-2 rounded-sm bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedGraphKeys.includes(graphOption.key)}
                    onChange={() => {
                      onToggleGraphKey(graphOption.key);
                    }}
                  />
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${FILE_TYPE_BADGE_CLASSNAMES[graphOption.fileType]}`}
                  >
                    {graphOption.fileType}
                  </span>
                  <span>{graphOption.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-sm bg-white px-3 py-2 text-sm text-gray-500">
              {t("borePdfNoGraphsAvailable")}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2 mb-3">
        <Button className="button" onPress={onSelectAll}>
          {t("selectAllBorings")}
        </Button>

        <Button className="button" onPress={onClearSelection}>
          {t("clearSelection")}
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-sm border border-gray-200 bg-white px-3 py-2">
        <SearchIcon size={14} className="text-gray-400" />
        <input
          type="text"
          value={filterQuery}
          onChange={(event) => {
            setFilterQuery(event.target.value);
          }}
          placeholder={t("filterFilesPlaceholder")}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {filteredExportableFiles.length > MAX_VISIBLE_EXPORT_FILES ? (
        <div className="mb-2 text-xs text-gray-500">
          {t("showingLimitedFiles", {
            visible: visibleExportableFiles.length,
            total: filteredExportableFiles.length,
          })}
        </div>
      ) : null}

      <div className="max-h-56 overflow-auto border border-gray-200 rounded-sm bg-white">
        {visibleExportableFiles.length > 0 ? (
          visibleExportableFiles.map((file) => {
            const isSelected = selectedFilenameSet.has(file.filename);

            return (
              <label
                key={file.filename}
                className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    onToggleFilename(file.filename);
                  }}
                />

                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${FILE_TYPE_BADGE_CLASSNAMES[file.fileType]}`}
                >
                  {file.fileType}
                </span>

                <span className="text-gray-700 break-all">{file.filename}</span>
              </label>
            );
          })
        ) : (
          <div className="px-3 py-3 text-sm text-gray-500">
            {t("noFilesMatchFilter")}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {t("selectedBoringsCount", { count: selectedFilenames.length })}
      </div>

      {statusMessage ? (
        <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-sm px-2 py-1">
          {statusMessage}
        </div>
      ) : null}

      {gefExportStatusMessage ? (
        <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-sm px-2 py-1">
          {gefExportStatusMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Button
          className="flex gap-2 items-center justify-center w-full p-2 border border-emerald-300 rounded-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors disabled:opacity-60"
          onPress={onExportGefFiles}
          isDisabled={selectedFilenames.length === 0 || isExportingGefFiles}
        >
          <FileOutputIcon size={14} />
          {isExportingGefFiles
            ? t("exportingGefFiles")
            : t("exportSelectedGefFiles")}
        </Button>

        <Button
          className="flex gap-2 items-center justify-center w-full p-2 border border-blue-300 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:opacity-60"
          onPress={onExport}
          isDisabled={
            selectedFilenames.length === 0 ||
            isExporting ||
            !(
              exportOptions.includeSummaryPage ||
              exportOptions.includeSpecimensPage ||
              exportOptions.includeTechnicalInfoPage ||
              (exportOptions.includeBorePlotPage &&
                selectedGraphKeys.length > 0)
            )
          }
        >
          <FileTextIcon size={14} />
          {isExporting ? t("exportingBorePdfs") : t("exportSelectedBoringsPdf")}
        </Button>
      </div>
    </Card>
  );
}


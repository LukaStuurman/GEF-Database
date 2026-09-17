import type {
  BoreLayer,
  BoreSpecimen,
  ColumnInfo,
  DissRow,
  GefBoreData,
  GefCptData,
  GefDissData,
  PreExcavationLayer,
  Row,
} from "@bedrock-engineer/gef-parser";
import {
  findColumnByQuantity,
  formatSpecimenCode,
  getSoilCodeFromDescription,
  getSoilColor,
  SPECIMEN_CODES,
} from "@bedrock-engineer/gef-parser";
import * as Plot from "@observablehq/plot";
import { max, min } from "d3-array";
import type { TFunction } from "i18next";
import i18next from "../../src/i18n";
import { jsPDF } from "jspdf";
import { Children, isValidElement, type ReactNode } from "react";
import { getBoreHeaderSections } from "~/components/bore-header-items";
import { getCptHeaderSections } from "~/components/cpt-header-items";
import { getDissHeaderSections } from "~/components/diss-header-items";
import type { HeaderSection } from "~/components/gef-header-display";
import {
  detectCptChartAxes,
  getColumnDisplayName,
  getUnitCode,
  type ChartColumn,
} from "./chart-axes";
import {
  getBoreLayerColor,
  resolveBoreLegendItems,
  type BoreStyleSettings,
} from "./bore-style";

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;

const SUMMARY_BOX_TOP_MM = PAGE_MARGIN_MM + 8;
const SUMMARY_COLUMN_TOP_MM = PAGE_MARGIN_MM + 28;
const SUMMARY_TITLE_Y_MM = PAGE_MARGIN_MM + 16;
const SUMMARY_SUBTITLE_Y_MM = PAGE_MARGIN_MM + 22;
const SUMMARY_MIN_BOX_HEIGHT_MM = 52;
const SUMMARY_BOX_BOTTOM_PADDING_MM = 6;
const ROW_LINE_HEIGHT_MM = 3.6;

const BORE_PLOT_IMAGE_WIDTH_PX = 1400;
const BORE_PLOT_IMAGE_HEIGHT_PX = 1800;
const BORE_PLOT_TOP_MM = PAGE_MARGIN_MM + 62;
const BORE_PLOT_HEIGHT_MM = 184;
const BORE_PLOT_WIDTH_MM = 138;
const BORE_PLOT_LEFT_MM = PAGE_MARGIN_MM + 6;
const COMBINED_BORE_PLOT_HEIGHT_MM = 148;
const COMBINED_BORE_PLOT_WIDTH_MM = 118;
const COMBINED_BORE_PLOT_LEFT_MM = PAGE_MARGIN_MM + 10;
const COMBINED_BORE_PLOT_TITLE_GAP_MM = 5;
const COMBINED_BORE_PLOT_TITLE_TO_IMAGE_GAP_MM = 2;
const COMBINED_BORE_LEGEND_RESERVED_HEIGHT_MM = 34;
const BORE_COLUMN_X1 = 0;
const BORE_COLUMN_X2 = 0.22;
const BORE_TEXT_X = 0.29;
const BORE_SPECIMEN_X = 0.245;

const GENERIC_GRAPH_TOP_MM = PAGE_MARGIN_MM + 10;
const GENERIC_GRAPH_MAX_HEIGHT_MM =
  PAGE_HEIGHT_MM - GENERIC_GRAPH_TOP_MM - PAGE_MARGIN_MM;
const GENERIC_GRAPH_MAX_WIDTH_MM = CONTENT_WIDTH_MM;

const CPT_PLOT_IMAGE_WIDTH_PX = 1500;
const CPT_PLOT_IMAGE_HEIGHT_PX = 2200;
const CPT_COMBINED_PLOT_IMAGE_WIDTH_PX = 1500;
const CPT_COMBINED_PLOT_IMAGE_HEIGHT_PX = 2200;
const CPT_COMBINED_COLUMN_GAP_PX = 18;
const CPT_COMBINED_RIGHT_WIDTH_RATIO = 0.18;
const DISS_PLOT_IMAGE_WIDTH_PX = 1500;
const DISS_PLOT_IMAGE_HEIGHT_PX = 980;
const PRE_EXCAVATION_PLOT_IMAGE_WIDTH_PX = 1000;
const PRE_EXCAVATION_PLOT_IMAGE_HEIGHT_PX = 1700;
const MIN_PRE_EXCAVATION_LAYER_HEIGHT_PX = 15;

const SECTION_GAP_MM = 4;
const TECHNICAL_COLUMN_GAP_MM = 6;
const TECHNICAL_COLUMN_WIDTH_MM =
  (CONTENT_WIDTH_MM - TECHNICAL_COLUMN_GAP_MM) / 2;
const TECHNICAL_PAGE_TOP_MM = PAGE_MARGIN_MM + 10;
const SPECIMEN_HEADER_HEIGHT_MM = 10;
const SPECIMEN_HEADER_FONT_SIZE = 6.3;
const SPECIMEN_HEADER_LINE_HEIGHT_MM = 3.1;

const QTY_TIME = 12;
const QTY_CONE_RESISTANCE = 2;
const QTY_FRICTION_RESISTANCE = 3;
const QTY_FRICTION_NUMBER = 4;
const QTY_PORE_PRESSURE_U1 = 5;
const QTY_PORE_PRESSURE_U2 = 6;
const QTY_PORE_PRESSURE_U3 = 7;
const PORE_PRESSURE_COLORS = ["#2563eb", "#f97316", "#16a34a"];
const CPT_QC_LINE_COLOR = "#2563eb";
const CPT_FRICTION_LINE_COLOR = "#dc2626";
const CPT_FRICTION_NUMBER_LINE_COLOR = "#111827";
const BORE_PLOT_GRAPH_KEY = "BORE:plot";
const CPT_PRE_EXCAVATION_GRAPH_KEY = "CPT:pre-excavation";
const DISS_PORE_PRESSURE_GRAPH_KEY = "DISS:pore-pressure";
const DISS_CONE_RESISTANCE_GRAPH_KEY = "DISS:cone-resistance";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

type ExportableGefData = GefBoreData | GefCptData | GefDissData;
type DissTimeScale = "log" | "sqrt" | "linear";

export interface PdfExportItem {
  filename: string;
  data: ExportableGefData;
}

export interface PdfGraphOption {
  key: string;
  label: string;
  fileType: "BORE" | "CPT" | "DISS";
}

interface ExportSelectedBorePdfsOptions {
  files?: Array<PdfExportItem>;
  borings?: Array<PdfExportItem>;
  boreStyle: BoreStyleSettings;
  exportOptions: BorePdfExportOptions;
  selectedGraphKeys?: Array<string>;
}

interface PdfBinaryFile {
  filename: string;
  dataBase64: string;
}

interface SummaryItem {
  label: string;
  value: string;
}

interface GraphLegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

interface CptAxisSeries {
  axis: ChartColumn;
  color: string;
  dashed: boolean;
  domain: [number, number];
  points: Array<Row>;
}

interface SingleGraphPage {
  kind: "single";
  title: string;
  imageDataUrl: string;
}

interface CombinedCptGraphPage {
  kind: "cpt-combined";
  title: string;
  leftTitle: string | null;
  rightTitle: string | null;
  leftImageDataUrl: string | null;
  rightImageDataUrl: string | null;
  leftLegendItems: Array<GraphLegendItem>;
}

type GraphPage = SingleGraphPage | CombinedCptGraphPage;

export interface BorePdfExportOptions {
  includeSummaryPage: boolean;
  includeBorePlotPage: boolean;
  includeSpecimensPage: boolean;
  includeTechnicalInfoPage: boolean;
}

export function createDefaultBorePdfExportOptions(): BorePdfExportOptions {
  return {
    includeSummaryPage: true,
    includeBorePlotPage: true,
    includeSpecimensPage: false,
    includeTechnicalInfoPage: true,
  };
}

export function getAvailablePdfGraphOptions(
  files: Array<PdfExportItem>,
  t: TFunction,
): Array<PdfGraphOption> {
  const optionMap = new Map<string, PdfGraphOption>();

  for (const file of files) {
    switch (file.data.fileType) {
      case "BORE": {
        optionMap.set(BORE_PLOT_GRAPH_KEY, {
          key: BORE_PLOT_GRAPH_KEY,
          label: t("borePlotPageTitle"),
          fileType: "BORE",
        });
        break;
      }
      case "CPT": {
        const chartAxes = detectCptChartAxes(
          file.data.columnInfo,
          file.data.data,
          file.data.headers.ZID,
        );

        if (chartAxes.yAxis) {
          const xAxes = chartAxes.availableColumns.filter(
            (column) => !isDepthColumn(column) && column.key !== chartAxes.yAxis?.key,
          );

          for (const xAxis of xAxes) {
            const key = getCptGraphKey(xAxis);
            if (!optionMap.has(key)) {
              optionMap.set(key, {
                key,
                label: `CPT - ${xAxis.name}`,
                fileType: "CPT",
              });
            }
          }
        }

        if (file.data.preExcavationLayers.length > 0) {
          optionMap.set(CPT_PRE_EXCAVATION_GRAPH_KEY, {
            key: CPT_PRE_EXCAVATION_GRAPH_KEY,
            label: `CPT - ${t("preExcavation")}`,
            fileType: "CPT",
          });
        }
        break;
      }
      case "DISS": {
        const timeCol = findColumnByQuantity(file.data.columnInfo, QTY_TIME);
        const qcCol = findColumnByQuantity(file.data.columnInfo, QTY_CONE_RESISTANCE);
        const porePressureCols = [
          findColumnByQuantity(file.data.columnInfo, QTY_PORE_PRESSURE_U1),
          findColumnByQuantity(file.data.columnInfo, QTY_PORE_PRESSURE_U2),
          findColumnByQuantity(file.data.columnInfo, QTY_PORE_PRESSURE_U3),
        ].filter((column): column is ColumnInfo => column !== undefined);

        if (timeCol && porePressureCols.length > 0) {
          optionMap.set(DISS_PORE_PRESSURE_GRAPH_KEY, {
            key: DISS_PORE_PRESSURE_GRAPH_KEY,
            label: `DISS - ${t("dissPorePressurePageTitle")}`,
            fileType: "DISS",
          });
        }

        if (timeCol && qcCol) {
          optionMap.set(DISS_CONE_RESISTANCE_GRAPH_KEY, {
            key: DISS_CONE_RESISTANCE_GRAPH_KEY,
            label: `DISS - ${t("dissConeResistancePageTitle")}`,
            fileType: "DISS",
          });
        }
        break;
      }
    }
  }

  return Array.from(optionMap.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export async function exportSelectedBorePdfs({
  files,
  borings,
  boreStyle,
  exportOptions,
  selectedGraphKeys = [],
}: ExportSelectedBorePdfsOptions): Promise<{
  savedCount: number;
  directory: string | null;
}> {
  const exportItems = files ?? borings ?? [];
  const pdfFiles: Array<PdfBinaryFile> = [];

  for (const item of exportItems) {
    await appendPdfDebugLog("pdf-export:file-start", {
      filename: item.filename,
      fileType: item.data.fileType,
    });

    let data: ArrayBuffer | null;

    try {
      data = await createGefPdfBinary(
        item,
        boreStyle,
        exportOptions,
        selectedGraphKeys,
      );
    } catch (error) {
      await appendPdfDebugLog("pdf-export:file-error", {
        filename: item.filename,
        fileType: item.data.fileType,
        message: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw new Error(
        `PDF voor ${item.filename} kon niet worden gemaakt: ${getErrorMessage(error)}`,
      );
    }

    if (data === null) {
      await appendPdfDebugLog("pdf-export:file-skipped", {
        filename: item.filename,
        fileType: item.data.fileType,
      });
      continue;
    }

    pdfFiles.push({
      filename: `${stripGefExtension(item.filename)}.pdf`,
      dataBase64: arrayBufferToBase64(data),
    });
  }

  if (pdfFiles.length === 0) {
    return { savedCount: 0, directory: null };
  }

  if (window.desktopApi) {
    try {
      await appendPdfDebugLog("pdf-export:save-start", {
        count: pdfFiles.length,
        filenames: pdfFiles.map((file) => file.filename),
      });
      return await window.desktopApi.savePdfExports(pdfFiles);
    } catch (error) {
      await appendPdfDebugLog("pdf-export:save-error", {
        message: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : null,
      });
      console.error("Desktop PDF save failed, falling back to browser download.", error);
    }
  }

  for (const file of pdfFiles) {
    const blob = new Blob([base64ToArrayBuffer(file.dataBase64)], {
      type: "application/pdf",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  return { savedCount: pdfFiles.length, directory: null };
}

async function createGefPdfBinary(
  item: PdfExportItem,
  boreStyle: BoreStyleSettings,
  exportOptions: BorePdfExportOptions,
  selectedGraphKeys: Array<string>,
): Promise<ArrayBuffer | null> {
  const { data, filename } = item;
  const { t, language } = getPdfTranslationHelpers();
  const selectedGraphSet = new Set(selectedGraphKeys);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  let hasRenderedSection = false;
  const startSectionPage = () => {
    if (hasRenderedSection) {
      doc.addPage();
    }

    hasRenderedSection = true;
  };

  const shouldCombineBoreSummaryAndPlot =
    data.fileType === "BORE" &&
    exportOptions.includeSummaryPage &&
    exportOptions.includeBorePlotPage &&
    selectedGraphSet.has(BORE_PLOT_GRAPH_KEY);

  if (shouldCombineBoreSummaryAndPlot) {
    startSectionPage();
    const plotImageDataUrl = await createBorePlotImage({
      data,
      boreStyle,
      language,
      t,
    });
    renderCombinedBoreSummaryPlotPage(
      doc,
      filename,
      data,
      plotImageDataUrl,
      boreStyle,
      t,
    );
  } else {
    if (exportOptions.includeSummaryPage) {
      startSectionPage();
      renderSummaryPage(doc, filename, data, t);
    }

    if (exportOptions.includeBorePlotPage) {
      switch (data.fileType) {
        case "BORE": {
          if (!selectedGraphSet.has(BORE_PLOT_GRAPH_KEY)) {
            break;
          }

          startSectionPage();
          const plotImageDataUrl = await createBorePlotImage({
            data,
            boreStyle,
            language,
            t,
          });
          renderBorePlotPage(doc, plotImageDataUrl, boreStyle, t);
          break;
        }
        case "CPT": {
          const graphPages = await createCptGraphPages(data, t, selectedGraphSet);
          for (const graphPage of graphPages) {
            startSectionPage();
            renderGraphPage(doc, graphPage);
          }
          break;
        }
        case "DISS": {
          const graphPages = await createDissGraphPages(data, t, selectedGraphSet);
          for (const graphPage of graphPages) {
            startSectionPage();
            renderGraphPage(doc, graphPage);
          }
          break;
        }
      }
    }
  }

  if (
    data.fileType === "BORE" &&
    exportOptions.includeSpecimensPage &&
    data.specimens.length > 0
  ) {
    startSectionPage();
    renderSpecimensPages(doc, data.specimens, t, language);
  }

  if (exportOptions.includeTechnicalInfoPage) {
    startSectionPage();
    renderTechnicalInformationPages(doc, data, t, language);
  }

  if (!hasRenderedSection) {
    return null;
  }

  return doc.output("arraybuffer");
}

function renderSummaryPage(
  doc: jsPDF,
  filename: string,
  data: ExportableGefData,
  t: (key: string, options?: Record<string, unknown>) => string,
): void {
  renderDocumentTitle(doc, getSummaryPageTitle(data.fileType, t));
  renderSummaryPanel(doc, filename, data, t);
}

function renderBorePlotPage(
  doc: jsPDF,
  plotImageDataUrl: string,
  boreStyle: BoreStyleSettings,
  t: TFunction,
): void {
  renderDocumentTitle(doc, sanitizePdfText(t("borePlotPageTitle")));

  doc.addImage(
    plotImageDataUrl,
    "PNG",
    BORE_PLOT_LEFT_MM,
    BORE_PLOT_TOP_MM,
    BORE_PLOT_WIDTH_MM,
    BORE_PLOT_HEIGHT_MM,
  );

  renderLegend(
    doc,
    boreStyle,
    t,
    PAGE_MARGIN_MM,
    BORE_PLOT_TOP_MM + BORE_PLOT_HEIGHT_MM + 7,
  );
}

function renderCombinedBoreSummaryPlotPage(
  doc: jsPDF,
  filename: string,
  data: GefBoreData,
  plotImageDataUrl: string,
  boreStyle: BoreStyleSettings,
  t: TFunction,
): void {
  renderDocumentTitle(doc, sanitizePdfText(t("boreSummaryPageTitle")));
  const summaryBottomY = renderSummaryPanel(doc, filename, data, t);
  const plotTitleY = summaryBottomY + COMBINED_BORE_PLOT_TITLE_GAP_MM;
  const plotTopY = plotTitleY + COMBINED_BORE_PLOT_TITLE_TO_IMAGE_GAP_MM;
  const plotHeight = Math.min(
    COMBINED_BORE_PLOT_HEIGHT_MM,
    Math.max(
      104,
      PAGE_HEIGHT_MM -
        PAGE_MARGIN_MM -
        COMBINED_BORE_LEGEND_RESERVED_HEIGHT_MM -
        plotTopY,
    ),
  );
  const plotWidth =
    (COMBINED_BORE_PLOT_WIDTH_MM * plotHeight) / COMBINED_BORE_PLOT_HEIGHT_MM;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText(t("borePlotPageTitle")),
    PAGE_MARGIN_MM,
    plotTitleY,
  );

  doc.addImage(
    plotImageDataUrl,
    "PNG",
    COMBINED_BORE_PLOT_LEFT_MM,
    plotTopY,
    plotWidth,
    plotHeight,
  );

  renderLegend(
    doc,
    boreStyle,
    t,
    PAGE_MARGIN_MM,
    plotTopY + plotHeight + 6,
  );
}

function renderScaledGraphPage(
  doc: jsPDF,
  title: string,
  plotImageDataUrl: string,
): void {
  renderDocumentTitle(doc, sanitizePdfText(title));

  const imageProperties = doc.getImageProperties(plotImageDataUrl);
  const scale = Math.min(
    GENERIC_GRAPH_MAX_WIDTH_MM / imageProperties.width,
    GENERIC_GRAPH_MAX_HEIGHT_MM / imageProperties.height,
  );

  const renderWidth = imageProperties.width * scale;
  const renderHeight = imageProperties.height * scale;
  const x = PAGE_MARGIN_MM + (CONTENT_WIDTH_MM - renderWidth) / 2;

  doc.addImage(
    plotImageDataUrl,
    "PNG",
    x,
    GENERIC_GRAPH_TOP_MM,
    renderWidth,
    renderHeight,
  );
}

function renderGraphPage(doc: jsPDF, page: GraphPage): void {
  if (page.kind === "single") {
    renderScaledGraphPage(doc, page.title, page.imageDataUrl);
    return;
  }

  renderCombinedCptGraphPage(doc, page);
}

function renderCombinedCptGraphPage(
  doc: jsPDF,
  page: CombinedCptGraphPage,
): void {
  renderDocumentTitle(doc, sanitizePdfText(page.title));

  const contentTopY = PAGE_MARGIN_MM + 10;
  const maxContentHeight = PAGE_HEIGHT_MM - contentTopY - PAGE_MARGIN_MM;
  const columnGap = 4;
  const leftWidth = page.rightImageDataUrl
    ? CONTENT_WIDTH_MM * 0.76
    : CONTENT_WIDTH_MM;
  const rightWidth = page.leftImageDataUrl
    ? CONTENT_WIDTH_MM - leftWidth - columnGap
    : CONTENT_WIDTH_MM;
  const leftHeaderHeight = getCombinedGraphHeaderHeight(
    page.leftTitle,
    page.leftLegendItems,
  );
  const rightHeaderHeight = getCombinedGraphHeaderHeight(page.rightTitle, []);
  const leftImageProperties = page.leftImageDataUrl
    ? doc.getImageProperties(page.leftImageDataUrl)
    : null;
  const rightImageProperties = page.rightImageDataUrl
    ? doc.getImageProperties(page.rightImageDataUrl)
    : null;
  const leftAvailableHeight = maxContentHeight - leftHeaderHeight;
  const rightAvailableHeight = maxContentHeight - rightHeaderHeight;
  const leftHeightByWidth = leftImageProperties
    ? (leftWidth / leftImageProperties.width) * leftImageProperties.height
    : null;
  const rightHeightByWidth = rightImageProperties
    ? (rightWidth / rightImageProperties.width) * rightImageProperties.height
    : null;
  const sharedRenderHeight =
    page.leftImageDataUrl && page.rightImageDataUrl
      ? Math.min(
          leftAvailableHeight,
          rightAvailableHeight,
          leftHeightByWidth ?? leftAvailableHeight,
          rightHeightByWidth ?? rightAvailableHeight,
        )
      : null;

  let currentX = PAGE_MARGIN_MM;

  if (page.leftImageDataUrl) {
    renderCombinedGraphColumn(
      doc,
      currentX,
      contentTopY,
      leftWidth,
      maxContentHeight,
      page.leftTitle,
      page.leftImageDataUrl,
      page.leftLegendItems,
      sharedRenderHeight,
    );
    currentX += leftWidth + columnGap;
  }

  if (page.rightImageDataUrl) {
    renderCombinedGraphColumn(
      doc,
      page.leftImageDataUrl ? currentX : PAGE_MARGIN_MM,
      contentTopY,
      page.leftImageDataUrl ? rightWidth : CONTENT_WIDTH_MM,
      maxContentHeight,
      page.rightTitle,
      page.rightImageDataUrl,
      [],
      sharedRenderHeight,
    );
  }
}

function renderCombinedGraphColumn(
  doc: jsPDF,
  x: number,
  topY: number,
  width: number,
  maxHeight: number,
  title: string | null,
  imageDataUrl: string,
  legendItems: Array<GraphLegendItem>,
  forcedHeightMm: number | null = null,
): void {
  let currentY = topY;

  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(title), x, currentY);
    currentY += 5;
  }

  if (legendItems.length > 0) {
    currentY = renderGraphLegendRow(doc, x, currentY, legendItems) + 3;
  }

  const imageProperties = doc.getImageProperties(imageDataUrl);
  const maxRenderHeight = maxHeight - (currentY - topY);
  const renderHeight =
    forcedHeightMm !== null
      ? Math.min(forcedHeightMm, maxRenderHeight)
      : Math.min(
          maxRenderHeight,
          (width / imageProperties.width) * imageProperties.height,
        );
  const renderWidth = (imageProperties.width / imageProperties.height) * renderHeight;
  const imageX = x + (width - renderWidth) / 2;

  doc.addImage(
    imageDataUrl,
    "PNG",
    imageX,
    currentY,
    renderWidth,
    renderHeight,
  );
}

function getCombinedGraphHeaderHeight(
  title: string | null,
  legendItems: Array<GraphLegendItem>,
): number {
  return (title ? 5 : 0) + (legendItems.length > 0 ? 6 : 0);
}

function renderGraphLegendRow(
  doc: jsPDF,
  x: number,
  y: number,
  legendItems: Array<GraphLegendItem>,
): number {
  let currentX = x;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  for (const item of legendItems) {
    const color = hexToRgb(item.color);
    doc.setDrawColor(color.r, color.g, color.b);
    doc.setLineWidth(0.8);

    if (item.dashed) {
      doc.setLineDashPattern([1.6, 1.2], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }

    doc.line(currentX, y - 1.5, currentX + 8, y - 1.5);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(item.label), currentX + 10, y);
    currentX += doc.getTextWidth(sanitizePdfText(item.label)) + 22;
  }

  return y;
}

function renderSummaryPanel(
  doc: jsPDF,
  filename: string,
  data: ExportableGefData,
  t: (key: string, options?: Record<string, unknown>) => string,
): number {
  const processed = data.processed;
  const title = sanitizePdfText(processed.testId ?? stripGefExtension(filename));
  const subtitle = sanitizePdfText(filename);
  const { leftColumn, rightColumn } = getCompactSummaryItems(data, t);
  const columnWidth = (CONTENT_WIDTH_MM - 14) / 2;
  const leftColumnHeight = measureSummaryColumnHeight(doc, leftColumn, columnWidth);
  const rightColumnHeight = measureSummaryColumnHeight(
    doc,
    rightColumn,
    columnWidth,
  );
  const contentBottomY = Math.max(
    SUMMARY_SUBTITLE_Y_MM,
    SUMMARY_COLUMN_TOP_MM + Math.max(leftColumnHeight, rightColumnHeight),
  );
  const boxHeight = Math.max(
    SUMMARY_MIN_BOX_HEIGHT_MM,
    contentBottomY - SUMMARY_BOX_TOP_MM + SUMMARY_BOX_BOTTOM_PADDING_MM,
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(
    PAGE_MARGIN_MM,
    SUMMARY_BOX_TOP_MM,
    CONTENT_WIDTH_MM,
    boxHeight,
    2,
    2,
    "FD",
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(title, PAGE_MARGIN_MM + 5, SUMMARY_TITLE_Y_MM);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(subtitle, PAGE_MARGIN_MM + 5, SUMMARY_SUBTITLE_Y_MM);

  renderSummaryColumn(
    doc,
    leftColumn,
    PAGE_MARGIN_MM + 5,
    SUMMARY_COLUMN_TOP_MM,
    columnWidth,
  );
  renderSummaryColumn(
    doc,
    rightColumn,
    PAGE_MARGIN_MM + 9 + columnWidth,
    SUMMARY_COLUMN_TOP_MM,
    columnWidth,
  );

  return SUMMARY_BOX_TOP_MM + boxHeight;
}

function measureSummaryColumnHeight(
  doc: jsPDF,
  items: Array<SummaryItem>,
  width: number,
): number {
  const labelWidth = 32;
  const valueWidth = width - labelWidth;
  let totalHeight = 0;

  for (const item of items) {
    const labelLines = doc.splitTextToSize(
      sanitizePdfText(item.label),
      labelWidth,
    ) as Array<string>;
    const valueLines = doc.splitTextToSize(
      sanitizePdfText(item.value),
      valueWidth,
    ) as Array<string>;

    totalHeight +=
      Math.max(labelLines.length, valueLines.length) * ROW_LINE_HEIGHT_MM + 1.5;
  }

  return totalHeight;
}

function renderSummaryColumn(
  doc: jsPDF,
  items: Array<SummaryItem>,
  x: number,
  startY: number,
  width: number,
): number {
  let currentY = startY;
  const labelWidth = 32;
  const valueWidth = width - labelWidth;

  for (const item of items) {
    const labelLines = doc.splitTextToSize(
      sanitizePdfText(item.label),
      labelWidth,
    ) as Array<string>;
    const valueLines = doc.splitTextToSize(
      sanitizePdfText(item.value),
      valueWidth,
    ) as Array<string>;
    const rowHeight =
      Math.max(labelLines.length, valueLines.length) * ROW_LINE_HEIGHT_MM;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(labelLines, x, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(valueLines, x + labelWidth, currentY);

    currentY += rowHeight + 1.5;
  }

  return currentY;
}

function getSummaryPageTitle(
  fileType: ExportableGefData["fileType"],
  t: (key: string) => string,
): string {
  switch (fileType) {
    case "BORE":
      return sanitizePdfText(t("boreSummaryPageTitle"));
    case "CPT":
      return sanitizePdfText(t("cptSummaryPageTitle"));
    case "DISS":
      return sanitizePdfText(t("dissSummaryPageTitle"));
  }
}

function getCompactSummaryItems(
  data: ExportableGefData,
  t: (key: string) => string,
): {
  leftColumn: Array<SummaryItem>;
  rightColumn: Array<SummaryItem>;
} {
  const processed = data.processed;
  const startDateTime =
    processed.startDate && processed.startTime
      ? `${processed.startDate} ${processed.startTime}`
      : processed.startDate ?? "";
  const coordinateLabel = processed.coordinateSystem
    ? [
        processed.coordinateSystem?.name ?? "",
        processed.coordinateSystem?.epsg
          ? `(${processed.coordinateSystem.epsg})`
          : "",
      ]
        .filter((value) => value)
        .join(" ")
    : "";
  const coordinateValue =
    processed.originalX !== undefined && processed.originalY !== undefined
      ? `${processed.originalX}, ${processed.originalY}`
      : "";
  const wgs84Value = processed.wgs84
    ? `${processed.wgs84.lat.toFixed(6)}, ${processed.wgs84.lon.toFixed(6)}`
    : "";
  const groundLevelValue =
    processed.surfaceElevation !== undefined
      ? `${processed.surfaceElevation} m ${processed.heightSystem?.name ?? ""}`.trim()
      : "";

  const locationItems: Array<[string, string | null | undefined]> = [
    [t("locationLabel"), coordinateLabel],
    [coordinateLabel ? t("coordinatesLocation") : "", coordinateValue],
    [processed.wgs84 ? "WGS84" : "", wgs84Value],
    [t("groundLevel"), groundLevelValue],
  ];

  switch (data.fileType) {
    case "BORE": {
      const boringDate = processed.texts.datumBoring?.value;
      const placeName = processed.texts.plaatsUitvoering?.value;
      const drillingCompany = processed.texts.boorfirma?.value;
      const finalDepth = processed.measurements.einddiepte;

      return {
        leftColumn: compactSummary([
          [t("projectId"), processed.projectId],
          [t("testId"), processed.testId],
          [t("company"), processed.companyName],
          [t("date"), startDateTime],
          [t("boringDate"), boringDate],
          [t("placeName"), placeName],
        ]),
        rightColumn: compactSummary([
          [
            t("depth"),
            finalDepth ? `${finalDepth.value} ${finalDepth.unit ?? "m"}` : "",
          ],
          [t("drillingCompany"), drillingCompany],
          ...locationItems,
        ]),
      };
    }
    case "CPT": {
      const waterLevel =
        processed.measurements.groundwaterLevelWithRespectToDatumOfHeightSystemInZid;
      const finalDepth = processed.measurements.endDepthOfPenetrationTest;

      return {
        leftColumn: compactSummary([
          [t("projectId"), processed.projectId],
          [t("testId"), processed.testId],
          [t("company"), processed.companyName],
          [t("date"), startDateTime],
        ]),
        rightColumn: compactSummary([
          [
            t("depth"),
            finalDepth ? `${finalDepth.value} ${finalDepth.unit ?? "m"}` : "",
          ],
          [
            t("waterLevel"),
            waterLevel ? `${waterLevel.value} ${waterLevel.unit ?? "m"}` : "",
          ],
          [t("scanNumber"), data.headers.LASTSCAN ? String(data.headers.LASTSCAN) : ""],
          [
            t("dissTests"),
            data.headers.CHILD?.length ? String(data.headers.CHILD.length) : "",
          ],
          ...locationItems,
        ]),
      };
    }
    case "DISS": {
      const parentValue =
        data.parent?.value != null
          ? `${data.parent.value} ${data.parent.unit ?? "m"}`
          : "";

      return {
        leftColumn: compactSummary([
          [t("projectId"), processed.projectId],
          [t("testId"), processed.testId],
          [t("company"), processed.companyName],
          [t("date"), startDateTime],
          [t("parentCpt"), data.parent?.reference],
        ]),
        rightColumn: compactSummary([
          [t("dissipationDepth"), parentValue],
          ...locationItems,
        ]),
      };
    }
  }
}

function compactSummary(
  items: Array<[string, string | null | undefined]>,
): Array<SummaryItem> {
  return items
    .filter(([label, value]) => Boolean(label && value))
    .map(([label, value]) => ({
      label,
      value: String(value),
    }));
}

async function createBorePlotImage({
  data,
  boreStyle,
  language,
  t,
}: {
  data: GefBoreData;
  boreStyle: BoreStyleSettings;
  language: string;
  t: (key: string) => string;
}): Promise<string> {
  const lang: "nl" | "en" = language === "en" ? "en" : "nl";
  const layers = data.layers;
  const specimens = data.specimens;
  const minDepth = min(layers.map((layer) => layer.depthTop)) ?? 0;
  const maxDepth = max(layers.map((layer) => layer.depthBottom)) ?? 0;
  const depthRange = Math.max(maxDepth - minDepth, 1);
  const pixelsPerMeter = (BORE_PLOT_IMAGE_HEIGHT_PX - 100) / depthRange;
  const layersWithLabels = layers.filter((layer) => {
    const layerThickness = layer.depthBottom - layer.depthTop;
    return layerThickness * pixelsPerMeter >= 26;
  });

  const plot = Plot.plot({
    style: {
      backgroundColor: "white",
      overflow: "visible",
      fontFamily: "Arial, sans-serif",
    },
    width: BORE_PLOT_IMAGE_WIDTH_PX,
    height: BORE_PLOT_IMAGE_HEIGHT_PX,
    marginTop: 26,
    marginLeft: 92,
    marginRight: 450,
    marginBottom: 18,
    x: {
      axis: null,
      domain: [0, 0.9],
    },
    y: {
      reverse: true,
      label: sanitizePdfText(t("depthM")),
      grid: false,
      tickSize: 3,
      tickPadding: 6,
      ticks: Math.max(8, Math.min(16, Math.round(depthRange / 0.5))),
      tickFormat: (value: number) => value.toFixed(1),
    },
    marks: [
      Plot.rect(layers, {
        x1: BORE_COLUMN_X1,
        x2: BORE_COLUMN_X2,
        y1: "depthTop",
        y2: "depthBottom",
        fill: (layer: BoreLayer) => getBoreLayerColor(layer.soilCode, boreStyle),
        stroke: "#ffffff",
        strokeWidth: 1.2,
      }),
      Plot.text(layersWithLabels, {
        x: (BORE_COLUMN_X1 + BORE_COLUMN_X2) / 2,
        y: (layer: BoreLayer) =>
          layer.depthTop + (layer.depthBottom - layer.depthTop) / 2,
        text: (layer: BoreLayer) => layer.soilCode,
        fill: "black",
        fontSize: 20,
        textAnchor: "middle",
      }),
      Plot.text(layers, {
        x: BORE_TEXT_X,
        y: (layer: BoreLayer) =>
          layer.depthTop + (layer.depthBottom - layer.depthTop) / 2,
        text: (layer: BoreLayer) => sanitizePdfText(layer.description ?? ""),
        fill: "black",
        fontSize: 15,
        textAnchor: "start",
        dx: 8,
      }),
      ...(specimens.length > 0
        ? [
            Plot.dot(specimens, {
              x: BORE_SPECIMEN_X,
              y: (specimen: BoreSpecimen) =>
                specimen.depthTop +
                (specimen.depthBottom - specimen.depthTop) / 2,
              fill: "#e11d48",
              r: 6,
              symbol: "triangle",
              title: (specimen: BoreSpecimen) =>
                formatSpecimenTooltip(specimen, lang),
            }),
          ]
        : []),
      Plot.ruleX([BORE_COLUMN_X1, BORE_COLUMN_X2], {
        x: (value: number) => value,
        y1: minDepth,
        y2: maxDepth,
        stroke: "#111827",
        strokeWidth: 1.2,
      }),
      Plot.ruleY([minDepth, maxDepth], {
        y: (value: number) => value,
        x1: BORE_COLUMN_X1,
        x2: BORE_COLUMN_X2,
        stroke: "#111827",
        strokeWidth: 1.2,
      }),
    ],
  });

  plot.style.fontSize = "18px";

  try {
    return await svgToPngDataUrl(
      plot as unknown as SVGElement,
      BORE_PLOT_IMAGE_WIDTH_PX,
      BORE_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    plot.remove();
  }
}

async function createCptGraphPages(
  data: GefCptData,
  t: (key: string) => string,
  selectedGraphSet: Set<string>,
): Promise<Array<GraphPage>> {
  const chartAxes = detectCptChartAxes(data.columnInfo, data.data, data.headers.ZID);
  const graphPages: Array<GraphPage> = [];
  const cptNapRangeLabel = getCptNapRangeLabel(data.data, chartAxes.yAxis);

  if (chartAxes.xAxis && chartAxes.yAxis) {
    const yAxis = chartAxes.yAxis;
    const xAxes = chartAxes.availableColumns.filter(
      (column) => !isDepthColumn(column) && column.key !== yAxis.key,
    );
    const qcAxis = getCptChartColumnByQuantity(data.columnInfo, QTY_CONE_RESISTANCE);
    const frictionResistanceAxis = getCptChartColumnByQuantity(
      data.columnInfo,
      QTY_FRICTION_RESISTANCE,
    );
    const frictionNumberAxis = getCptChartColumnByQuantity(
      data.columnInfo,
      QTY_FRICTION_NUMBER,
    );
    const selectedQcAxis =
      qcAxis && selectedGraphSet.has(getCptGraphKey(qcAxis)) ? qcAxis : null;
    const selectedFrictionResistanceAxis =
      frictionResistanceAxis &&
      selectedGraphSet.has(getCptGraphKey(frictionResistanceAxis))
        ? frictionResistanceAxis
        : null;
    const selectedFrictionNumberAxis =
      frictionNumberAxis &&
      selectedGraphSet.has(getCptGraphKey(frictionNumberAxis))
        ? frictionNumberAxis
        : null;

    if (
      selectedQcAxis ||
      selectedFrictionResistanceAxis ||
      selectedFrictionNumberAxis
    ) {
      const combinedImageDataUrl = await createCptComparisonPlotImage({
        data: data.data,
        topAxis: selectedQcAxis,
        bottomAxis: selectedFrictionResistanceAxis,
        rightAxis: selectedFrictionNumberAxis,
        yAxis,
        reverseY: yAxis.key !== "elevation",
      });

      if (combinedImageDataUrl) {
        graphPages.push({
          kind: "cpt-combined",
          title: sanitizePdfText(
            [t("cptGraphPageTitle"), cptNapRangeLabel].filter(Boolean).join(" - "),
          ),
          leftTitle: null,
          rightTitle: null,
          leftImageDataUrl: combinedImageDataUrl,
          rightImageDataUrl: null,
          leftLegendItems: [],
        });
      }
    }

    const combinedGraphKeys = new Set(
      [qcAxis, frictionResistanceAxis, frictionNumberAxis]
        .filter((axis): axis is ChartColumn => axis !== null)
        .map((axis) => getCptGraphKey(axis)),
    );

    for (const xAxis of xAxes) {
      if (combinedGraphKeys.has(getCptGraphKey(xAxis))) {
        continue;
      }

      if (!selectedGraphSet.has(getCptGraphKey(xAxis))) {
        continue;
      }

      const imageDataUrl = await createCptPlotImage({
        data: data.data,
        xAxis,
        yAxis,
        reverseY: yAxis.key !== "elevation",
        showComments: true,
      });

      if (!imageDataUrl) {
        continue;
      }

      graphPages.push({
        kind: "single",
        title: [
          `${sanitizePdfText(t("cptGraphPageTitle"))}: ${sanitizePdfText(xAxis.name)}`,
          cptNapRangeLabel,
        ]
          .filter(Boolean)
          .join(" - "),
        imageDataUrl,
      });
    }
  }

  if (
    data.preExcavationLayers.length > 0 &&
    selectedGraphSet.has(CPT_PRE_EXCAVATION_GRAPH_KEY)
  ) {
    graphPages.push({
      kind: "single",
      title: sanitizePdfText(t("preExcavation")),
      imageDataUrl: await createPreExcavationPlotImage(data.preExcavationLayers, t),
    });
  }

  return graphPages;
}

async function createCptPlotImage({
  data,
  xAxis,
  yAxis,
  reverseY,
  showComments,
  plotWidthPx = CPT_PLOT_IMAGE_WIDTH_PX,
  lineColor = "#2563eb",
  lineDasharray,
}: {
  data: Array<Row>;
  xAxis: ChartColumn;
  yAxis: ChartColumn;
  reverseY: boolean;
  showComments: boolean;
  plotWidthPx?: number;
  lineColor?: string;
  lineDasharray?: string;
}): Promise<string | null> {
  const plotData = data.filter(
    (row) =>
      typeof row[xAxis.key] === "number" && typeof row[yAxis.key] === "number",
  );

  if (plotData.length === 0) {
    return null;
  }

  const dataWithComments =
    showComments && plotData.some((row) => row.comment)
      ? plotData.filter((row) => row.comment)
      : [];
  const shouldShowComments = dataWithComments.length > 0;
  const maxXValue = max(plotData, (row) => Number(row[xAxis.key])) ?? 0;
  const yValues = plotData
    .map((row) => Number(row[yAxis.key]))
    .filter((value) => Number.isFinite(value));
  const yDomain = getCptVerticalDomain(yValues, reverseY);
  const plotWidth = shouldShowComments
    ? plotWidthPx + 320
    : plotWidthPx;

  const plot = Plot.plot({
    width: plotWidth,
    height: CPT_PLOT_IMAGE_HEIGHT_PX,
    marginTop: 26,
    marginLeft: 112,
    marginRight: shouldShowComments ? 360 : 80,
    marginBottom: 86,
    style: {
      backgroundColor: "white",
      overflow: "visible",
      fontFamily: "Arial, sans-serif",
    },
    x: {
      label: sanitizePdfText(`${xAxis.name} (${xAxis.unit})`),
      grid: true,
    },
    y: {
      grid: true,
      reverse: reverseY,
      label: sanitizePdfText(`${yAxis.name} (${yAxis.unit})`),
      domain: yDomain,
      nice: false,
    },
    marks: [
      Plot.frame(),
      Plot.lineX(plotData, {
        x: xAxis.key,
        y: yAxis.key,
        stroke: lineColor,
        strokeWidth: 2,
        strokeDasharray: lineDasharray,
      }),
      ...(shouldShowComments
        ? [
            Plot.text(dataWithComments, {
              x: maxXValue,
              y: yAxis.key,
              text: (row: Row) => sanitizePdfText(String(row.comment ?? "")),
              dx: 12,
              textAnchor: "start",
              fill: "#111827",
              fontSize: 16,
            }),
          ]
        : []),
    ],
  });

  plot.style.fontSize = "18px";

  try {
    return await svgToPngDataUrl(
      plot as unknown as SVGElement,
      plotWidth,
      CPT_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    plot.remove();
  }
}

async function createCptComparisonPlotImage({
  data,
  topAxis,
  bottomAxis,
  rightAxis,
  yAxis,
  reverseY,
}: {
  data: Array<Row>;
  topAxis: ChartColumn | null;
  bottomAxis: ChartColumn | null;
  rightAxis: ChartColumn | null;
  yAxis: ChartColumn;
  reverseY: boolean;
}): Promise<string | null> {
  const topSeries = createCptAxisSeries({
    data,
    xAxis: topAxis,
    yAxis,
    color: CPT_QC_LINE_COLOR,
    dashed: false,
  });
  const bottomSeries = createCptAxisSeries({
    data,
    xAxis: bottomAxis,
    yAxis,
    color: CPT_FRICTION_LINE_COLOR,
    dashed: true,
  });
  const rightSeries = createCptAxisSeries({
    data,
    xAxis: rightAxis,
    yAxis,
    color: CPT_FRICTION_NUMBER_LINE_COLOR,
    dashed: false,
  });

  if (
    (!topSeries || topSeries.points.length === 0) &&
    (!bottomSeries || bottomSeries.points.length === 0) &&
    (!rightSeries || rightSeries.points.length === 0)
  ) {
    return null;
  }

  const svg = createCombinedCptSvg({
    width: CPT_COMBINED_PLOT_IMAGE_WIDTH_PX,
    height: CPT_COMBINED_PLOT_IMAGE_HEIGHT_PX,
    topSeries: topSeries && topSeries.points.length > 0 ? topSeries : null,
    bottomSeries:
      bottomSeries && bottomSeries.points.length > 0 ? bottomSeries : null,
    rightSeries:
      rightSeries && rightSeries.points.length > 0 ? rightSeries : null,
    yAxis,
    reverseY,
  });

  try {
    return await svgToPngDataUrl(
      svg,
      CPT_COMBINED_PLOT_IMAGE_WIDTH_PX,
      CPT_COMBINED_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    svg.remove();
  }
}

function createCptAxisSeries({
  data,
  xAxis,
  yAxis,
  color,
  dashed,
}: {
  data: Array<Row>;
  xAxis: ChartColumn | null;
  yAxis: ChartColumn;
  color: string;
  dashed: boolean;
}): CptAxisSeries | null {
  if (xAxis === null) {
    return null;
  }

  const points = data.filter(
    (row) =>
      typeof row[xAxis.key] === "number" && typeof row[yAxis.key] === "number",
  );

  if (points.length === 0) {
    return null;
  }

  const xValues = points
    .map((row) => Number(row[xAxis.key]))
    .filter((value) => Number.isFinite(value));

  return {
    axis: xAxis,
    color,
    dashed,
    domain: getZeroStartedNumericDomain(xValues),
    points,
  };
}

function createCombinedCptSvg({
  width,
  height,
  topSeries,
  bottomSeries,
  rightSeries,
  yAxis,
  reverseY,
}: {
  width: number;
  height: number;
  topSeries: CptAxisSeries | null;
  bottomSeries: CptAxisSeries | null;
  rightSeries: CptAxisSeries | null;
  yAxis: ChartColumn;
  reverseY: boolean;
}): SVGElement {
  const svg = createSvgElement("svg", {
    xmlns: SVG_NAMESPACE,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  });
  const background = createSvgElement("rect", {
    x: 0,
    y: 0,
    width,
    height,
    fill: "#ffffff",
  });
  svg.append(background);

  const hasLeftPlot = topSeries !== null || bottomSeries !== null;
  const hasRightPlot = rightSeries !== null;
  const plotX = 112;
  const plotY = topSeries !== null || rightSeries !== null ? 132 : 54;
  const totalPlotWidth = width - plotX - 48;
  const columnGap =
    hasLeftPlot && hasRightPlot ? CPT_COMBINED_COLUMN_GAP_PX : 0;
  const plotHeight = height - plotY - (bottomSeries !== null ? 136 : 88);
  const rightPlotWidth =
    hasLeftPlot && hasRightPlot
      ? Math.round(
          (totalPlotWidth - columnGap) * CPT_COMBINED_RIGHT_WIDTH_RATIO,
        )
      : hasRightPlot
        ? totalPlotWidth
        : 0;
  const leftPlotWidth =
    hasLeftPlot && hasRightPlot
      ? totalPlotWidth - rightPlotWidth - columnGap
      : hasLeftPlot
        ? totalPlotWidth
        : 0;
  const leftPlotX = plotX;
  const rightPlotX = leftPlotX + leftPlotWidth + columnGap;
  const yValues = [
    ...(topSeries?.points ?? []),
    ...(bottomSeries?.points ?? []),
    ...(rightSeries?.points ?? []),
  ]
    .map((row) => Number(row[yAxis.key]))
    .filter((value) => Number.isFinite(value));
  const yDomain = getCptVerticalDomain(yValues, reverseY);
  const yTicks = createCptVerticalTicks(yDomain[0], yDomain[1], 11);
  const scaleY = (value: number) =>
    scaleNumericValue(
      value,
      yDomain[0],
      yDomain[1],
      reverseY ? plotY : plotY + plotHeight,
      reverseY ? plotY + plotHeight : plotY,
    );

  for (const tick of yTicks) {
    const y = scaleY(tick);
    svg.append(
      createSvgElement("line", {
        x1: hasLeftPlot ? leftPlotX : rightPlotX,
        x2: hasRightPlot ? rightPlotX + rightPlotWidth : leftPlotX + leftPlotWidth,
        y1: y,
        y2: y,
        stroke: "#e2e8f0",
        "stroke-width": 1,
      }),
    );
    const label = createSvgElement("text", {
      x: (hasLeftPlot ? leftPlotX : rightPlotX) - 12,
      y: y + 5,
      "font-size": 22,
      "text-anchor": "end",
      fill: "#475569",
      "font-family": "Arial, sans-serif",
    });
    label.textContent = formatCptTickValue(tick, yDomain[0], yDomain[1], 11);
    svg.append(label);
  }

  if (hasLeftPlot && hasRightPlot) {
    svg.append(
      createSvgElement("rect", {
        x: leftPlotX,
        y: plotY,
        width: leftPlotWidth + rightPlotWidth,
        height: plotHeight,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 1.2,
      }),
    );
  } else if (hasLeftPlot) {
    svg.append(
      createSvgElement("rect", {
        x: leftPlotX,
        y: plotY,
        width: leftPlotWidth,
        height: plotHeight,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 1.2,
      }),
    );
  } else if (hasRightPlot) {
    svg.append(
      createSvgElement("rect", {
        x: rightPlotX,
        y: plotY,
        width: rightPlotWidth,
        height: plotHeight,
        fill: "none",
        stroke: "#0f172a",
        "stroke-width": 1.2,
      }),
    );
  }

  const yLabel = createSvgElement("text", {
    x: 36,
    y: plotY + plotHeight / 2,
    "font-size": 26,
    fill: "#0f172a",
    "font-family": "Arial, sans-serif",
    transform: `rotate(-90 36 ${plotY + plotHeight / 2})`,
    "text-anchor": "middle",
  });
  yLabel.textContent = sanitizePdfText(`${yAxis.name} (${yAxis.unit})`);
  svg.append(yLabel);

  if (topSeries) {
    appendCptAxisToSvg(svg, {
      axisSeries: topSeries,
      position: "top",
      plotX: leftPlotX,
      plotY,
      plotWidth: leftPlotWidth,
      plotHeight,
    });
    svg.append(
      createSvgElement("path", {
        d: buildSvgLinePath(
          topSeries.points,
          (row) =>
            scaleNumericValue(
              Number(row[topSeries.axis.key]),
              topSeries.domain[0],
              topSeries.domain[1],
              leftPlotX,
              leftPlotX + leftPlotWidth,
            ),
          (row) => scaleY(Number(row[yAxis.key])),
        ),
        fill: "none",
        stroke: topSeries.color,
        "stroke-width": 4,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
  }

  if (bottomSeries) {
    appendCptAxisToSvg(svg, {
      axisSeries: bottomSeries,
      position: "bottom",
      plotX: leftPlotX,
      plotY,
      plotWidth: leftPlotWidth,
      plotHeight,
    });
    svg.append(
      createSvgElement("path", {
        d: buildSvgLinePath(
          bottomSeries.points,
          (row) =>
            scaleNumericValue(
              Number(row[bottomSeries.axis.key]),
              bottomSeries.domain[0],
              bottomSeries.domain[1],
              leftPlotX,
              leftPlotX + leftPlotWidth,
            ),
          (row) => scaleY(Number(row[yAxis.key])),
        ),
        fill: "none",
        stroke: bottomSeries.color,
        "stroke-width": 4,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "stroke-dasharray": "16 10",
      }),
    );
  }

  if (rightSeries) {
    appendCptAxisToSvg(svg, {
      axisSeries: rightSeries,
      position: "top",
      plotX: rightPlotX,
      plotY,
      plotWidth: rightPlotWidth,
      plotHeight,
    });
    svg.append(
      createSvgElement("path", {
        d: buildSvgLinePath(
          rightSeries.points,
          (row) =>
            scaleNumericValue(
              Number(row[rightSeries.axis.key]),
              rightSeries.domain[0],
              rightSeries.domain[1],
              rightPlotX,
              rightPlotX + rightPlotWidth,
            ),
          (row) => scaleY(Number(row[yAxis.key])),
        ),
        fill: "none",
        stroke: rightSeries.color,
        "stroke-width": 4,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
  }

  return svg;
}

function appendCptAxisToSvg(
  svg: SVGElement,
  {
    axisSeries,
    position,
    plotX,
    plotY,
    plotWidth,
    plotHeight,
  }: {
    axisSeries: CptAxisSeries;
    position: "top" | "bottom";
    plotX: number;
    plotY: number;
    plotWidth: number;
    plotHeight: number;
  },
): void {
  const domain = axisSeries.domain;
  const tickCount = plotWidth < 220 ? 4 : plotWidth < 320 ? 5 : 7;
  const ticks = createNiceTicks(domain[0], domain[1], tickCount);
  const axisY = position === "top" ? plotY : plotY + plotHeight;
  const tickEndY = position === "top" ? axisY - 10 : axisY + 10;
  const textY = position === "top" ? axisY - 18 : axisY + 30;
  const labelY = position === "top" ? axisY - 54 : axisY + 68;
  const tickFontSize = plotWidth < 220 ? 18 : 22;
  const axisLabelFontSize = plotWidth < 220 ? 21 : 24;
  const edgeInset = plotWidth < 220 ? 8 : 6;

  svg.append(
    createSvgElement("line", {
      x1: plotX,
      x2: plotX + plotWidth,
      y1: axisY,
      y2: axisY,
      stroke: axisSeries.color,
      "stroke-width": 1.6,
    }),
  );

  for (const [index, tick] of ticks.entries()) {
    const x = scaleNumericValue(tick, domain[0], domain[1], plotX, plotX + plotWidth);
    const isFirstTick = index === 0;
    const isLastTick = index === ticks.length - 1;
    const labelX = isFirstTick ? x + edgeInset : isLastTick ? x - edgeInset : x;
    const textAnchor = isFirstTick ? "start" : isLastTick ? "end" : "middle";
    svg.append(
      createSvgElement("line", {
        x1: x,
        x2: x,
        y1: axisY,
        y2: tickEndY,
        stroke: axisSeries.color,
        "stroke-width": 1.2,
      }),
    );
    const label = createSvgElement("text", {
      x: labelX,
      y: textY,
      "font-size": tickFontSize,
      "text-anchor": textAnchor,
      fill: axisSeries.color,
      "font-family": "Arial, sans-serif",
    });
    label.textContent = formatCptTickValue(
      tick,
      domain[0],
      domain[1],
      tickCount,
    );
    svg.append(label);
  }

  const axisLabel = createSvgElement("text", {
    x: plotX + plotWidth / 2,
    y: labelY,
    "font-size": axisLabelFontSize,
    "font-weight": "700",
    "text-anchor": "middle",
    fill: axisSeries.color,
    "font-family": "Arial, sans-serif",
  });
  axisLabel.textContent = sanitizePdfText(
    `${axisSeries.axis.name} (${axisSeries.axis.unit})`,
  );
  svg.append(axisLabel);
}

function buildSvgLinePath(
  points: Array<Row>,
  getX: (row: Row) => number,
  getY: (row: Row) => number,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${getX(point).toFixed(2)} ${getY(point).toFixed(2)}`;
    })
    .join(" ");
}

function createSvgElement(
  tag: string,
  attributes: Record<string, string | number>,
): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tag);

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }

  return element;
}

function scaleNumericValue(
  value: number,
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  if (domainStart === domainEnd) {
    return (rangeStart + rangeEnd) / 2;
  }

  const ratio = (value - domainStart) / (domainEnd - domainStart);
  return rangeStart + ratio * (rangeEnd - rangeStart);
}

function getPaddedNumericDomain(
  values: Array<number>,
  paddingRatio: number,
): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return [0, 1];
  }

  const domainMin = min(finiteValues) ?? 0;
  const domainMax = max(finiteValues) ?? 1;

  if (domainMin === domainMax) {
    const padding = Math.abs(domainMin || 1) * 0.1;
    return [domainMin - padding, domainMax + padding];
  }

  const padding = (domainMax - domainMin) * paddingRatio;
  return [domainMin - padding, domainMax + padding];
}

function getZeroStartedNumericDomain(values: Array<number>): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return [0, 1];
  }

  const domainMax = max(finiteValues) ?? 0;

  if (domainMax <= 0) {
    return [0, 1];
  }

  return [0, domainMax];
}

function getCptVerticalDomain(
  values: Array<number>,
  reverseY: boolean,
): [number, number] {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return [0, 1];
  }

  if (!reverseY) {
    const domainMin = min(finiteValues) ?? 0;
    const domainMax = max(finiteValues) ?? 1;

    if (domainMin === domainMax) {
      const padding = Math.abs(domainMin || 1) * 0.1;
      return [domainMin - padding, domainMax + padding];
    }

    return [domainMin, domainMax];
  }

  const domainMax = max(finiteValues) ?? 0;

  if (domainMax <= 0) {
    return [0, 1];
  }

  return [0, domainMax];
}

function createCptVerticalTicks(
  domainStart: number,
  domainEnd: number,
  tickCount: number,
): Array<number> {
  const ticks = createNiceTicks(domainStart, domainEnd, tickCount);
  const exactTicks = [domainStart, ...ticks, domainEnd]
    .filter((tick) => Number.isFinite(tick))
    .map((tick) => Number(tick.toFixed(10)));

  return Array.from(new Set(exactTicks)).sort((left, right) => left - right);
}

function formatCptBoundaryValue(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function getCptNapRangeLabel(
  data: Array<Row>,
  yAxis: ChartColumn | null,
): string | null {
  if (!yAxis || yAxis.key !== "elevation") {
    return null;
  }

  const yValues = data
    .map((row) => Number(row[yAxis.key]))
    .filter((value) => Number.isFinite(value));

  if (yValues.length === 0) {
    return null;
  }

  const startNap = max(yValues) ?? 0;
  const endNap = min(yValues) ?? 0;

  return `NAP ${formatCptBoundaryValue(startNap)} -> ${formatCptBoundaryValue(endNap)}`;
}

function createNiceTicks(
  domainStart: number,
  domainEnd: number,
  tickCount: number,
): Array<number> {
  if (!Number.isFinite(domainStart) || !Number.isFinite(domainEnd)) {
    return [0, 1];
  }

  if (domainStart === domainEnd) {
    return [domainStart];
  }

  const span = Math.abs(domainEnd - domainStart);
  const rawStep = span / Math.max(1, tickCount - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const niceStep =
    normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 2.5
          ? 2.5
          : normalizedStep <= 5
            ? 5
            : 10;
  const step = niceStep * magnitude;
  const start = Math.ceil(domainStart / step) * step;
  const end = Math.floor(domainEnd / step) * step;
  const ticks: Array<number> = [];

  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  if (ticks.length === 0) {
    return [domainStart, domainEnd];
  }

  return ticks;
}

function formatCptTickValue(
  value: number,
  domainStart: number,
  domainEnd: number,
  tickCount: number,
): string {
  const span = Math.abs(domainEnd - domainStart);
  const step = span / Math.max(1, tickCount - 1);

  if (step >= 10) {
    return value.toFixed(0);
  }

  if (step >= 1) {
    return value.toFixed(1);
  }

  if (step >= 0.1) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
}

async function createPreExcavationPlotImage(
  layers: Array<PreExcavationLayer>,
  t: (key: string) => string,
): Promise<string> {
  const maxDepth = max(layers.map((layer) => layer.depthBottom)) ?? 1;
  const plotHeight = PRE_EXCAVATION_PLOT_IMAGE_HEIGHT_PX - 56;
  const pixelsPerMeter = plotHeight / maxDepth;
  const layersWithLabels = layers.filter((layer) => {
    const layerThickness = layer.depthBottom - layer.depthTop;
    return layerThickness * pixelsPerMeter >= MIN_PRE_EXCAVATION_LAYER_HEIGHT_PX;
  });

  const plot = Plot.plot({
    style: {
      overflow: "visible",
      backgroundColor: "white",
      fontFamily: "Arial, sans-serif",
    },
    width: PRE_EXCAVATION_PLOT_IMAGE_WIDTH_PX,
    height: PRE_EXCAVATION_PLOT_IMAGE_HEIGHT_PX,
    marginLeft: 84,
    marginRight: 36,
    marginTop: 24,
    marginBottom: 18,
    x: {
      axis: null,
      domain: [0, 1],
    },
    y: {
      reverse: true,
      label: sanitizePdfText(t("depthM")),
      grid: true,
      domain: [0, maxDepth],
    },
    marks: [
      Plot.rect(layers, {
        x1: 0,
        x2: 1,
        y1: "depthTop",
        y2: "depthBottom",
        fill: (layer: PreExcavationLayer) => {
          const soilCode = getSoilCodeFromDescription(layer.description);
          return getSoilColor(soilCode);
        },
        stroke: "#ffffff",
        strokeWidth: 0.8,
      }),
      Plot.text(layersWithLabels, {
        x: 0.5,
        y: (layer: PreExcavationLayer) =>
          layer.depthTop + (layer.depthBottom - layer.depthTop) / 2,
        text: (layer: PreExcavationLayer) =>
          sanitizePdfText(
            layer.description.length > 24
              ? `${layer.description.slice(0, 22)}...`
              : layer.description,
          ),
        fill: "#111827",
        fontSize: 16,
        textAnchor: "middle",
      }),
      Plot.frame(),
    ],
  });

  plot.style.fontSize = "18px";

  try {
    return await svgToPngDataUrl(
      plot as unknown as SVGElement,
      PRE_EXCAVATION_PLOT_IMAGE_WIDTH_PX,
      PRE_EXCAVATION_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    plot.remove();
  }
}

async function createDissGraphPages(
  data: GefDissData,
  t: (key: string) => string,
  selectedGraphSet: Set<string>,
): Promise<Array<GraphPage>> {
  const graphPages: Array<GraphPage> = [];
  const timeCol = findColumnByQuantity(data.columnInfo, QTY_TIME);
  const qcCol = findColumnByQuantity(data.columnInfo, QTY_CONE_RESISTANCE);
  const porePressureCols = [
    findColumnByQuantity(data.columnInfo, QTY_PORE_PRESSURE_U1),
    findColumnByQuantity(data.columnInfo, QTY_PORE_PRESSURE_U2),
    findColumnByQuantity(data.columnInfo, QTY_PORE_PRESSURE_U3),
  ].filter((column): column is ColumnInfo => column !== undefined);

  if (!timeCol) {
    return graphPages;
  }

  if (
    porePressureCols.length > 0 &&
    selectedGraphSet.has(DISS_PORE_PRESSURE_GRAPH_KEY)
  ) {
    const imageDataUrl = await createDissPorePressurePlotImage({
      data: data.data,
      timeCol,
      porePressureCols,
      timeScale: "log",
      t,
    });

    if (imageDataUrl) {
      graphPages.push({
        kind: "single",
        title: sanitizePdfText(t("dissPorePressurePageTitle")),
        imageDataUrl,
      });
    }
  }

  if (qcCol && selectedGraphSet.has(DISS_CONE_RESISTANCE_GRAPH_KEY)) {
    const imageDataUrl = await createDissConeResistancePlotImage({
      data: data.data,
      timeCol,
      qcCol,
      timeScale: "log",
      t,
    });

    if (imageDataUrl) {
      graphPages.push({
        kind: "single",
        title: sanitizePdfText(t("dissConeResistancePageTitle")),
        imageDataUrl,
      });
    }
  }

  return graphPages;
}

async function createDissPorePressurePlotImage({
  data,
  timeCol,
  porePressureCols,
  timeScale,
  t,
}: {
  data: Array<DissRow>;
  timeCol: ColumnInfo;
  porePressureCols: Array<ColumnInfo>;
  timeScale: DissTimeScale;
  t: (key: string) => string;
}): Promise<string | null> {
  const timeKey = timeCol.name;
  const timeUnit = getUnitCode(timeCol.unit);
  const ppUnit = getUnitCode(porePressureCols[0]?.unit ?? "");

  const series = porePressureCols
    .map((column, index) => {
      const points = data
        .map((row) => ({
          time: row[timeKey],
          value: row[column.name],
        }))
        .filter(
          (
            point,
          ): point is {
            time: number;
            value: number;
          } =>
            typeof point.time === "number" &&
            typeof point.value === "number" &&
            (timeScale === "linear" || point.time > 0),
        );

      return {
        color: PORE_PRESSURE_COLORS[index] ?? "#2563eb",
        label: getColumnDisplayName(column),
        points,
      };
    })
    .filter((seriesEntry) => seriesEntry.points.length > 0);

  if (series.length === 0) {
    return null;
  }

  const plot = Plot.plot({
    width: DISS_PLOT_IMAGE_WIDTH_PX,
    height: DISS_PLOT_IMAGE_HEIGHT_PX,
    marginTop: 24,
    marginLeft: 92,
    marginRight: 170,
    marginBottom: 72,
    style: {
      backgroundColor: "white",
      overflow: "visible",
      fontFamily: "Arial, sans-serif",
    },
    x: getDissXScaleConfig(
      timeScale,
      sanitizePdfText(`${getColumnDisplayName(timeCol)} (${timeUnit})`),
    ),
    y: {
      grid: true,
      label: sanitizePdfText(`${t("porePressure")} (${ppUnit})`),
    },
    marks: [
      Plot.frame(),
      ...series.map((seriesEntry) =>
        Plot.line(seriesEntry.points, {
          x: "time",
          y: "value",
          stroke: seriesEntry.color,
          strokeWidth: 2,
        }),
      ),
      ...series.map((seriesEntry) =>
        Plot.text(
          [
            {
              ...seriesEntry.points[seriesEntry.points.length - 1]!,
              label: sanitizePdfText(seriesEntry.label),
            },
          ],
          {
            x: "time",
            y: "value",
            text: "label",
            dx: 10,
            textAnchor: "start",
            fill: seriesEntry.color,
            fontSize: 16,
          },
        ),
      ),
    ],
  });

  plot.style.fontSize = "18px";

  try {
    return await svgToPngDataUrl(
      plot as unknown as SVGElement,
      DISS_PLOT_IMAGE_WIDTH_PX,
      DISS_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    plot.remove();
  }
}

async function createDissConeResistancePlotImage({
  data,
  timeCol,
  qcCol,
  timeScale,
  t,
}: {
  data: Array<DissRow>;
  timeCol: ColumnInfo;
  qcCol: ColumnInfo;
  timeScale: DissTimeScale;
  t: (key: string) => string;
}): Promise<string | null> {
  const timeKey = timeCol.name;
  const timeUnit = getUnitCode(timeCol.unit);
  const qcUnit = getUnitCode(qcCol.unit);
  const filteredData = data
    .map((row) => ({
      time: row[timeKey],
      value: row[qcCol.name],
    }))
    .filter(
      (
        point,
      ): point is {
        time: number;
        value: number;
      } =>
        typeof point.time === "number" &&
        typeof point.value === "number" &&
        (timeScale === "linear" || point.time > 0),
    );

  if (filteredData.length === 0) {
    return null;
  }

  const plot = Plot.plot({
    width: DISS_PLOT_IMAGE_WIDTH_PX,
    height: DISS_PLOT_IMAGE_HEIGHT_PX,
    marginTop: 24,
    marginLeft: 92,
    marginRight: 60,
    marginBottom: 72,
    style: {
      backgroundColor: "white",
      overflow: "visible",
      fontFamily: "Arial, sans-serif",
    },
    x: getDissXScaleConfig(
      timeScale,
      sanitizePdfText(`${getColumnDisplayName(timeCol)} (${timeUnit})`),
    ),
    y: {
      grid: true,
      label: sanitizePdfText(`${getColumnDisplayName(qcCol)} (${qcUnit})`),
    },
    marks: [
      Plot.frame(),
      Plot.line(filteredData, {
        x: "time",
        y: "value",
        stroke: "#2563eb",
        strokeWidth: 2,
      }),
    ],
  });

  plot.style.fontSize = "18px";

  try {
    return await svgToPngDataUrl(
      plot as unknown as SVGElement,
      DISS_PLOT_IMAGE_WIDTH_PX,
      DISS_PLOT_IMAGE_HEIGHT_PX,
    );
  } finally {
    plot.remove();
  }
}

function getDissXScaleConfig(scale: DissTimeScale, label: string) {
  switch (scale) {
    case "log":
      return { type: "log" as const, label, grid: true };
    case "sqrt":
      return {
        type: "pow" as const,
        exponent: 0.5,
        label: `sqrt ${label}`,
        grid: true,
      };
    case "linear":
      return { label, grid: true };
  }
}

function isDepthColumn(column: ChartColumn): boolean {
  const nameLower = column.name.toLowerCase();
  return (
    column.unit === "m" &&
    ["penetration", "sondeer", "length", "diepte", "lengte"].some((keyword) =>
      nameLower.includes(keyword),
    )
  );
}

function getCptGraphKey(column: ChartColumn): string {
  return `CPT:axis:${column.key}`;
}

function getCptChartColumnByQuantity(
  columnInfo: Array<ColumnInfo>,
  quantity: number,
): ChartColumn | null {
  const column = findColumnByQuantity(columnInfo, quantity);

  if (!column) {
    return null;
  }

  return {
    key: column.name,
    unit: getUnitCode(column.unit),
    name: getColumnDisplayName(column),
  };
}

async function svgToPngDataUrl(
  svgElement: SVGElement,
  width: number,
  height: number,
): Promise<string> {
  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(svgElement);
  const blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create PNG canvas for PDF export.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load plot image for PDF export."));
    image.src = url;
  });
}

function renderLegend(
  doc: jsPDF,
  boreStyle: BoreStyleSettings,
  t: (key: string) => string,
  startX: number,
  startY: number,
): void {
  const items = resolveBoreLegendItems(boreStyle, t);
  let currentX = startX;
  let currentY = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(t("legend")), currentX, currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  for (const item of items) {
    if (currentX > PAGE_WIDTH_MM - PAGE_MARGIN_MM - 40) {
      currentX = startX;
      currentY += 7;
    }

    const color = hexToRgb(item.color);
    doc.setFillColor(color.r, color.g, color.b);
    doc.setDrawColor(148, 163, 184);
    doc.rect(currentX, currentY - 3.5, 4, 4, "FD");
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(item.label), currentX + 6, currentY);

    currentX += Math.min(
      doc.getTextWidth(sanitizePdfText(item.label)) + 18,
      62,
    );
  }
}

function renderSpecimensPages(
  doc: jsPDF,
  specimens: Array<BoreSpecimen>,
  t: TFunction,
  language: string,
): void {
  const lang: "nl" | "en" = language === "en" ? "en" : "nl";
  const headerHeight = getSpecimenHeaderHeight(doc, t);
  let currentY = TECHNICAL_PAGE_TOP_MM + headerHeight + 4;
  let rowIndex = 0;

  renderSpecimensPageHeader(doc, t, headerHeight);

  for (const specimen of specimens) {
    const row = [
      String(specimen.specimenNumber ?? "-"),
      specimen.monstercode ?? "-",
      `${specimen.depthTop} - ${specimen.depthBottom}`,
      String(specimen.diameterMonster ?? "-"),
      String(specimen.diameterMonstersteekapparaat ?? "-"),
      [specimen.monsterdatum, specimen.monstertijd].filter(Boolean).join(" ") ||
        "-",
      formatSpecimenCode(
        specimen.geroerdOngeroerd,
        SPECIMEN_CODES.geroerd,
        lang,
      ) ?? "-",
      formatSpecimenCode(
        specimen.monstersteekapparaat,
        SPECIMEN_CODES.monstersteekapparaat,
        lang,
      ) ?? "-",
      [
        formatSpecimenCode(
          specimen.dikDunwandig,
          SPECIMEN_CODES.dikDunwandig,
          lang,
        ),
        formatSpecimenCode(
          specimen.monstermethode,
          SPECIMEN_CODES.monstermethode,
          lang,
        ),
      ]
        .filter(Boolean)
        .join(" / ") || "-",
    ];

    const rowHeight = measureSpecimenRowHeight(doc, row);

    if (currentY + rowHeight > PAGE_HEIGHT_MM - PAGE_MARGIN_MM) {
      doc.addPage();
      renderSpecimensPageHeader(doc, t, headerHeight);
      currentY = TECHNICAL_PAGE_TOP_MM + headerHeight + 4;
    }

    renderSpecimenRow(doc, row, currentY, rowIndex % 2 === 0);
    currentY += rowHeight;
    rowIndex += 1;
  }
}

function renderSpecimensPageHeader(
  doc: jsPDF,
  t: TFunction,
  headerHeight: number,
): void {
  renderDocumentTitle(doc, sanitizePdfText(t("specimensPageTitle")));

  const headers = [
    t("number"),
    t("code"),
    t("depthM_table"),
    t("diameterSampleMm"),
    t("diameterApparatusMm"),
    t("dateTime"),
    t("sampleCondition"),
    t("apparatusType"),
    t("wallMethod"),
  ];

  const columnXs = getSpecimenColumnXs();
  const columnWidths = getSpecimenColumnWidths();

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(
    PAGE_MARGIN_MM,
    TECHNICAL_PAGE_TOP_MM,
    CONTENT_WIDTH_MM,
    headerHeight,
    1.5,
    1.5,
    "FD",
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(SPECIMEN_HEADER_FONT_SIZE);
  doc.setTextColor(15, 23, 42);

  headers.forEach((header, index) => {
    const lines = doc.splitTextToSize(
      sanitizePdfText(header),
      columnWidths[index] - 1,
    ) as Array<string>;
    const textBlockHeight =
      lines.length * SPECIMEN_HEADER_LINE_HEIGHT_MM;
    const startY =
      TECHNICAL_PAGE_TOP_MM +
      Math.max(
        4.8,
        (headerHeight - textBlockHeight) / 2 + SPECIMEN_HEADER_LINE_HEIGHT_MM - 0.4,
      );

    doc.text(lines, columnXs[index] + columnWidths[index] / 2, startY, {
      align: "center",
      baseline: "middle",
    });
  });
}

function getSpecimenColumnXs(): Array<number> {
  return [
    PAGE_MARGIN_MM + 2,
    PAGE_MARGIN_MM + 12,
    PAGE_MARGIN_MM + 26,
    PAGE_MARGIN_MM + 49,
    PAGE_MARGIN_MM + 65,
    PAGE_MARGIN_MM + 81,
    PAGE_MARGIN_MM + 105,
    PAGE_MARGIN_MM + 126,
    PAGE_MARGIN_MM + 149,
  ];
}

function getSpecimenColumnWidths(): Array<number> {
  return [8, 12, 21, 14, 14, 22, 19, 21, 35];
}

function getSpecimenHeaderHeight(
  doc: jsPDF,
  t: TFunction,
): number {
  const headers = [
    t("number"),
    t("code"),
    t("depthM_table"),
    t("diameterSampleMm"),
    t("diameterApparatusMm"),
    t("dateTime"),
    t("sampleCondition"),
    t("apparatusType"),
    t("wallMethod"),
  ];
  const widths = getSpecimenColumnWidths();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(SPECIMEN_HEADER_FONT_SIZE);

  const maxLineCount = headers.reduce((highest, header, index) => {
    const lines = doc.splitTextToSize(
      sanitizePdfText(header),
      widths[index] - 1,
    ) as Array<string>;

    return Math.max(highest, lines.length);
  }, 1);

  return Math.max(
    SPECIMEN_HEADER_HEIGHT_MM,
    maxLineCount * SPECIMEN_HEADER_LINE_HEIGHT_MM + 4.5,
  );
}

function measureSpecimenRowHeight(doc: jsPDF, row: Array<string>): number {
  const widths = getSpecimenColumnWidths();
  const lineCounts = row.map((value, index) => {
    const lines = doc.splitTextToSize(
      sanitizePdfText(value),
      widths[index],
    ) as Array<string>;

    return Math.max(lines.length, 1);
  });

  return Math.max(...lineCounts) * 3.6 + 2.4;
}

function renderSpecimenRow(
  doc: jsPDF,
  row: Array<string>,
  y: number,
  isStriped: boolean,
): void {
  const widths = getSpecimenColumnWidths();
  const xPositions = getSpecimenColumnXs();
  const rowHeight = measureSpecimenRowHeight(doc, row);

  if (isStriped) {
    doc.setFillColor(248, 250, 252);
    doc.rect(PAGE_MARGIN_MM, y - 3.4, CONTENT_WIDTH_MM, rowHeight, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.1);
  doc.setTextColor(17, 24, 39);

  row.forEach((value, index) => {
    const lines = doc.splitTextToSize(
      sanitizePdfText(value),
      widths[index],
    ) as Array<string>;

    doc.text(lines, xPositions[index], y);
  });
}

function renderTechnicalInformationPages(
  doc: jsPDF,
  data: ExportableGefData,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
): void {
  const sections = normalizeTechnicalSections(
    getHeaderSectionsForData(data, t, language),
  );
  let column = 0;
  let currentY = TECHNICAL_PAGE_TOP_MM;

  renderTechnicalPageTitle(doc, t);

  for (const section of sections) {
    const sectionHeight = measureTechnicalSectionHeight(
      doc,
      section.title,
      section.items,
      TECHNICAL_COLUMN_WIDTH_MM,
    );

    if (currentY + sectionHeight > PAGE_HEIGHT_MM - PAGE_MARGIN_MM) {
      if (column === 0) {
        column = 1;
        currentY = TECHNICAL_PAGE_TOP_MM;
      } else {
        doc.addPage();
        renderTechnicalPageTitle(doc, t);
        column = 0;
        currentY = TECHNICAL_PAGE_TOP_MM;
      }
    }

    const x =
      PAGE_MARGIN_MM + column * (TECHNICAL_COLUMN_WIDTH_MM + TECHNICAL_COLUMN_GAP_MM);
    currentY = renderTechnicalSection(
      doc,
      section.title,
      section.items,
      x,
      currentY,
      TECHNICAL_COLUMN_WIDTH_MM,
    );

    currentY += SECTION_GAP_MM;
  }
}

function getHeaderSectionsForData(
  data: ExportableGefData,
  t: TFunction,
  language: string,
): Array<HeaderSection> {
  switch (data.fileType) {
    case "BORE":
      return getBoreHeaderSections(data, t, language);
    case "CPT":
      return getCptHeaderSections(data, t, language);
    case "DISS":
      return getDissHeaderSections(data, t, language);
  }
}

function normalizeTechnicalSections(
  sections: Array<HeaderSection>,
): Array<{ title: string; items: Array<SummaryItem> }> {
  return sections
    .map((section) => ({
      title: sanitizePdfText(section.title),
      items: section.items
        .map((item) => ({
          label: sanitizePdfText(String(item.label)),
          value: sanitizePdfText(renderValue(item.value)),
        }))
        .filter((item) => item.value.length > 0),
    }))
    .filter((section) => section.items.length > 0);
}

function renderDocumentTitle(doc: jsPDF, title: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, PAGE_MARGIN_MM, PAGE_MARGIN_MM);
}

function renderTechnicalPageTitle(
  doc: jsPDF,
  t: (key: string) => string,
): void {
  renderDocumentTitle(doc, sanitizePdfText(t("technicalDetails")));
}

function measureTechnicalSectionHeight(
  doc: jsPDF,
  title: string,
  items: Array<SummaryItem>,
  width: number,
): number {
  void title;
  let totalHeight = 10;
  const labelWidth = 32;
  const valueWidth = width - labelWidth - 6;

  for (const item of items) {
    const labelLines = doc.splitTextToSize(item.label, labelWidth) as Array<string>;
    const valueLines = doc.splitTextToSize(item.value, valueWidth) as Array<string>;
    totalHeight +=
      Math.max(labelLines.length, valueLines.length) * ROW_LINE_HEIGHT_MM + 1.5;
  }

  return totalHeight + 5;
}

function renderTechnicalSection(
  doc: jsPDF,
  title: string,
  items: Array<SummaryItem>,
  x: number,
  startY: number,
  width: number,
): number {
  let currentY = startY;
  const labelWidth = 32;
  const valueWidth = width - labelWidth - 6;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(x, currentY, width, 7, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(title), x + 3, currentY + 4.5);
  currentY += 11;

  for (const item of items) {
    const labelLines = doc.splitTextToSize(item.label, labelWidth) as Array<string>;
    const valueLines = doc.splitTextToSize(item.value, valueWidth) as Array<string>;
    const rowHeight =
      Math.max(labelLines.length, valueLines.length) * ROW_LINE_HEIGHT_MM;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(labelLines, x, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(17, 24, 39);
    doc.text(valueLines, x + labelWidth + 3, currentY);

    currentY += rowHeight + 1.5;
  }

  return currentY;
}

function renderValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }

  return reactNodeToText(value as ReactNode);
}

function reactNodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node
      .map((child) => reactNodeToText(child))
      .filter(Boolean)
      .join(" ");
  }

  if (!isValidElement(node)) {
    return String(node);
  }

  const props = node.props as { children?: ReactNode };
  const childTexts = Children.toArray(props.children)
    .map((child) => reactNodeToText(child))
    .filter(Boolean);
  const typeName = typeof node.type === "string" ? node.type : "";

  switch (typeName) {
    case "br":
      return "\n";
    case "tr":
      return childTexts.join(" | ");
    case "thead":
    case "tbody":
    case "table":
      return childTexts.join("\n");
    default:
      return childTexts.join(" ");
  }
}

function formatSpecimenTooltip(
  specimen: BoreSpecimen,
  language: "nl" | "en",
): string {
  const parts = [
    `Monster ${specimen.specimenNumber}${specimen.monstercode ? ` (${specimen.monstercode})` : ""}`,
    `${specimen.depthTop} - ${specimen.depthBottom} m`,
  ];

  const decodedParts = [
    formatSpecimenCode(
      specimen.geroerdOngeroerd,
      SPECIMEN_CODES.geroerd,
      language,
    ),
    formatSpecimenCode(
      specimen.monstersteekapparaat,
      SPECIMEN_CODES.monstersteekapparaat,
      language,
    ),
    formatSpecimenCode(
      specimen.monstermethode,
      SPECIMEN_CODES.monstermethode,
      language,
    ),
  ].filter(Boolean);

  if (decodedParts.length > 0) {
    parts.push(decodedParts.join(", "));
  }

  return parts.join(" | ");
}

function getPdfTranslationHelpers(): {
  language: string;
  t: TFunction;
} {
  const language = i18next.language || "nl";
  return {
    language,
    t: i18next.getFixedT(language),
  };
}

function stripGefExtension(filename: string): string {
  return filename.replace(/\.gef$/i, "");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown error";
}

async function appendPdfDebugLog(
  scope: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!window.desktopApi?.appendDebugLog) {
    return;
  }

  try {
    await window.desktopApi.appendDebugLog({
      scope,
      ...payload,
    });
  } catch (error) {
    console.error("Failed to write PDF debug log.", error);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function sanitizePdfText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[â€“â€”]/g, "-")
    .replace(/±/g, "+/-")
    .replace(/Â±/g, "+/-")
    .replace(/[•]/g, "-")
    .replace(/[â€¢]/g, "-")
    .replace(/[√]/g, "sqrt")
    .replace(/[âˆš]/g, "sqrt")
    .trim();
}

function hexToRgb(color: string): { r: number; g: number; b: number } {
  const normalized = color.replace("#", "").trim();
  const sixDigit =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  const value = Number.parseInt(sixDigit, 16);

  if (Number.isNaN(value)) {
    return { r: 148, g: 163, b: 184 };
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}


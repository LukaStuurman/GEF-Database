import type {
  GefData,
  GefFileType,
  ProcessedMetadata,
  WGS84Coords,
} from "@bedrock-engineer/gef-parser";
import {
  COORDINATE_SYSTEMS,
  HEIGHT_SYSTEMS,
  convertToWGS84,
} from "@bedrock-engineer/gef-parser";

export type IndexedGefFileSource = "database" | "dataset";

export interface DesktopGefIndexFields {
  fileType: GefFileType | null;
  projectId: string | null;
  testId: string | null;
  companyName: string | null;
  testDate: string | null;
  startDate: string | null;
  startTime: string | null;
  fileDate: string | null;
  finalDepth: number | null;
  childCount: number;
  lastScan: number | null;
  coordinateSystemCode: string | null;
  originalX: number | null;
  originalY: number | null;
  heightSystemCode: string | null;
  surfaceElevation: number | null;
  parentReference: string | null;
  parentValue: number | null;
  parentUnit: string | null;
  boringDate: string | null;
  placeName: string | null;
  drillingCompany: string | null;
}

export interface DesktopIndexedDatasetFile extends DesktopGefIndexFields {
  name: string;
  backupFileName: string;
  size: number | null;
  modifiedTimeMs: number | null;
}

export interface DesktopIndexedStoredFile extends DesktopGefIndexFields {
  name: string;
  storedFileName: string;
}

interface IndexedCoordinateSystem {
  code: string;
  name: string;
  nameEn: string;
  epsg: string | null;
}

interface IndexedHeightSystem {
  code: string;
  name: string;
  nameEn: string;
  epsg: string | null;
}

type CoordinateSystemCode = keyof typeof COORDINATE_SYSTEMS;

const COORDINATE_SYSTEM_CODE_ALIASES: Partial<
  Record<string, CoordinateSystemCode>
> = {
  "4326": "00001",
  "28992": "31000",
  "31370": "32000",
};

export interface IndexedGefFile extends DesktopGefIndexFields {
  filename: string;
  source: IndexedGefFileSource;
  coordinateSystem: IndexedCoordinateSystem | null;
  heightSystem: IndexedHeightSystem | null;
  wgs84: WGS84Coords | null;
  wgs84Error: string | null;
  datasetReference?: DesktopIndexedDatasetFile;
  storedFileName?: string;
}

function resolveIndexedFileType(fields: DesktopGefIndexFields): GefFileType {
  if (fields.fileType) {
    return fields.fileType;
  }

  const normalizedProjectId = fields.projectId?.trim().toUpperCase() ?? "";

  if (
    fields.parentReference ||
    fields.parentValue !== null ||
    fields.parentUnit
  ) {
    return "DISS";
  }

  if (fields.boringDate || fields.placeName || fields.drillingCompany) {
    return "BORE";
  }

  if (
    fields.childCount > 0 || normalizedProjectId.startsWith("CPT")
  ) {
    return "CPT";
  }

  if (
    normalizedProjectId.includes("BOOR") ||
    normalizedProjectId.includes("BORING") ||
    normalizedProjectId.includes("BORE")
  ) {
    return "BORE";
  }

  return "CPT";
}

function getCoordinateSystemDefinition(
  coordinateSystemCode: string | null,
): {
  code: string;
  canonicalCode: CoordinateSystemCode;
  definition: (typeof COORDINATE_SYSTEMS)[CoordinateSystemCode];
} | null {
  if (!coordinateSystemCode) {
    return null;
  }

  const canonicalCode = (
    COORDINATE_SYSTEMS[
      coordinateSystemCode as CoordinateSystemCode
    ]
      ? coordinateSystemCode
      : COORDINATE_SYSTEM_CODE_ALIASES[coordinateSystemCode]
  ) as CoordinateSystemCode | undefined;

  if (!canonicalCode) {
    return null;
  }

  const definition = COORDINATE_SYSTEMS[canonicalCode];

  if (!definition) {
    return null;
  }

  return {
    code: coordinateSystemCode,
    canonicalCode,
    definition,
  };
}

function createCoordinateSystem(
  coordinateSystemCode: string | null,
): IndexedGefFile["coordinateSystem"] {
  const coordinateSystem = getCoordinateSystemDefinition(coordinateSystemCode);

  if (!coordinateSystem) {
    return null;
  }

  return {
    code: coordinateSystem.code,
    name: coordinateSystem.definition.name,
    nameEn: coordinateSystem.definition.nameEn,
    epsg: coordinateSystem.definition.epsg,
  };
}

function createHeightSystem(
  heightSystemCode: string | null,
): IndexedGefFile["heightSystem"] {
  if (!heightSystemCode) {
    return null;
  }

  const heightSystem =
    HEIGHT_SYSTEMS[heightSystemCode as keyof typeof HEIGHT_SYSTEMS];

  if (!heightSystem) {
    return null;
  }

  return {
    code: heightSystemCode,
    name: heightSystem.name,
    nameEn: heightSystem.nameEn,
    epsg: heightSystem.epsg,
  };
}

function createWgs84(
  coordinateSystemCode: string | null,
  originalX: number | null,
  originalY: number | null,
): { wgs84: WGS84Coords | null; wgs84Error: string | null } {
  if (!coordinateSystemCode || originalX === null || originalY === null) {
    return {
      wgs84: null,
      wgs84Error: null,
    };
  }

  const coordinateSystem = getCoordinateSystemDefinition(coordinateSystemCode);

  if (!coordinateSystem) {
    return {
      wgs84: null,
      wgs84Error: `Unknown coordinate system code: ${coordinateSystemCode}`,
    };
  }

  const result = convertToWGS84({
    coordinateSystem: coordinateSystem.canonicalCode as Parameters<
      typeof convertToWGS84
    >[0]["coordinateSystem"],
    x: originalX,
    y: originalY,
  });

  if (!result.success) {
    return {
      wgs84: null,
      wgs84Error: result.error,
    };
  }

  return {
    wgs84: result.coords,
    wgs84Error: null,
  };
}

function getTestDateFromProcessedMetadata(
  fileType: GefFileType,
  processed: ProcessedMetadata,
): string | null {
  if (fileType === "BORE") {
    return processed.texts.datumBoring?.value ?? null;
  }

  return processed.startDate ?? null;
}

function getFinalDepthFromGefData(data: GefData): number | null {
  switch (data.fileType) {
    case "BORE":
      return data.processed.measurements.einddiepte?.value ?? null;
    case "CPT":
      return data.processed.measurements.endDepthOfPenetrationTest?.value ?? null;
    case "DISS":
      return data.parent?.value ?? null;
  }
}

function createIndexedGefFileFromFields(
  filename: string,
  source: IndexedGefFileSource,
  fields: DesktopGefIndexFields,
  options: {
    backupFileName?: string;
    size?: number | null;
    modifiedTimeMs?: number | null;
    storedFileName?: string;
  } = {},
): IndexedGefFile {
  const normalizedFields = {
    ...fields,
    fileType: resolveIndexedFileType(fields),
  };
  const { wgs84, wgs84Error } = createWgs84(
    normalizedFields.coordinateSystemCode,
    normalizedFields.originalX,
    normalizedFields.originalY,
  );

  return {
    filename,
    source,
    ...normalizedFields,
    coordinateSystem: createCoordinateSystem(normalizedFields.coordinateSystemCode),
    heightSystem: createHeightSystem(normalizedFields.heightSystemCode),
    wgs84,
    wgs84Error,
    datasetReference: options.backupFileName
      ? {
          name: filename,
          backupFileName: options.backupFileName,
          size: options.size ?? null,
          modifiedTimeMs: options.modifiedTimeMs ?? null,
          ...normalizedFields,
        }
      : undefined,
    storedFileName: options.storedFileName,
  };
}

export function createIndexedGefFileFromGefData(
  filename: string,
  data: GefData,
  source: IndexedGefFileSource,
  options: {
    backupFileName?: string;
    size?: number | null;
    modifiedTimeMs?: number | null;
    storedFileName?: string;
  } = {},
): IndexedGefFile {
  return createIndexedGefFileFromFields(
    filename,
    source,
    {
      fileType: data.fileType,
      projectId: data.processed.projectId ?? null,
      testId: data.processed.testId ?? null,
      companyName: data.processed.companyName ?? null,
      testDate: getTestDateFromProcessedMetadata(data.fileType, data.processed),
      startDate: data.processed.startDate ?? null,
      startTime: data.processed.startTime ?? null,
      fileDate: data.processed.fileDate ?? null,
      finalDepth: getFinalDepthFromGefData(data),
      childCount: data.fileType === "CPT" ? data.children.length : 0,
      lastScan: data.fileType === "CPT" ? (data.headers.LASTSCAN ?? null) : null,
      coordinateSystemCode: data.processed.coordinateSystem?.code ?? null,
      originalX: data.processed.originalX ?? null,
      originalY: data.processed.originalY ?? null,
      heightSystemCode: data.processed.heightSystem?.code ?? null,
      surfaceElevation: data.processed.surfaceElevation ?? null,
      parentReference:
        data.fileType === "DISS" ? (data.parent?.reference ?? null) : null,
      parentValue: data.fileType === "DISS" ? (data.parent?.value ?? null) : null,
      parentUnit: data.fileType === "DISS" ? (data.parent?.unit ?? null) : null,
      boringDate:
        data.fileType === "BORE"
          ? (data.processed.texts.datumBoring?.value ?? null)
          : null,
      placeName:
        data.fileType === "BORE"
          ? (data.processed.texts.plaatsUitvoering?.value ?? null)
          : null,
      drillingCompany:
        data.fileType === "BORE"
          ? (data.processed.texts.boorfirma?.value ?? null)
          : null,
    },
    options,
  );
}

export function createIndexedGefFileFromDatasetEntry(
  entry: DesktopIndexedDatasetFile,
): IndexedGefFile {
  return createIndexedGefFileFromFields(entry.name, "dataset", entry, {
    backupFileName: entry.backupFileName,
    size: entry.size,
    modifiedTimeMs: entry.modifiedTimeMs,
  });
}

export function createIndexedGefFileFromStoredEntry(
  entry: DesktopIndexedStoredFile,
): IndexedGefFile {
  return createIndexedGefFileFromFields(entry.name, "database", entry, {
    storedFileName: entry.storedFileName,
  });
}


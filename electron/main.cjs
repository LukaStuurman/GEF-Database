const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { StringDecoder } = require("node:string_decoder");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
} = require("electron");

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);
const DESKTOP_INDEX_VERSION = 3;
const DATASET_PROGRESS_CHANNEL = "desktop:dataset-progress";
const GEF_INDEX_CHUNK_SIZE_BYTES = 16 * 1024;
const GEF_INDEX_MAX_HEADER_BYTES = 256 * 1024;
const DATASET_DIRECTORY_CONCURRENCY = 12;
const DATASET_STAT_CONCURRENCY = 48;
const DATASET_INDEX_CONCURRENCY = 12;
const PORTABLE_DATA_DIRECTORY_NAME = "GEF Viewer Desktop Data";
const PORTABLE_STATE_PATH_PREFIX = "__PORTABLE__:";
const DEFAULT_BACKUP_DIRECTORY = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "Techbase",
  "Techbase - Documenten",
  "Tekenkamer",
  "Techbase WES",
  "2. Handleidingen",
  "1. Sleufloze techniek",
  "Sleufloze techniek data",
  "Sonderingen",
  "GEF",
);
const OPENSTREETMAP_APP_REFERER = "https://github.com/LukaStuurman/GEF-Database";
const OPENSTREETMAP_APP_USER_AGENT =
  "GEF Viewer Desktop/1.3.0 (+https://github.com/LukaStuurman/GEF-Database)";
const BORE_TYPE_HINT_KEYWORDS = [
  "bore",
  "boor",
  "boring",
  "nen5104",
  "monster",
  "laag",
  "grond",
  "zandmediaan",
  "silt",
  "veen",
];
const CPT_TYPE_HINT_KEYWORDS = [
  "cpt",
  "diss",
  "cone",
  "conus",
  "sonder",
  "sondeer",
  "penetrat",
  "wrijving",
  "waterspanning",
  "porien",
  "helling",
  "temperatuur",
];

function getPortableExecutableDirectory() {
  const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;

  if (typeof portableDirectory === "string" && portableDirectory.trim()) {
    return portableDirectory;
  }

  const portableExecutableFile = process.env.PORTABLE_EXECUTABLE_FILE;

  if (
    typeof portableExecutableFile === "string" &&
    portableExecutableFile.trim()
  ) {
    return path.dirname(portableExecutableFile);
  }

  return null;
}

const portableExecutableDirectory = !isDev
  ? getPortableExecutableDirectory()
  : null;
const portableDataDirectory = portableExecutableDirectory
  ? path.join(portableExecutableDirectory, PORTABLE_DATA_DIRECTORY_NAME)
  : null;

function configurePortableAppPaths() {
  if (!portableDataDirectory) {
    return;
  }

  try {
    app.setPath("userData", portableDataDirectory);
    app.setPath(
      "sessionData",
      path.join(portableDataDirectory, "session-data"),
    );
  } catch (error) {
    console.error("Failed to configure portable app paths", error);
  }
}

function isSubPathOf(basePath, candidatePath) {
  if (!basePath || !candidatePath) {
    return false;
  }

  const relativePath = path.relative(
    path.resolve(basePath),
    path.resolve(candidatePath),
  );

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function serializePortableStatePath(directoryPath) {
  if (
    !portableExecutableDirectory ||
    typeof directoryPath !== "string" ||
    !directoryPath.trim() ||
    !isSubPathOf(portableExecutableDirectory, directoryPath)
  ) {
    return directoryPath;
  }

  const relativePath =
    path.relative(
      path.resolve(portableExecutableDirectory),
      path.resolve(directoryPath),
    ) || ".";

  return `${PORTABLE_STATE_PATH_PREFIX}${relativePath}`;
}

function deserializePortableStatePath(directoryPath) {
  if (
    !portableExecutableDirectory ||
    typeof directoryPath !== "string" ||
    !directoryPath.startsWith(PORTABLE_STATE_PATH_PREFIX)
  ) {
    return directoryPath;
  }

  const relativePath = directoryPath.slice(PORTABLE_STATE_PATH_PREFIX.length);
  return path.resolve(portableExecutableDirectory, relativePath);
}

function includesKeyword(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function registerOpenStreetMapRequestHeaders() {
  const defaultSession = session.defaultSession;

  if (!defaultSession) {
    return;
  }

  defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        "https://tile.openstreetmap.org/*",
        "https://*.tile.openstreetmap.org/*",
        "https://nominatim.openstreetmap.org/*",
      ],
    },
    (details, callback) => {
      const requestHeaders = {
        ...details.requestHeaders,
        Referer: OPENSTREETMAP_APP_REFERER,
        "User-Agent": OPENSTREETMAP_APP_USER_AGENT,
      };

      callback({ requestHeaders });
    },
  );
}

if (app) {
  configurePortableAppPaths();
}

function isInternalUrl(url) {
  if (isDev && devServerUrl) {
    return url.startsWith(devServerUrl);
  }

  return url.startsWith("file://");
}

function getStateFilePath() {
  return path.join(app.getPath("userData"), "desktop-state.json");
}

function getDefaultDatabaseDirectoryPath() {
  return path.join(app.getPath("userData"), "database");
}

function getDefaultBackupDirectoryPath() {
  const configuredDirectory = process.env.GEF_VIEWER_DEFAULT_BACKUP_DIRECTORY;

  return typeof configuredDirectory === "string" && configuredDirectory.trim()
    ? path.resolve(configuredDirectory)
    : DEFAULT_BACKUP_DIRECTORY;
}

function getDatabaseDirectoryPath(state) {
  if (state && typeof state.databaseDirectory === "string") {
    return state.databaseDirectory;
  }

  return getDefaultDatabaseDirectoryPath();
}

function getDebugLogFilePath() {
  return path.join(app.getPath("userData"), "desktop-debug.log");
}

function createEmptyIndexFields() {
  return {
    fileType: null,
    projectId: null,
    testId: null,
    companyName: null,
    testDate: null,
    startDate: null,
    startTime: null,
    fileDate: null,
    finalDepth: null,
    childCount: 0,
    lastScan: null,
    coordinateSystemCode: null,
    originalX: null,
    originalY: null,
    heightSystemCode: null,
    surfaceElevation: null,
    parentReference: null,
    parentValue: null,
    parentUnit: null,
    boringDate: null,
    placeName: null,
    drillingCompany: null,
  };
}

function isGefFileType(value) {
  return value === "BORE" || value === "CPT" || value === "DISS";
}

function resolveIndexedFileType(fields) {
  if (isGefFileType(fields?.fileType)) {
    return fields.fileType;
  }

  const normalizedProjectId =
    typeof fields?.projectId === "string"
      ? fields.projectId.trim().toUpperCase()
      : "";

  if (
    typeof fields?.parentReference === "string" &&
    fields.parentReference.trim()
  ) {
    return "DISS";
  }

  if (
    typeof fields?.parentValue === "number" &&
    Number.isFinite(fields.parentValue)
  ) {
    return "DISS";
  }

  if (typeof fields?.parentUnit === "string" && fields.parentUnit.trim()) {
    return "DISS";
  }

  if (
    (typeof fields?.boringDate === "string" && fields.boringDate.trim()) ||
    (typeof fields?.placeName === "string" && fields.placeName.trim()) ||
    (typeof fields?.drillingCompany === "string" &&
      fields.drillingCompany.trim())
  ) {
    return "BORE";
  }

  if (
    (typeof fields?.childCount === "number" && fields.childCount > 0) ||
    normalizedProjectId.startsWith("CPT")
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

function toNullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeIndexFields(file) {
  const normalizedFields = {
    ...createEmptyIndexFields(),
    fileType: isGefFileType(file?.fileType) ? file.fileType : null,
    projectId: toNullableString(file?.projectId),
    testId: toNullableString(file?.testId),
    companyName: toNullableString(file?.companyName),
    testDate: toNullableString(file?.testDate),
    startDate: toNullableString(file?.startDate),
    startTime: toNullableString(file?.startTime),
    fileDate: toNullableString(file?.fileDate),
    finalDepth: toNullableNumber(file?.finalDepth),
    childCount:
      typeof file?.childCount === "number" && Number.isFinite(file.childCount)
        ? Math.max(0, Math.trunc(file.childCount))
        : 0,
    lastScan: toNullableNumber(file?.lastScan),
    coordinateSystemCode: toNullableString(file?.coordinateSystemCode),
    originalX: toNullableNumber(file?.originalX),
    originalY: toNullableNumber(file?.originalY),
    heightSystemCode: toNullableString(file?.heightSystemCode),
    surfaceElevation: toNullableNumber(file?.surfaceElevation),
    parentReference: toNullableString(file?.parentReference),
    parentValue: toNullableNumber(file?.parentValue),
    parentUnit: toNullableString(file?.parentUnit),
    boringDate: toNullableString(file?.boringDate),
    placeName: toNullableString(file?.placeName),
    drillingCompany: toNullableString(file?.drillingCompany),
  };

  normalizedFields.fileType = resolveIndexedFileType(normalizedFields);

  return normalizedFields;
}

function normalizeDatabaseFileEntry(file) {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.storedFileName !== "string"
  ) {
    return null;
  }

  return {
    name: file.name,
    storedFileName: file.storedFileName,
    indexVersion:
      typeof file.indexVersion === "number" ? file.indexVersion : null,
    ...normalizeIndexFields(file),
  };
}

function normalizeRememberedFileEntry(file) {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.backupFileName !== "string"
  ) {
    return null;
  }

  return {
    name: file.name,
    backupFileName: file.backupFileName,
    size: typeof file.size === "number" ? file.size : null,
    modifiedTimeMs:
      typeof file.modifiedTimeMs === "number" ? file.modifiedTimeMs : null,
    indexVersion:
      typeof file.indexVersion === "number" ? file.indexVersion : null,
    ...normalizeIndexFields(file),
  };
}

function hasIndexedEntry(entry) {
  return entry?.indexVersion === DESKTOP_INDEX_VERSION;
}

function stripIndexVersion(entry) {
  const { indexVersion, ...rest } = entry;
  return rest;
}

function stripOuterQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function splitGefHeaderValues(rawValue) {
  const trimmedValue = rawValue.replace(/;\s*$/, "").trim();
  const values = [];
  let current = "";
  let quoteChar = null;

  for (const char of trimmedValue) {
    if ((char === '"' || char === "'") && (!quoteChar || quoteChar === char)) {
      quoteChar = quoteChar === char ? null : char;
      current += char;
      continue;
    }

    if (char === "," && !quoteChar) {
      values.push(stripOuterQuotes(current.trim()));
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || trimmedValue.endsWith(",")) {
    values.push(stripOuterQuotes(current.trim()));
  }

  return values;
}

function formatGefDateValues(values) {
  const year = Number(values[0]);
  const month = Number(values[1]);
  const day = Number(values[2]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function formatGefTimeValues(values) {
  const hour = Number(values[0]);
  const minute = Number(values[1]);
  const second =
    values[2] !== undefined && values[2] !== "" ? Number(values[2]) : null;

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const parts = [
    String(hour).padStart(2, "0"),
    String(minute).padStart(2, "0"),
  ];

  if (second !== null && Number.isFinite(second)) {
    parts.push(String(second).padStart(2, "0"));
  }

  return parts.join(":");
}

function parseNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value.trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function detectGefFileType(reportCode) {
  if (typeof reportCode !== "string" || !reportCode.trim()) {
    return null;
  }

  const lowercaseReportCode = reportCode.trim().toLowerCase();

  if (lowercaseReportCode.includes("diss")) {
    return "DISS";
  }

  if (
    lowercaseReportCode.includes("bore") ||
    lowercaseReportCode.includes("boor")
  ) {
    return "BORE";
  }

  if (includesKeyword(lowercaseReportCode, CPT_TYPE_HINT_KEYWORDS)) {
    return "CPT";
  }

  return null;
}

async function readGefHeaderText(filePath) {
  const handle = await fs.open(filePath, "r");
  const decoder = new StringDecoder("utf8");
  let totalRead = 0;
  let headerText = "";

  try {
    while (totalRead < GEF_INDEX_MAX_HEADER_BYTES) {
      const chunkSize = Math.min(
        GEF_INDEX_CHUNK_SIZE_BYTES,
        GEF_INDEX_MAX_HEADER_BYTES - totalRead,
      );
      const buffer = Buffer.allocUnsafe(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, totalRead);

      if (bytesRead === 0) {
        break;
      }

      headerText += decoder.write(buffer.subarray(0, bytesRead));
      totalRead += bytesRead;

      if (/#EOH\s*=/i.test(headerText)) {
        break;
      }
    }

    headerText += decoder.end();
  } finally {
    await handle.close();
  }

  return headerText;
}

function extractGefHeaderTextFromContent(content) {
  const endOfHeaderMatch = /#EOH\s*=/i.exec(content);

  if (!endOfHeaderMatch) {
    return content.slice(0, GEF_INDEX_MAX_HEADER_BYTES);
  }

  const lineEndIndex = content.indexOf("\n", endOfHeaderMatch.index);

  if (lineEndIndex === -1) {
    return content.slice(
      0,
      endOfHeaderMatch.index + endOfHeaderMatch[0].length,
    );
  }

  return content.slice(0, lineEndIndex + 1);
}

function parseGefIndexFieldsFromHeaderText(headerText) {
  const fields = createEmptyIndexFields();
  const normalizedLines = headerText.replace(/\r/g, "").split("\n");
  let boreHintCount = 0;
  let cptHintCount = 0;
  let hasSpecimenData = false;

  for (const rawLine of normalizedLines) {
    const line = rawLine.trim();

    if (!line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(1, separatorIndex).trim().toUpperCase();
    const values = splitGefHeaderValues(line.slice(separatorIndex + 1));

    if (key === "EOH") {
      break;
    }

    switch (key) {
      case "REPORTCODE":
        fields.fileType =
          detectGefFileType(values.join(", ")) ?? fields.fileType;
        break;
      case "PROCEDURECODE":
        fields.fileType =
          detectGefFileType(values.join(", ")) ?? fields.fileType;
        break;
      case "PROJECTID":
        fields.projectId = toNullableString(values.join(", "));
        break;
      case "TESTID":
        fields.testId = toNullableString(values.join(", "));
        break;
      case "COMPANYID":
        fields.companyName = toNullableString(values[0]);
        break;
      case "STARTDATE":
        fields.startDate = formatGefDateValues(values);
        break;
      case "STARTTIME":
        fields.startTime = formatGefTimeValues(values);
        break;
      case "FILEDATE":
        fields.fileDate = formatGefDateValues(values);
        break;
      case "MEASUREMENTCODE": {
        const measurementCode = values.join(" ").toLowerCase();

        if (measurementCode.includes("nen5104")) {
          boreHintCount += 3;
        }

        if (includesKeyword(measurementCode, BORE_TYPE_HINT_KEYWORDS)) {
          boreHintCount += 2;
        }

        if (includesKeyword(measurementCode, CPT_TYPE_HINT_KEYWORDS)) {
          cptHintCount += 2;
        }
        break;
      }
      case "XYID":
        fields.coordinateSystemCode = toNullableString(values[0]);
        fields.originalX = parseNumericValue(values[1]);
        fields.originalY = parseNumericValue(values[2]);
        break;
      case "ZID":
        fields.heightSystemCode = toNullableString(values[0]);
        fields.surfaceElevation = parseNumericValue(values[1]);
        break;
      case "LASTSCAN":
        fields.lastScan = parseNumericValue(values[0]);
        break;
      case "CHILD":
        fields.childCount += 1;
        break;
      case "PARENT":
        fields.parentReference = toNullableString(values[0]);
        fields.parentValue = parseNumericValue(values[1]);
        fields.parentUnit = toNullableString(values[2]);
        break;
      case "COLUMNINFO": {
        const columnInfoText = values.join(" ").toLowerCase();

        if (includesKeyword(columnInfoText, BORE_TYPE_HINT_KEYWORDS)) {
          boreHintCount += 1;
        }

        if (includesKeyword(columnInfoText, CPT_TYPE_HINT_KEYWORDS)) {
          cptHintCount += 1;
        }
        break;
      }
      case "MEASUREMENTVAR": {
        const id = Number(values[0]);

        if (id === 16) {
          fields.finalDepth = parseNumericValue(values[1]);
        }
        break;
      }
      case "MEASUREMENTTEXT": {
        const id = Number(values[0]);
        const value = toNullableString(values.slice(1).join(", "));

        if (id === 16) {
          fields.boringDate = value;
        } else if (id === 3) {
          fields.placeName = value;
        } else if (id === 13) {
          fields.drillingCompany = value;
        }
        break;
      }
      case "SPECIMENVAR":
      case "SPECIMENTEXT":
        hasSpecimenData = true;
        boreHintCount += 2;
        break;
      default:
        break;
    }
  }

  if (!fields.fileType) {
    if (
      fields.parentReference ||
      fields.parentValue !== null ||
      fields.parentUnit
    ) {
      fields.fileType = "DISS";
    } else if (
      hasSpecimenData ||
      boreHintCount >= 2 ||
      boreHintCount > cptHintCount
    ) {
      fields.fileType = "BORE";
    } else if (cptHintCount >= 2 || fields.childCount > 0) {
      fields.fileType = "CPT";
    }
  }

  fields.fileType = resolveIndexedFileType(fields);

  if (!fields.testDate) {
    fields.testDate =
      fields.fileType === "BORE"
        ? (fields.boringDate ?? fields.startDate ?? fields.fileDate)
        : (fields.startDate ?? fields.fileDate);
  }

  if (
    fields.fileType === "DISS" &&
    fields.finalDepth === null &&
    fields.parentValue !== null
  ) {
    fields.finalDepth = fields.parentValue;
  }

  return fields;
}

async function indexGefFileAtPath(filePath) {
  const headerText = await readGefHeaderText(filePath);
  return parseGefIndexFieldsFromHeaderText(headerText);
}

function indexGefContent(content) {
  return parseGefIndexFieldsFromHeaderText(
    extractGefHeaderTextFromContent(content),
  );
}

function createDefaultState() {
  return {
    databaseDirectory: null,
    backupDirectory: getDefaultBackupDirectoryPath(),
    databaseFiles: [],
    rememberedFiles: [],
    boreStyle: null,
  };
}

async function readDesktopState() {
  try {
    const raw = await fs.readFile(getStateFilePath(), "utf8");
    const parsed = JSON.parse(raw);

    return {
      databaseDirectory:
        typeof parsed.databaseDirectory === "string"
          ? deserializePortableStatePath(parsed.databaseDirectory)
          : null,
      backupDirectory:
        typeof parsed.backupDirectory === "string"
          ? deserializePortableStatePath(parsed.backupDirectory)
          : null,
      databaseFiles: Array.isArray(parsed.databaseFiles)
        ? parsed.databaseFiles
            .map((file) => normalizeDatabaseFileEntry(file))
            .filter(Boolean)
        : [],
      rememberedFiles: Array.isArray(parsed.rememberedFiles)
        ? parsed.rememberedFiles
            .map((file) => normalizeRememberedFileEntry(file))
            .filter(Boolean)
        : [],
      boreStyle: parsed.boreStyle ?? null,
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return createDefaultState();
    }

    console.error("Failed to read desktop state", error);
    return createDefaultState();
  }
}

async function writeDesktopState(state) {
  const persistedState = {
    ...state,
    databaseDirectory:
      typeof state.databaseDirectory === "string"
        ? serializePortableStatePath(state.databaseDirectory)
        : state.databaseDirectory,
    backupDirectory:
      typeof state.backupDirectory === "string"
        ? serializePortableStatePath(state.backupDirectory)
        : state.backupDirectory,
  };

  const stateFilePath = getStateFilePath();
  const temporaryStateFilePath = `${stateFilePath}.${process.pid}.${crypto.randomUUID()}.tmp`;

  await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
  await fs.writeFile(
    temporaryStateFilePath,
    JSON.stringify(persistedState),
    "utf8",
  );
  await fs.rename(temporaryStateFilePath, stateFilePath);
}

async function appendDebugLog(scope, payload) {
  const line = [
    `[${new Date().toISOString()}]`,
    scope,
    typeof payload === "string" ? payload : JSON.stringify(payload),
  ].join(" ");

  await fs.mkdir(path.dirname(getDebugLogFilePath()), { recursive: true });
  await fs.appendFile(getDebugLogFilePath(), `${line}\n`, "utf8");
}

async function ensureDirectoryExists(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function copyDatabaseFilesToDirectory(state, nextDirectoryPath) {
  const currentDirectoryPath = getDatabaseDirectoryPath(state);

  if (
    path.resolve(currentDirectoryPath) === path.resolve(nextDirectoryPath) ||
    state.databaseFiles.length === 0
  ) {
    await ensureDirectoryExists(nextDirectoryPath);
    return;
  }

  await ensureDirectoryExists(nextDirectoryPath);

  for (const file of state.databaseFiles) {
    const sourcePath = path.join(currentDirectoryPath, file.storedFileName);
    const targetPath = path.join(nextDirectoryPath, file.storedFileName);

    if (path.resolve(sourcePath) === path.resolve(targetPath)) {
      continue;
    }

    try {
      await fs.copyFile(sourcePath, targetPath);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        await appendDebugLog("database-copy-missing", {
          filename: file.name,
          sourcePath,
          targetPath,
        });
        continue;
      }

      throw error;
    }
  }
}

function createDatabaseStoredFileName(filename) {
  const extension = path.extname(filename) || ".gef";
  const normalizedName = filename.replace(/[\\/]+/g, "__");
  const nameWithoutExtension = normalizedName.slice(
    0,
    normalizedName.length - extension.length,
  );
  const sanitizedBase = nameWithoutExtension
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
  const hash = crypto
    .createHash("sha1")
    .update(filename)
    .digest("hex")
    .slice(0, 10);

  return `${sanitizedBase || "gef-file"}-${hash}${extension}`;
}

async function ensureIndexedDatabaseEntries(state) {
  let didChange = false;
  const databaseFiles = [];

  for (const file of state.databaseFiles) {
    if (hasIndexedEntry(file)) {
      databaseFiles.push(file);
      continue;
    }

    const storedFilePath = path.join(
      getDatabaseDirectoryPath(state),
      file.storedFileName,
    );

    try {
      const indexedFields = await indexGefFileAtPath(storedFilePath);
      databaseFiles.push({
        ...file,
        indexVersion: DESKTOP_INDEX_VERSION,
        ...indexedFields,
      });
      didChange = true;
    } catch (error) {
      await appendDebugLog("database-index-error", {
        filename: file.name,
        storedFilePath,
        message: error instanceof Error ? error.message : String(error),
      });
      databaseFiles.push(file);
    }
  }

  return didChange
    ? {
        didChange,
        state: {
          ...state,
          databaseFiles,
        },
      }
    : {
        didChange,
        state,
      };
}

async function storeFilesInDatabase(state, files) {
  await ensureDirectoryExists(getDatabaseDirectoryPath(state));

  const databaseFiles = [...state.databaseFiles];

  for (const file of files) {
    const storedFileName = createDatabaseStoredFileName(file.name);
    const storedFilePath = path.join(
      getDatabaseDirectoryPath(state),
      storedFileName,
    );

    await fs.writeFile(storedFilePath, file.content, "utf8");
    const indexedFields = indexGefContent(file.content);

    const existingIndex = databaseFiles.findIndex(
      (entry) => entry.name === file.name,
    );
    const nextEntry = {
      name: file.name,
      storedFileName,
      indexVersion: DESKTOP_INDEX_VERSION,
      ...indexedFields,
    };

    if (existingIndex >= 0) {
      databaseFiles[existingIndex] = nextEntry;
    } else {
      databaseFiles.push(nextEntry);
    }
  }

  return {
    ...state,
    databaseFiles,
  };
}

async function readFilesFromReferences(directoryPath, references, keyName) {
  if (!directoryPath) {
    return [];
  }

  const files = await Promise.all(
    references.map(async (file) => {
      try {
        const filePath = path.join(directoryPath, file[keyName]);
        const content = await fs.readFile(filePath, "utf8");

        return {
          name: file.name,
          content,
        };
      } catch (error) {
        console.error(`Failed to restore ${file.name}`, error);
        return null;
      }
    }),
  );

  return files.filter(Boolean);
}

async function readDatabaseFiles(state) {
  return readFilesFromReferences(
    getDatabaseDirectoryPath(state),
    state.databaseFiles,
    "storedFileName",
  );
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= items.length) {
          return;
        }

        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

async function listGefFilesFromDirectory(directoryPath) {
  if (!directoryPath) {
    return [];
  }

  try {
    const directoryQueue = [{ fullPath: directoryPath, relativePrefix: "" }];
    const fileCandidates = [];

    while (directoryQueue.length > 0) {
      const directoryBatch = directoryQueue.splice(
        0,
        DATASET_DIRECTORY_CONCURRENCY,
      );
      const directoryEntries = await Promise.all(
        directoryBatch.map(async (directory) => ({
          directory,
          entries: await fs.readdir(directory.fullPath, {
            withFileTypes: true,
          }),
        })),
      );

      for (const { directory, entries } of directoryEntries) {
        for (const entry of entries) {
          const fullPath = path.join(directory.fullPath, entry.name);
          const relativePath = directory.relativePrefix
            ? path.join(directory.relativePrefix, entry.name)
            : entry.name;

          if (entry.isDirectory()) {
            directoryQueue.push({ fullPath, relativePrefix: relativePath });
          } else if (entry.isFile() && /\.gef$/i.test(entry.name)) {
            fileCandidates.push({ fullPath, relativePath });
          }
        }
      }
    }

    const collected = await mapWithConcurrency(
      fileCandidates,
      DATASET_STAT_CONCURRENCY,
      async ({ fullPath, relativePath }) => {
        const stats = await fs.stat(fullPath);

        return {
          name: relativePath.split(path.sep).join(" - "),
          backupFileName: relativePath,
          size: stats.size,
          modifiedTimeMs: Math.trunc(stats.mtimeMs),
        };
      },
    );

    return collected.sort((left, right) =>
      left.backupFileName.localeCompare(right.backupFileName),
    );
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    console.error("Failed to scan GEF files from directory", error);
    return [];
  }
}

function isSameRememberedFile(left, right) {
  return Boolean(
    right &&
      left.name === right.name &&
      left.backupFileName === right.backupFileName &&
      left.size === right.size &&
      left.modifiedTimeMs === right.modifiedTimeMs,
  );
}

function sendDatasetProgress(sender, progress) {
  if (
    !sender ||
    (typeof sender.isDestroyed === "function" && sender.isDestroyed())
  ) {
    return;
  }

  sender.send(DATASET_PROGRESS_CHANNEL, progress);
}

async function buildIndexedDatasetFiles(state, sender) {
  sendDatasetProgress(sender, {
    phase: "scanning",
    processed: 0,
    total: 0,
  });

  const listedFiles = await listGefFilesFromDirectory(state.backupDirectory);
  const previousByPath = new Map(
    state.rememberedFiles.map((file) => [file.backupFileName, file]),
  );
  let processed = 0;

  sendDatasetProgress(sender, {
    phase: "indexing",
    processed: 0,
    total: listedFiles.length,
  });

  const indexedFiles = await mapWithConcurrency(
    listedFiles,
    DATASET_INDEX_CONCURRENCY,
    async (file) => {
      const previousEntry = previousByPath.get(file.backupFileName);
      let indexedFile;

      if (
        hasIndexedEntry(previousEntry) &&
        isSameRememberedFile(file, previousEntry)
      ) {
        indexedFile = previousEntry;
      } else {
        const filePath = path.join(state.backupDirectory, file.backupFileName);

        try {
          indexedFile = {
            ...file,
            indexVersion: DESKTOP_INDEX_VERSION,
            ...(await indexGefFileAtPath(filePath)),
          };
        } catch (error) {
          await appendDebugLog("dataset-index-error", {
            filename: file.name,
            filePath,
            message: error instanceof Error ? error.message : String(error),
          });
          indexedFile = {
            ...file,
            indexVersion: null,
            ...createEmptyIndexFields(),
          };
        }
      }

      processed += 1;

      if (processed === listedFiles.length || processed % 50 === 0) {
        sendDatasetProgress(sender, {
          phase: "indexing",
          processed,
          total: listedFiles.length,
        });
      }

      return indexedFile;
    },
  );

  return indexedFiles;
}

async function removeFilesFromDatabase(state, filenames) {
  for (const filename of filenames) {
    const entry = state.databaseFiles.find((file) => file.name === filename);

    if (!entry) {
      continue;
    }

    try {
      await fs.unlink(
        path.join(getDatabaseDirectoryPath(state), entry.storedFileName),
      );
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        console.error(`Failed to remove stored file ${filename}`, error);
      }
    }
  }
}

function sanitizeGefExportFilename(filename) {
  const extension = path.extname(filename) || ".gef";
  const baseName = path.basename(filename, path.extname(filename));
  const sanitizedBaseName = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();

  return `${sanitizedBaseName || "gef-bestand"}${extension}`;
}

async function doesPathExist(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function allocateGefExportPath(directoryPath, filename, usedPaths) {
  const safeFilename = sanitizeGefExportFilename(filename);
  const extension = path.extname(safeFilename);
  const baseName = path.basename(safeFilename, extension);
  let counter = 1;

  while (true) {
    const candidateName =
      counter === 1 ? safeFilename : `${baseName} (${counter})${extension}`;
    const candidatePath = path.join(directoryPath, candidateName);
    const normalizedCandidatePath = candidatePath.toLocaleLowerCase();

    if (
      !usedPaths.has(normalizedCandidatePath) &&
      !(await doesPathExist(candidatePath))
    ) {
      usedPaths.add(normalizedCandidatePath);
      return candidatePath;
    }

    counter += 1;
  }
}

function getSelectedGefExportSources(state, filenames) {
  const datasetByName = new Map(
    state.rememberedFiles.map((file) => [file.name, file]),
  );
  const databaseByName = new Map(
    state.databaseFiles.map((file) => [file.name, file]),
  );

  return filenames
    .map((filename) => {
      const datasetFile = datasetByName.get(filename);

      if (datasetFile && state.backupDirectory) {
        const sourcePath = path.resolve(
          state.backupDirectory,
          datasetFile.backupFileName,
        );

        if (!isSubPathOf(state.backupDirectory, sourcePath)) {
          return null;
        }

        return {
          filename: path.basename(datasetFile.backupFileName),
          sourcePath,
        };
      }

      const databaseFile = databaseByName.get(filename);

      if (!databaseFile) {
        return null;
      }

      const databaseDirectory = getDatabaseDirectoryPath(state);
      const sourcePath = path.resolve(
        databaseDirectory,
        databaseFile.storedFileName,
      );

      if (!isSubPathOf(databaseDirectory, sourcePath)) {
        return null;
      }

      return {
        filename: databaseFile.name,
        sourcePath,
      };
    })
    .filter(Boolean);
}

function registerDesktopIpc() {
  ipcMain.handle("desktop:get-state", async () => {
    const indexedStateResult = await ensureIndexedDatabaseEntries(
      await readDesktopState(),
    );
    const state = indexedStateResult.state;

    if (indexedStateResult.didChange) {
      await writeDesktopState(state);
    }

    return {
      databaseDirectory: getDatabaseDirectoryPath(state),
      backupDirectory: state.backupDirectory,
      storedFiles: state.databaseFiles.map((file) => stripIndexVersion(file)),
      databaseCount: state.databaseFiles.length,
      backupCount: state.rememberedFiles.length,
      boreStyle: state.boreStyle,
      rememberedFiles: state.rememberedFiles.map((file) =>
        stripIndexVersion(file),
      ),
    };
  });

  ipcMain.handle("desktop:read-stored-files", async (_event, filenames) => {
    const state = await readDesktopState();
    const requestedNames = Array.isArray(filenames)
      ? filenames.filter((filename) => typeof filename === "string")
      : [];
    const references = state.databaseFiles.filter((file) =>
      requestedNames.includes(file.name),
    );

    return readFilesFromReferences(
      getDatabaseDirectoryPath(state),
      references,
      "storedFileName",
    );
  });

  ipcMain.handle("desktop:choose-database-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("desktop:set-database-directory", async (_event, payload) => {
    const storedState = await readDesktopState();
    const nextDirectory =
      payload && typeof payload.directory === "string"
        ? payload.directory
        : getDefaultDatabaseDirectoryPath();

    await copyDatabaseFilesToDirectory(storedState, nextDirectory);

    const updatedState = {
      ...storedState,
      databaseDirectory: nextDirectory,
    };

    await writeDesktopState(updatedState);
    await appendDebugLog("database-directory-updated", {
      databaseDirectory: nextDirectory,
      databaseCount: updatedState.databaseFiles.length,
    });

    return {
      databaseDirectory: getDatabaseDirectoryPath(updatedState),
      backupDirectory: updatedState.backupDirectory,
      databaseCount: updatedState.databaseFiles.length,
      backupCount: updatedState.rememberedFiles.length,
    };
  });

  ipcMain.handle("desktop:list-backup-files", async (event) => {
    const state = await readDesktopState();

    if (!state.backupDirectory) {
      return [];
    }

    const startedAt = Date.now();
    const indexedFiles = await buildIndexedDatasetFiles(state, event.sender);
    const latestState = await readDesktopState();

    if (latestState.backupDirectory === state.backupDirectory) {
      await writeDesktopState({
        ...latestState,
        rememberedFiles: indexedFiles,
      });
    }

    const files = indexedFiles.map((file) => stripIndexVersion(file));
    await appendDebugLog("dataset-list", {
      backupDirectory: state.backupDirectory,
      count: files.length,
      durationMs: Date.now() - startedAt,
    });
    return files;
  });

  ipcMain.handle("desktop:read-backup-file", async (_event, reference) => {
    const state = await readDesktopState();

    if (
      !state.backupDirectory ||
      !reference ||
      typeof reference.name !== "string" ||
      typeof reference.backupFileName !== "string"
    ) {
      return null;
    }

    const backupFilePath = path.resolve(
      state.backupDirectory,
      reference.backupFileName,
    );

    if (!isSubPathOf(state.backupDirectory, backupFilePath)) {
      throw new Error("Ongeldige verwijzing naar een GEF-bestand.");
    }

    const content = await fs.readFile(backupFilePath, "utf8");

    return {
      name: reference.name,
      content,
    };
  });

  ipcMain.handle("desktop:update-backup-index", async (_event, references) => {
    const state = await readDesktopState();
    const rememberedFiles = Array.isArray(references)
      ? references
          .map((file) => normalizeRememberedFileEntry(file))
          .filter(Boolean)
          .map((file) => ({
            ...file,
            indexVersion: DESKTOP_INDEX_VERSION,
          }))
      : [];
    const updatedState = {
      ...state,
      rememberedFiles,
    };

    await writeDesktopState(updatedState);
    return {
      backupCount: updatedState.rememberedFiles.length,
    };
  });

  ipcMain.handle("desktop:choose-backup-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("desktop:set-backup-directory", async (_event, payload) => {
    const storedState = await readDesktopState();
    const requestedDirectory =
      payload && typeof payload.directory === "string"
        ? payload.directory.trim()
        : "";

    if (!requestedDirectory) {
      throw new Error("Geen geldige datasetmap gekozen.");
    }

    const nextDirectory = path.resolve(requestedDirectory);
    const directoryStats = await fs.stat(nextDirectory);

    if (!directoryStats.isDirectory()) {
      throw new Error("De gekozen datasetlocatie is geen map.");
    }

    const hasChanged =
      path.resolve(storedState.backupDirectory ?? "") !== nextDirectory;
    const updatedState = {
      ...storedState,
      backupDirectory: nextDirectory,
      rememberedFiles: hasChanged ? [] : storedState.rememberedFiles,
    };
    await writeDesktopState(updatedState);

    return {
      databaseDirectory: getDatabaseDirectoryPath(updatedState),
      backupDirectory: updatedState.backupDirectory,
      databaseCount: updatedState.databaseFiles.length,
      backupCount: updatedState.rememberedFiles.length,
    };
  });

  ipcMain.handle("desktop:store-files", async (_event, files) => {
    const state = await readDesktopState();
    const updatedState = await storeFilesInDatabase(state, files);

    await writeDesktopState(updatedState);

    return {
      databaseDirectory: getDatabaseDirectoryPath(updatedState),
      backupDirectory: updatedState.backupDirectory,
      databaseCount: updatedState.databaseFiles.length,
      backupCount: updatedState.rememberedFiles.length,
    };
  });

  ipcMain.handle("desktop:remove-stored-file", async (_event, filename) => {
    const state = await readDesktopState();
    await removeFilesFromDatabase(state, [filename]);
    const updatedState = {
      ...state,
      databaseFiles: state.databaseFiles.filter(
        (file) => file.name !== filename,
      ),
      rememberedFiles: state.rememberedFiles.filter(
        (file) => file.name !== filename,
      ),
    };

    await writeDesktopState(updatedState);

    return {
      databaseDirectory: getDatabaseDirectoryPath(updatedState),
      databaseCount: updatedState.databaseFiles.length,
      backupCount: updatedState.rememberedFiles.length,
    };
  });

  ipcMain.handle("desktop:clear-stored-files", async () => {
    const state = await readDesktopState();
    await removeFilesFromDatabase(
      state,
      state.databaseFiles.map((file) => file.name),
    );
    await writeDesktopState({
      ...state,
      databaseFiles: [],
      rememberedFiles: [],
    });

    return {
      databaseDirectory: getDatabaseDirectoryPath(state),
      databaseCount: 0,
      backupCount: 0,
    };
  });

  ipcMain.handle("desktop:save-bore-style", async (_event, boreStyle) => {
    const state = await readDesktopState();
    const updatedState = {
      ...state,
      boreStyle,
    };

    await writeDesktopState(updatedState);
    return boreStyle;
  });

  ipcMain.handle(
    "desktop:search-openstreetmap",
    async (_event, { query, language }) => {
      const searchParams = new URLSearchParams({
        format: "jsonv2",
        limit: "6",
        q: query,
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": language || "nl,en",
            Referer: OPENSTREETMAP_APP_REFERER,
            "User-Agent": OPENSTREETMAP_APP_USER_AGENT,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`OpenStreetMap search failed with ${response.status}`);
      }

      const results = await response.json();

      return Array.isArray(results)
        ? results.map((result) => ({
            placeId: result.place_id,
            displayName: result.display_name,
            lat: Number(result.lat),
            lon: Number(result.lon),
          }))
        : [];
    },
  );

  ipcMain.handle(
    "desktop:export-selected-gef-files",
    async (_event, filenames) => {
      const requestedFilenames = Array.isArray(filenames)
        ? Array.from(
            new Set(
              filenames.filter((filename) => typeof filename === "string"),
            ),
          )
        : [];

      if (requestedFilenames.length === 0) {
        return { savedCount: 0, failedCount: 0, directory: null };
      }

      const state = await readDesktopState();
      const sources = getSelectedGefExportSources(state, requestedFilenames);
      const result = await dialog.showOpenDialog({
        defaultPath: app.getPath("downloads"),
        properties: ["openDirectory", "createDirectory"],
        title: "Kies een map voor de geselecteerde GEF-bestanden",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { savedCount: 0, failedCount: 0, directory: null };
      }

      const [directory] = result.filePaths;
      const usedPaths = new Set();
      let savedCount = 0;
      let failedCount = requestedFilenames.length - sources.length;

      for (const source of sources) {
        try {
          const destinationPath = await allocateGefExportPath(
            directory,
            source.filename,
            usedPaths,
          );
          await fs.copyFile(source.sourcePath, destinationPath);
          savedCount += 1;
        } catch (error) {
          failedCount += 1;
          await appendDebugLog("gef-export:error", {
            filename: source.filename,
            sourcePath: source.sourcePath,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await appendDebugLog("gef-export:completed", {
        requestedCount: requestedFilenames.length,
        savedCount,
        failedCount,
        directory,
      });

      return { savedCount, failedCount, directory };
    },
  );

  ipcMain.handle("desktop:save-pdf-exports", async (_event, files) => {
    try {
      if (!Array.isArray(files) || files.length === 0) {
        return { savedCount: 0, directory: null };
      }

      await appendDebugLog("pdf-save:start", {
        count: files.length,
        filenames: files.map((file) => file.filename),
      });

      const downloadsPath = app.getPath("downloads");

      if (files.length === 1) {
        const [file] = files;
        const result = await dialog.showSaveDialog({
          defaultPath: path.join(downloadsPath, file.filename),
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (result.canceled || !result.filePath) {
          await appendDebugLog("pdf-save:cancelled", { mode: "single" });
          return { savedCount: 0, directory: null };
        }

        await fs.writeFile(
          result.filePath,
          Buffer.from(file.dataBase64, "base64"),
        );
        await appendDebugLog("pdf-save:completed", {
          savedCount: 1,
          directory: path.dirname(result.filePath),
        });

        return {
          savedCount: 1,
          directory: path.dirname(result.filePath),
        };
      }

      const result = await dialog.showOpenDialog({
        defaultPath: downloadsPath,
        properties: ["openDirectory", "createDirectory"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        await appendDebugLog("pdf-save:cancelled", { mode: "multiple" });
        return { savedCount: 0, directory: null };
      }

      const [directory] = result.filePaths;

      await Promise.all(
        files.map((file) =>
          fs.writeFile(
            path.join(directory, file.filename),
            Buffer.from(file.dataBase64, "base64"),
          ),
        ),
      );

      await appendDebugLog("pdf-save:completed", {
        savedCount: files.length,
        directory,
      });

      return {
        savedCount: files.length,
        directory,
      };
    } catch (error) {
      await appendDebugLog("pdf-save:error", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      throw error;
    }
  });

  ipcMain.handle("desktop:append-debug-log", async (_event, payload) => {
    await appendDebugLog(payload.scope ?? "renderer", payload);
    return true;
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f8fafc",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch(console.error);
    return;
  }

  mainWindow
    .loadFile(path.join(__dirname, "..", "dist", "index.html"))
    .catch(console.error);
}

if (app) {
  app.whenReady().then(() => {
    appendDebugLog("app:start", {
      version: app.getVersion(),
      isDev,
      userData: app.getPath("userData"),
      portableExecutableDirectory,
      portableDataDirectory,
    }).catch(console.error);
    registerOpenStreetMapRequestHeaders();
    registerDesktopIpc();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

module.exports.testing = {
  allocateGefExportPath,
  buildIndexedDatasetFiles,
  getSelectedGefExportSources,
  indexGefFileAtPath,
  listGefFilesFromDirectory,
  parseGefIndexFieldsFromHeaderText,
};


import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  FileDropItem,
  Selection,
  SortDescriptor,
} from "react-aria-components";
import {
  Button,
  Cell,
  Column,
  DropZone,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { GefFileType } from "@bedrock-engineer/gef-parser";
import type { IndexedGefFile } from "~/util/gef-index";

interface SortIndicatorProps {
  column: string;
  sortDescriptor: SortDescriptor;
}

function SortIndicator({ column, sortDescriptor }: SortIndicatorProps) {
  const isActive = sortDescriptor.column === column;

  const Icon =
    sortDescriptor.direction === "ascending" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Icon size={14} className={`inline ml-1 ${isActive ? "" : "opacity-0"}`} />
  );
}

interface FileRow {
  id: string;
  filename: string;
  location: string | null;
  testDate: string | null;
  type: GefFileType | null;
  finalDepth: number | null;
  searchText: string;
}

interface FileTableProps {
  indexedGefFiles: Record<string, IndexedGefFile>;
  selectedFileName: string;
  onSelectionChange: (filename: string) => void;
  onFileDrop: (files: Array<File>) => void;
  onFileRemove: (filename: string) => void;
}

const MAX_VISIBLE_FILE_ROWS = 500;

export function FileTable({
  indexedGefFiles,
  selectedFileName,
  onSelectionChange,
  onFileDrop,
  onFileRemove,
}: FileTableProps) {
  const { t } = useTranslation();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "filename",
    direction: "ascending",
  });
  const [filterQuery, setFilterQuery] = useState("");

  const rows: Array<FileRow> = useMemo(() => {
    return Object.values(indexedGefFiles).map((file) => {
      const location = file.placeName ?? file.projectId ?? file.testId;

      return {
        id: file.filename,
        filename: file.filename,
        location,
        testDate: file.testDate,
        type: file.fileType,
        finalDepth: file.finalDepth,
        searchText: [
          file.filename,
          file.datasetReference?.backupFileName,
          file.projectId,
          file.testId,
          file.companyName,
          file.placeName,
          file.drillingCompany,
          file.testDate,
          file.fileType,
          file.finalDepth,
          file.originalX,
          file.originalY,
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLocaleLowerCase(),
      };
    });
  }, [indexedGefFiles]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const column = sortDescriptor.column as keyof FileRow;
      const aVal = a[column];
      const bVal = b[column];

      // Handle null values
      if (aVal === null && bVal === null) {
        return 0;
      }
      if (aVal === null) {
        return 1;
      }
      if (bVal === null) {
        return -1;
      }

      let compare: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        compare = aVal - bVal;
      } else {
        compare = String(aVal).localeCompare(String(bVal));
      }

      return sortDescriptor.direction === "descending" ? -compare : compare;
    });
    return sorted;
  }, [rows, sortDescriptor]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = filterQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedRows;
    }

    return sortedRows.filter((row) => {
      return row.searchText.includes(normalizedQuery);
    });
  }, [filterQuery, sortedRows]);

  const visibleRows = useMemo(() => {
    if (filteredRows.length <= MAX_VISIBLE_FILE_ROWS) {
      return filteredRows;
    }

    const selectedIndex = filteredRows.findIndex(
      (row) => row.filename === selectedFileName,
    );

    if (selectedIndex >= MAX_VISIBLE_FILE_ROWS) {
      return [
        ...filteredRows.slice(0, MAX_VISIBLE_FILE_ROWS - 1),
        filteredRows[selectedIndex]!,
      ];
    }

    return filteredRows.slice(0, MAX_VISIBLE_FILE_ROWS);
  }, [filteredRows, selectedFileName]);

  const selectedKeys: Selection = useMemo(() => {
    return selectedFileName ? new Set([selectedFileName]) : new Set();
  }, [selectedFileName]);

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      return;
    }
    const selected = Array.from(keys)[0];
    if (typeof selected === "string") {
      onSelectionChange(selected);
    }
  };

  const handleDrop = async (e: { items: ReadonlyArray<{ kind: string }> }) => {
    const fileItems = e.items.filter(
      (item): item is FileDropItem => item.kind === "file",
    );
    const files = await Promise.all(fileItems.map((item) => item.getFile()));
    onFileDrop(files);
  };

  return (
    <DropZone
      onDrop={(event) => {
        handleDrop(event).catch((error: unknown) => {
          console.error(error);
        });
      }}
      className="file-table-dropzone"
    >
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

      {filteredRows.length > MAX_VISIBLE_FILE_ROWS ? (
        <div className="mb-2 text-xs text-gray-500">
          {t("showingLimitedFiles", {
            visible: visibleRows.length,
            total: filteredRows.length,
          })}
        </div>
      ) : null}

      <Table
        aria-label="Files"
        selectionMode="single"
        selectionBehavior="toggle"
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        className="max-h-[800px] w-full"
      >
        <TableHeader className="file-table-header">
          <Column
            id="filename"
            isRowHeader
            allowsSorting
            className="file-table-column"
          >
            {t("filename")}
            <SortIndicator column="filename" sortDescriptor={sortDescriptor} />
          </Column>
          <Column id="testDate" allowsSorting className="file-table-column">
            {t("testDate")}
            <SortIndicator column="testDate" sortDescriptor={sortDescriptor} />
          </Column>
          <Column id="location" allowsSorting className="file-table-column">
            {t("location")}
            <SortIndicator column="location" sortDescriptor={sortDescriptor} />
          </Column>
          <Column id="type" allowsSorting className="file-table-column">
            Type
            <SortIndicator column="type" sortDescriptor={sortDescriptor} />
          </Column>
          <Column id="finalDepth" allowsSorting className="file-table-column">
            {t("depthM_table")}
            <SortIndicator
              column="finalDepth"
              sortDescriptor={sortDescriptor}
            />
          </Column>
          <Column id="remove" className="file-table-column w-10">
            {/* Empty header for remove column */}
          </Column>
        </TableHeader>
        <TableBody
          items={visibleRows}
          renderEmptyState={() => (
            <div className="py-8 text-center text-gray-500">
              {rows.length > 0 ? t("noFilesMatchFilter") : t("dropFilesHere")}
            </div>
          )}
        >
          {(row) => (
            <Row id={row.id} className="file-table-row">
              <Cell className="file-table-cell">{row.filename}</Cell>
              <Cell className="file-table-cell">{row.testDate ?? "-"}</Cell>
              <Cell className="file-table-cell">{row.location ?? "-"}</Cell>
              <Cell className="file-table-cell">
                {row.type ? <TypeBadge>{row.type}</TypeBadge> : "-"}
              </Cell>
              <Cell
                className="file-table-cell"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {row.finalDepth ?? "-"}
              </Cell>
              <Cell className="file-table-cell">
                <Button
                  onPress={() => {
                    onFileRemove(row.filename);
                  }}
                  className="p-1 transition-colors hover:bg-red-200 rounded-sm text-gray-500 hover:text-red-700"
                  aria-label={t("removeFile")}
                >
                  <XIcon size={14} />
                </Button>
              </Cell>
            </Row>
          )}
        </TableBody>
      </Table>
    </DropZone>
  );
}

const badgeClassNames = {
  BORE: "bg-orange-300 text-orange-800",
  CPT: "bg-blue-300 text-blue-800",
  DISS: "bg-green-300 text-green-800",
};

const TypeBadge = ({ children }: { children: GefFileType }) => (
  <div
    className={`p-0.5 rounded-sm w-fit text-xs ${badgeClassNames[children]}`}
  >
    {children}
  </div>
);


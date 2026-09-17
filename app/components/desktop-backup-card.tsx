import { FolderOpenIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Card, CardTitle } from "./card";

interface DesktopBackupCardProps {
  databaseDirectory: string | null;
  backupDirectory: string | null;
  databaseFileCount: number;
  backupFileCount: number;
  statusMessage: string | null;
  isRestoring: boolean;
  restoreProgress: {
    phase: "scanning" | "indexing";
    processed: number;
    total: number;
  } | null;
  onChooseDatabaseFolder: () => void;
  onChooseFolder: () => void;
  onRefreshFolder: () => void;
}

export function DesktopBackupCard({
  databaseDirectory,
  backupDirectory,
  databaseFileCount,
  backupFileCount,
  statusMessage,
  isRestoring,
  restoreProgress,
  onChooseDatabaseFolder,
  onChooseFolder,
  onRefreshFolder,
}: DesktopBackupCardProps) {
  const { t } = useTranslation();
  const restorePercentage =
    restoreProgress && restoreProgress.total > 0
      ? Math.round((restoreProgress.processed / restoreProgress.total) * 100)
      : 0;

  return (
    <Card className="mb-4">
      <CardTitle>{t("storageSettings")}</CardTitle>

      <p className="text-sm text-gray-600 mb-3">
        {t("localDatabaseDescription")}
      </p>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium text-gray-700">
            {t("localDatabase")}
          </span>
          <div className="text-gray-600 mt-1">
            {t("databaseFilesCount", { count: databaseFileCount })}
          </div>
          <div className="text-gray-600 break-all mt-1">
            {databaseDirectory ?? t("databaseFolderDefault")}
          </div>
        </div>

        <div>
          <span className="font-medium text-gray-700">{t("backupFolder")}</span>
          <div className="text-gray-600 break-all mt-1">
            {backupDirectory ?? t("backupNotConfigured")}
          </div>
        </div>

        <div className="text-gray-600">
          {t("backupFilesCount", { count: backupFileCount })}
        </div>

        {statusMessage ? (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-sm px-2 py-1">
            {statusMessage}
          </div>
        ) : null}

        {isRestoring ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCwIcon size={12} className="animate-spin" />
              {restoreProgress?.phase === "scanning"
                ? t("scanningDatasetFolder")
                : restoreProgress
                  ? t("restoringFilesProgress", {
                      processed: restoreProgress.processed,
                      total: restoreProgress.total,
                    })
                  : t("restoringFiles")}
            </div>

            {restoreProgress && restoreProgress.total > 0 ? (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${restorePercentage}%` }}
                  />
                </div>

                <div className="text-[11px] text-gray-500">
                  {restorePercentage}%
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <Button
          className="flex gap-2 items-center justify-center w-full p-2 border border-blue-300 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
          onPress={onChooseDatabaseFolder}
          isDisabled={isRestoring}
        >
          <FolderOpenIcon size={14} />
          {databaseDirectory
            ? t("changeDatabaseFolder")
            : t("chooseDatabaseFolder")}
        </Button>

        <Button
          className="flex gap-2 items-center justify-center w-full p-2 border border-blue-300 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
          onPress={onChooseFolder}
          isDisabled={isRestoring}
        >
          <FolderOpenIcon size={14} />
          {backupDirectory ? t("changeBackupFolder") : t("chooseBackupFolder")}
        </Button>

        <Button
          className="flex gap-2 items-center justify-center w-full p-2 border border-blue-300 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onPress={onRefreshFolder}
          isDisabled={!backupDirectory || isRestoring}
        >
          <RefreshCwIcon size={14} />
          {t("refreshDatasetFolder")}
        </Button>
      </div>
    </Card>
  );
}


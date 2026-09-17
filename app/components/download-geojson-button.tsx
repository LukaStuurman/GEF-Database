import type { Feature, FeatureCollection } from "geojson";
import { DownloadIcon } from "lucide-react";
import { Button } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { downloadFile } from "~/util/download";
import type { IndexedGefFile } from "~/util/gef-index";

function createGeoJSON(
  indexedGefFiles: Record<string, IndexedGefFile>,
): FeatureCollection {
  const features: Array<Feature> = Object.values(indexedGefFiles)
    .filter(
      (file): file is IndexedGefFile & { wgs84: NonNullable<IndexedGefFile["wgs84"]> } =>
        file.wgs84 !== null,
    )
    .map((file) => {
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [file.wgs84.lon, file.wgs84.lat],
        },
        properties: {
          filename: file.filename,
          fileType: file.fileType,
          projectId: file.projectId,
          testId: file.testId,
          companyName: file.companyName,
          startDate: file.startDate,
          startTime: file.startTime,
          surfaceElevation: file.surfaceElevation,
          heightSystem: file.heightSystem?.name,
          heightSystemEpsg: file.heightSystem?.epsg,
          coordinateSystem: file.coordinateSystem?.name,
          epsg: file.coordinateSystem?.epsg,
          easting: file.originalX,
          northing: file.originalY,
          finalDepth: file.finalDepth,
        },
      };
    });

  return {
    type: "FeatureCollection" as const,
    features,
  };
}

function downloadAsGeoJSON(indexedGefFiles: Record<string, IndexedGefFile>) {
  const geojson = createGeoJSON(indexedGefFiles);
  const geojsonString = JSON.stringify(geojson, null, 2);
  downloadFile(geojsonString, "gef-locations.geojson", "application/geo+json");
}

interface DownloadGeoJSONButtonProps {
  indexedGefFiles: Record<string, IndexedGefFile>;
}

export function DownloadGeoJSONButton({
  indexedGefFiles,
}: DownloadGeoJSONButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      className="button mt-2 ml-auto"
      onPress={() => {
        downloadAsGeoJSON(indexedGefFiles);
      }}
      isDisabled={Object.keys(indexedGefFiles).length === 0}
    >
      {t("downloadLocationsGeoJson")} <DownloadIcon size={14} />{" "}
    </Button>
  );
}


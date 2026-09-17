/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DownloadIcon, SearchIcon } from "lucide-react";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import type {
  Circle,
  CircleMarker,
  LatLngExpression,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
  Rectangle,
} from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { IndexedGefFile } from "~/util/gef-index";

interface GefMapProps {
  indexedGefFiles: Record<string, IndexedGefFile>;
  selectedFileName: string | null;
  selectedPdfFilenames: Array<string>;
  onMarkerClick: (filename: string) => void;
  onAddPdfSelection: (filenames: Array<string>) => void;
  onSetPdfSelection: (filenames: Array<string>) => void;
}

interface SearchResult {
  placeId: number;
  displayName: string;
  lat: number;
  lon: number;
}

interface NearbyLocation {
  file: IndexedGefFile & {
    wgs84: NonNullable<IndexedGefFile["wgs84"]>;
  };
  distanceKm: number;
}

interface DinoBoreholeLocation {
  dinoNumber: string;
  lat: number;
  lon: number;
  sampleProfileCount: number | null;
  distanceKm: number;
}

interface DinoGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  properties: Record<string, unknown> | null;
}

interface DinoGeoJsonResponse {
  type?: string;
  features?: Array<DinoGeoJsonFeature>;
  exceededTransferLimit?: boolean;
  error?: {
    code?: number;
    message?: string;
  };
}

const DEFAULT_CENTER: LatLngExpression = [52.1326, 5.2913];
const DEFAULT_ZOOM = 7;
const SELECTED_LOCATION_ZOOM = 15;
const MARKER_BATCH_SIZE = 300;
const NEARBY_LOCATION_RADIUS_KM = 10;
const MAX_VISIBLE_NEARBY_LOCATIONS = 12;
const MAX_VISIBLE_DINO_LOCATIONS = 20;
const DINO_QUERY_PAGE_SIZE = 2000;
const DINO_MAX_RESULTS = 10000;
const DINO_MAPSERVER_QUERY_URL =
  "https://www.broloket.nl/standalone/rest/services/uitgifteloket_gdn/lks_gbo_rd_v1/MapServer/0/query";
const DINO_PROFILE_CSV_DOWNLOAD_BASE_URL =
  "https://www.dinoloket.nl/uitgifteloket/api/brh/sampledescription/csv";
const DINO_PROFILE_GEF_DOWNLOAD_BASE_URL =
  "https://www.dinoloket.nl/uitgifteloket/api/brh/gef";
const searchResultIcon = L.icon({
  iconRetinaUrl: markerIcon2xUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

export function GefMap({
  indexedGefFiles,
  selectedFileName,
  selectedPdfFilenames,
  onMarkerClick,
  onAddPdfSelection,
  onSetPdfSelection,
}: GefMapProps) {
  if (typeof window === "undefined") {
    throw Error("GefMap should only render on the client.");
  }

  const { t, i18n } = useTranslation();
  const isDutch = i18n.language.toLowerCase().startsWith("nl");
  const dinoText = useMemo(
    () =>
      isDutch
        ? {
            enable: "DINOloket boormonsters tonen",
            disable: "DINOloket boormonsters verbergen",
            hint: "Klik op de kaart om het middelpunt te kiezen. DINOloket-boormonsterprofielen binnen de ingestelde straal worden geladen.",
            loading: "DINOloket boormonsters laden…",
            error: "DINOloket boormonsters konden niet worden geladen.",
            empty: "Geen openbare DINOloket-boormonsterprofielen gevonden binnen deze straal.",
            count: (count: number) => `${count} DINOloket-boormonster${count === 1 ? "" : "s"} binnen de straal`,
            truncated: `Er zijn meer dan ${DINO_MAX_RESULTS.toLocaleString("nl-NL")} resultaten. Verklein de straal om alle locaties te zien.`,
            more: "Meer locaties zijn op de kaart zichtbaar.",
            csv: "CSV",
            gef: "GEF",
            source: "DINO / DINOloket",
            samples: "profielen",
          }
        : {
            enable: "Show DINOloket bore samples",
            disable: "Hide DINOloket bore samples",
            hint: "Click the map to choose the centre. DINOloket sample-description locations inside the configured radius will be loaded.",
            loading: "Loading DINOloket bore samples…",
            error: "DINOloket bore samples could not be loaded.",
            empty: "No public DINOloket sample-description locations were found inside this radius.",
            count: (count: number) => `${count} DINOloket bore sample${count === 1 ? "" : "s"} inside the radius`,
            truncated: `There are more than ${DINO_MAX_RESULTS.toLocaleString("en-US")} results. Reduce the radius to see every location.`,
            more: "More locations are visible on the map.",
            csv: "CSV",
            gef: "GEF",
            source: "DINO / DINOloket",
            samples: "profiles",
          },
    [isDutch],
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const dinoMarkersRef = useRef<Map<string, CircleMarker>>(new Map());
  const dinoRequestIdRef = useRef(0);
  const previousLocationCountRef = useRef(0);
  const searchMarkerRef = useRef<Marker | null>(null);
  const selectionRectangleRef = useRef<Rectangle | null>(null);
  const radiusSelectionCircleRef = useRef<Circle | null>(null);
  const radiusSelectionCenterRef = useRef<L.LatLng | null>(null);
  const selectionStartRef = useRef<{
    latLng: L.LatLng;
    point: { x: number; y: number };
  } | null>(null);
  const isDrawingSelectionRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<SearchResult>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focusedSearchResult, setFocusedSearchResult] =
    useState<SearchResult | null>(null);
  const [isRectangleSelectionEnabled, setIsRectangleSelectionEnabled] =
    useState(false);
  const [isRadiusSelectionEnabled, setIsRadiusSelectionEnabled] =
    useState(false);
  const [selectionRadiusKm, setSelectionRadiusKm] = useState(1);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [showDinoBoreholes, setShowDinoBoreholes] = useState(false);
  const [dinoBoreholes, setDinoBoreholes] = useState<Array<DinoBoreholeLocation>>(
    [],
  );
  const [isLoadingDinoBoreholes, setIsLoadingDinoBoreholes] = useState(false);
  const [dinoBoreholeError, setDinoBoreholeError] = useState<string | null>(null);
  const [dinoResultsTruncated, setDinoResultsTruncated] = useState(false);

  const locations = useMemo(
    () =>
      Object.values(indexedGefFiles).filter(
        (
          file,
        ): file is IndexedGefFile & {
          wgs84: NonNullable<IndexedGefFile["wgs84"]>;
        } => file.wgs84 !== null,
      ),
    [indexedGefFiles],
  );
  const locationLookup = useMemo(
    () => new Map(locations.map((location) => [location.filename, location])),
    [locations],
  );
  const selectedPdfSet = useMemo(
    () => new Set(selectedPdfFilenames),
    [selectedPdfFilenames],
  );
  const nearbyLocations = useMemo<Array<NearbyLocation>>(() => {
    if (!focusedSearchResult) {
      return [];
    }

    return locations
      .map((file) => ({
        file,
        distanceKm: calculateDistanceKm(
          focusedSearchResult.lat,
          focusedSearchResult.lon,
          file.wgs84.lat,
          file.wgs84.lon,
        ),
      }))
      .filter((location) => location.distanceKm <= NEARBY_LOCATION_RADIUS_KM)
      .sort((left, right) => left.distanceKm - right.distanceKm);
  }, [focusedSearchResult, locations]);
  const addPdfSelection = useEffectEvent((filenames: Array<string>) => {
    onAddPdfSelection(filenames);
  });
  const setPdfSelection = useEffectEvent((filenames: Array<string>) => {
    onSetPdfSelection(filenames);
  });
  const loadDinoBoreholes = useEffectEvent(async (center: L.LatLng) => {
    if (!showDinoBoreholes) {
      return;
    }

    const requestId = dinoRequestIdRef.current + 1;
    dinoRequestIdRef.current = requestId;
    setIsLoadingDinoBoreholes(true);
    setDinoBoreholeError(null);
    setDinoResultsTruncated(false);

    try {
      const result = await fetchDinoBoreholesWithinRadius(
        center.lat,
        center.lng,
        selectionRadiusKm,
      );

      if (dinoRequestIdRef.current !== requestId) {
        return;
      }

      setDinoBoreholes(result.locations);
      setDinoResultsTruncated(result.truncated);
    } catch (error) {
      console.error("Failed to load DINOloket boreholes", error);

      if (dinoRequestIdRef.current !== requestId) {
        return;
      }

      setDinoBoreholes([]);
      setDinoBoreholeError(dinoText.error);
    } finally {
      if (dinoRequestIdRef.current === requestId) {
        setIsLoadingDinoBoreholes(false);
      }
    }
  });
  const applyRadiusSelection = useEffectEvent((center: L.LatLng) => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    radiusSelectionCenterRef.current = center;
    radiusSelectionCircleRef.current?.remove();
    radiusSelectionCircleRef.current = L.circle(center, {
      radius: selectionRadiusKm * 1000,
      color: "#7c3aed",
      weight: 2,
      fillColor: "#a78bfa",
      fillOpacity: 0.14,
      interactive: false,
    }).addTo(map);

    const selectedFilenames = locations
      .filter(
        (location) =>
          calculateDistanceKm(
            center.lat,
            center.lng,
            location.wgs84.lat,
            location.wgs84.lon,
          ) <= selectionRadiusKm,
      )
      .map((location) => location.filename)
      .sort((left, right) => left.localeCompare(right));

    setPdfSelection(selectedFilenames);
    setSelectionMessage(
      selectedFilenames.length > 0
        ? t("mapRadiusSelectAdded", {
            count: selectedFilenames.length,
            radius: selectionRadiusKm.toLocaleString(i18n.language, {
              maximumFractionDigits: 2,
            }),
          })
        : showDinoBoreholes
          ? dinoText.hint
          : t("mapRadiusSelectNone", {
              radius: selectionRadiusKm.toLocaleString(i18n.language, {
                maximumFractionDigits: 2,
              }),
            }),
    );

    if (showDinoBoreholes) {
      void loadDinoBoreholes(center);
    }
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      dinoMarkersRef.current.forEach((marker) => marker.remove());
      dinoMarkersRef.current.clear();
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
      selectionRectangleRef.current?.remove();
      selectionRectangleRef.current = null;
      radiusSelectionCircleRef.current?.remove();
      radiusSelectionCircleRef.current = null;
      radiusSelectionCenterRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    let timeoutId: number | null = null;
    let isCancelled = false;

    if (locations.length === 0) {
      if (previousLocationCountRef.current > 0) {
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current.clear();
      }

      previousLocationCountRef.current = 0;
      if (!showDinoBoreholes) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
      return;
    }

    const nextFilenames = new Set(
      locations.map((location) => location.filename),
    );

    markersRef.current.forEach((marker, filename) => {
      if (nextFilenames.has(filename)) {
        return;
      }

      marker.remove();
      markersRef.current.delete(filename);
    });

    const locationsToAdd = locations.filter(
      (location) => !markersRef.current.has(location.filename),
    );

    const addMarker = (
      loc: IndexedGefFile & {
        wgs84: NonNullable<IndexedGefFile["wgs84"]>;
      },
    ) => {
      const color =
        loc.fileType === "CPT"
          ? "#2563eb"
          : loc.fileType === "DISS"
            ? "#16a34a"
            : "#ea580c";

      const marker = L.circleMarker([loc.wgs84!.lat, loc.wgs84!.lon], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);

      const coordSysName = loc.coordinateSystem?.name ?? "Unknown";

      const originalCoordinates =
        loc.originalX !== null && loc.originalY !== null
          ? `${loc.originalX.toFixed(2)}, ${loc.originalY.toFixed(2)}`
          : "-";

      marker.bindPopup(`
        <div class="text-xs">
          <strong>${escapeHtml(loc.filename)}</strong><br/>
          ${escapeHtml(coordSysName)}: ${escapeHtml(originalCoordinates)}<br/>
          Lat/Lng: ${loc.wgs84!.lat.toFixed(6)}, ${loc.wgs84!.lon.toFixed(6)}
        </div>
      `);

      marker.on("click", () => {
        onMarkerClick(loc.filename);
      });

      markersRef.current.set(loc.filename, marker);
    };

    const addMarkerBatch = (startIndex: number) => {
      if (isCancelled) {
        return;
      }

      const endIndex = Math.min(
        startIndex + MARKER_BATCH_SIZE,
        locationsToAdd.length,
      );

      for (let index = startIndex; index < endIndex; index += 1) {
        addMarker(locationsToAdd[index]!);
      }

      if (endIndex < locationsToAdd.length) {
        timeoutId = window.setTimeout(() => {
          addMarkerBatch(endIndex);
        }, 0);
      }
    };

    addMarkerBatch(0);

    const previousLocationCount = previousLocationCountRef.current;
    previousLocationCountRef.current = locations.length;

    if (locations.length === 1 && previousLocationCount === 0) {
      const [location] = locations;

      if (!location?.wgs84) {
        return;
      }

      map.setView([location.wgs84!.lat, location.wgs84!.lon], 13);
      return;
    }

    if (previousLocationCount === 0) {
      const lats = locations.map((location) => location.wgs84!.lat);
      const lngs = locations.map((location) => location.wgs84!.lon);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];

      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      isCancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [locations, onMarkerClick, showDinoBoreholes]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    dinoMarkersRef.current.forEach((marker) => marker.remove());
    dinoMarkersRef.current.clear();

    if (!showDinoBoreholes) {
      return;
    }

    let timeoutId: number | null = null;
    let isCancelled = false;

    const addMarker = (location: DinoBoreholeLocation) => {
      const marker = L.circleMarker([location.lat, location.lon], {
        radius: 7,
        fillColor: "#0891b2",
        color: "#164e63",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      const csvUrl = createDinoDownloadUrl(
        DINO_PROFILE_CSV_DOWNLOAD_BASE_URL,
        location.dinoNumber,
      );
      const gefUrl = createDinoDownloadUrl(
        DINO_PROFILE_GEF_DOWNLOAD_BASE_URL,
        location.dinoNumber,
      );
      const profileCount =
        location.sampleProfileCount === null
          ? ""
          : `<br/>${escapeHtml(String(location.sampleProfileCount))} ${escapeHtml(dinoText.samples)}`;

      marker.bindPopup(`
        <div class="text-xs">
          <strong>${escapeHtml(location.dinoNumber)}</strong><br/>
          ${escapeHtml(dinoText.source)} · ${formatDistance(location.distanceKm)}${profileCount}<br/>
          <a href="${escapeHtml(csvUrl)}" target="_blank" rel="noreferrer">${escapeHtml(dinoText.csv)}</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(gefUrl)}" target="_blank" rel="noreferrer">${escapeHtml(dinoText.gef)}</a>
        </div>
      `);

      dinoMarkersRef.current.set(location.dinoNumber, marker);
    };

    const addMarkerBatch = (startIndex: number) => {
      if (isCancelled) {
        return;
      }

      const endIndex = Math.min(
        startIndex + MARKER_BATCH_SIZE,
        dinoBoreholes.length,
      );

      for (let index = startIndex; index < endIndex; index += 1) {
        addMarker(dinoBoreholes[index]!);
      }

      if (endIndex < dinoBoreholes.length) {
        timeoutId = window.setTimeout(() => addMarkerBatch(endIndex), 0);
      }
    };

    addMarkerBatch(0);

    return () => {
      isCancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      dinoMarkersRef.current.forEach((marker) => marker.remove());
      dinoMarkersRef.current.clear();
    };
  }, [dinoBoreholes, dinoText, showDinoBoreholes]);

  useEffect(() => {
    if (showDinoBoreholes) {
      return;
    }

    dinoRequestIdRef.current += 1;
    setDinoBoreholes([]);
    setDinoBoreholeError(null);
    setDinoResultsTruncated(false);
    setIsLoadingDinoBoreholes(false);
  }, [showDinoBoreholes]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;

    markersRef.current.forEach((marker, filename) => {
      const isSelected = filename === selectedFileName;
      const meta = locationLookup.get(filename);
      const isPdfSelected = selectedPdfSet.has(filename);
      const baseColor =
        meta?.fileType === "CPT"
          ? "#2563eb"
          : meta?.fileType === "DISS"
            ? "#16a34a"
            : "#ea580c";

      marker.setStyle({
        radius: isSelected ? 10 : isPdfSelected ? 9 : 8,
        fillColor: isSelected ? "#dc2626" : baseColor,
        color: isSelected ? "#7f1d1d" : isPdfSelected ? "#111827" : "#ffffff",
        weight: isSelected || isPdfSelected ? 3 : 2,
        fillOpacity: isPdfSelected ? 1 : 0.8,
      });

      if (isSelected || isPdfSelected) {
        marker.bringToFront();
      }

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (!selectedFileName) {
      return;
    }

    const selectedLocation = locations.find(
      (location) => location.filename === selectedFileName,
    );

    if (!selectedLocation?.wgs84) {
      return;
    }

    map.flyTo(
      [selectedLocation.wgs84.lat, selectedLocation.wgs84.lon],
      Math.max(map.getZoom(), SELECTED_LOCATION_ZOOM),
      { duration: 0.5 },
    );
  }, [locationLookup, locations, selectedFileName, selectedPdfSet]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const container = map.getContainer();

    if (!isRectangleSelectionEnabled) {
      container.style.cursor = "";
      map.dragging.enable();
      isDrawingSelectionRef.current = false;
      selectionStartRef.current = null;
      selectionRectangleRef.current?.remove();
      selectionRectangleRef.current = null;
      return;
    }

    container.style.cursor = "crosshair";
    map.dragging.disable();
    setSelectionMessage(t("mapRectangleSelectHint"));

    const handleMouseDown = (event: LeafletMouseEvent) => {
      if (event.originalEvent.button !== 0) {
        return;
      }

      isDrawingSelectionRef.current = true;
      selectionStartRef.current = {
        latLng: event.latlng,
        point: {
          x: event.containerPoint.x,
          y: event.containerPoint.y,
        },
      };

      selectionRectangleRef.current?.remove();
      selectionRectangleRef.current = L.rectangle(
        L.latLngBounds(event.latlng, event.latlng),
        {
          color: "#2563eb",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#60a5fa",
          fillOpacity: 0.12,
          interactive: false,
        },
      ).addTo(map);
    };

    const handleMouseMove = (event: LeafletMouseEvent) => {
      if (
        !isDrawingSelectionRef.current ||
        !selectionStartRef.current ||
        !selectionRectangleRef.current
      ) {
        return;
      }

      selectionRectangleRef.current.setBounds(
        L.latLngBounds(selectionStartRef.current.latLng, event.latlng),
      );
    };

    const finishSelection = (event?: LeafletMouseEvent) => {
      if (!isDrawingSelectionRef.current || !selectionStartRef.current) {
        return;
      }

      isDrawingSelectionRef.current = false;

      const start = selectionStartRef.current;
      const endPoint = event
        ? { x: event.containerPoint.x, y: event.containerPoint.y }
        : start.point;
      const bounds =
        selectionRectangleRef.current?.getBounds() ??
        L.latLngBounds(start.latLng, event?.latlng ?? start.latLng);

      selectionStartRef.current = null;

      const width = Math.abs(endPoint.x - start.point.x);
      const height = Math.abs(endPoint.y - start.point.y);

      if (width < 6 || height < 6) {
        setSelectionMessage(t("mapRectangleSelectHint"));
        return;
      }

      const selectedFilenames = locations
        .filter(
          (location) =>
            location.wgs84 &&
            bounds.contains([location.wgs84.lat, location.wgs84.lon]),
        )
        .map((location) => location.filename)
        .sort((left, right) => left.localeCompare(right));

      if (selectedFilenames.length === 0) {
        setSelectionMessage(t("mapRectangleSelectNone"));
        return;
      }

      addPdfSelection(selectedFilenames);
      setSelectionMessage(
        t("mapRectangleSelectAdded", { count: selectedFilenames.length }),
      );
    };

    const handleMouseUp = (event: LeafletMouseEvent) => {
      finishSelection(event);
    };

    const handleWindowMouseUp = () => {
      finishSelection();
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      map.dragging.enable();
      container.style.cursor = "";
      isDrawingSelectionRef.current = false;
      selectionStartRef.current = null;
      selectionRectangleRef.current?.remove();
      selectionRectangleRef.current = null;
    };
  }, [addPdfSelection, isRectangleSelectionEnabled, locations, t]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const container = map.getContainer();

    if (!isRadiusSelectionEnabled) {
      radiusSelectionCircleRef.current?.remove();
      radiusSelectionCircleRef.current = null;
      radiusSelectionCenterRef.current = null;
      return;
    }

    container.style.cursor = "crosshair";
    map.dragging.enable();
    setSelectionMessage(showDinoBoreholes ? dinoText.hint : t("mapRadiusSelectHint"));

    const handleMapClick = (event: LeafletMouseEvent) => {
      applyRadiusSelection(event.latlng);
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      container.style.cursor = "";
      radiusSelectionCircleRef.current?.remove();
      radiusSelectionCircleRef.current = null;
      radiusSelectionCenterRef.current = null;
    };
  }, [dinoText.hint, isRadiusSelectionEnabled, showDinoBoreholes, t]);

  useEffect(() => {
    if (!isRadiusSelectionEnabled || !radiusSelectionCenterRef.current) {
      return;
    }

    applyRadiusSelection(radiusSelectionCenterRef.current);
  }, [isRadiusSelectionEnabled, locations, selectionRadiusKm, showDinoBoreholes]);

  async function searchLocation() {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setFocusedSearchResult(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = window.desktopApi
        ? await window.desktopApi.searchOpenStreetMap(query, i18n.language)
        : await searchOpenStreetMapDirectly(query, i18n.language);

      const deduplicatedResults = deduplicateSearchResults(results);

      setSearchResults(deduplicatedResults);

      if (deduplicatedResults.length === 0) {
        setSearchError(t("mapSearchNoResults"));
      }
    } catch (error) {
      console.error(error);
      setSearchResults([]);
      setSearchError(t("mapSearchError"));
    } finally {
      setIsSearching(false);
    }
  }

  function focusSearchResult(result: SearchResult) {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const latLng: LatLngExpression = [result.lat, result.lon];

    map.setView(latLng, 15);
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = L.marker(latLng, {
      icon: searchResultIcon,
    }).addTo(map);
    searchMarkerRef.current
      .bindPopup(`<div class="text-xs">${escapeHtml(result.displayName)}</div>`)
      .openPopup();

    setSearchResults([result]);
    setFocusedSearchResult(result);

    if (showDinoBoreholes && isRadiusSelectionEnabled) {
      applyRadiusSelection(L.latLng(result.lat, result.lon));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchLocation();
            }
          }}
          placeholder={t("mapSearchPlaceholder")}
          className="flex-1 rounded-sm border border-gray-300 px-3 py-2 text-sm bg-white"
        />

        <button
          type="button"
          onClick={() => {
            void searchLocation();
          }}
          className="flex items-center gap-2 rounded-sm border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100"
          disabled={isSearching}
        >
          <SearchIcon size={14} />
          {isSearching ? t("mapSearching") : t("mapSearchButton")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsRectangleSelectionEnabled((previous) => {
              const next = !previous;
              if (next) {
                setIsRadiusSelectionEnabled(false);
              }
              setSelectionMessage(next ? t("mapRectangleSelectHint") : null);
              return next;
            });
          }}
          disabled={locations.length === 0}
          className="rounded-sm border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRectangleSelectionEnabled
            ? t("mapRectangleSelectDisable")
            : t("mapRectangleSelectEnable")}
        </button>

        <div className="flex items-center gap-2 rounded-sm border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700">
          <label htmlFor="map-radius-km" className="text-xs font-medium">
            {t("mapRadiusLabel")}
          </label>
          <input
            id="map-radius-km"
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={selectionRadiusKm}
            onChange={(event) => {
              const nextRadius = Number(event.target.value);

              if (Number.isFinite(nextRadius)) {
                setSelectionRadiusKm(Math.min(100, Math.max(0.1, nextRadius)));
              }
            }}
            className="w-20 rounded-sm border border-violet-200 bg-white px-2 py-1 text-sm tabular-nums text-gray-800"
          />
          <span className="text-xs">km</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsRadiusSelectionEnabled((previous) => {
              const next = !previous;
              if (next) {
                setIsRectangleSelectionEnabled(false);
              }
              setSelectionMessage(
                next
                  ? showDinoBoreholes
                    ? dinoText.hint
                    : t("mapRadiusSelectHint")
                  : null,
              );
              return next;
            });
          }}
          disabled={locations.length === 0 && !showDinoBoreholes}
          className="rounded-sm border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRadiusSelectionEnabled
            ? t("mapRadiusSelectDisable")
            : t("mapRadiusSelectEnable")}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowDinoBoreholes((previous) => {
              const next = !previous;

              if (next) {
                setIsRectangleSelectionEnabled(false);
                setIsRadiusSelectionEnabled(true);
                setSelectionMessage(dinoText.hint);

                const center = radiusSelectionCenterRef.current;
                if (center) {
                  window.setTimeout(() => {
                    void loadDinoBoreholes(center);
                  }, 0);
                }
              }

              return next;
            });
          }}
          className={`rounded-sm border px-3 py-2 text-sm transition-colors ${
            showDinoBoreholes
              ? "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800"
              : "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
          }`}
        >
          {showDinoBoreholes ? dinoText.disable : dinoText.enable}
        </button>

        <div className="text-xs text-gray-500">
          {t("selectedBoringsCount", { count: selectedPdfFilenames.length })}
        </div>
      </div>

      {searchError ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {searchError}
        </div>
      ) : null}

      {selectionMessage ? (
        <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {selectionMessage}
        </div>
      ) : null}

      {showDinoBoreholes ? (
        <div className="rounded-sm border border-cyan-200 bg-cyan-50/60">
          <div className="flex items-center justify-between gap-3 border-b border-cyan-100 px-3 py-2 text-xs font-medium text-cyan-900">
            <span>
              {isLoadingDinoBoreholes
                ? dinoText.loading
                : dinoBoreholes.length > 0
                  ? dinoText.count(dinoBoreholes.length)
                  : dinoBoreholeError ?? dinoText.hint}
            </span>
            <span className="shrink-0 font-normal text-cyan-700">
              {dinoText.source}
            </span>
          </div>

          {dinoBoreholeError ? (
            <div className="px-3 py-2 text-xs text-red-700">
              {dinoBoreholeError}
            </div>
          ) : null}

          {!isLoadingDinoBoreholes &&
          !dinoBoreholeError &&
          radiusSelectionCenterRef.current &&
          dinoBoreholes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-cyan-800">
              {dinoText.empty}
            </div>
          ) : null}

          {dinoResultsTruncated ? (
            <div className="border-t border-cyan-100 px-3 py-2 text-xs text-amber-700">
              {dinoText.truncated}
            </div>
          ) : null}

          {dinoBoreholes
            .slice(0, MAX_VISIBLE_DINO_LOCATIONS)
            .map((location) => (
              <div
                key={location.dinoNumber}
                className="flex items-center gap-3 border-t border-cyan-100 px-3 py-2 text-xs text-gray-700"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium text-cyan-900 hover:underline"
                  onClick={() => {
                    const map = mapInstanceRef.current;
                    const marker = dinoMarkersRef.current.get(location.dinoNumber);
                    map?.setView(
                      [location.lat, location.lon],
                      Math.max(map.getZoom(), SELECTED_LOCATION_ZOOM),
                    );
                    marker?.openPopup();
                  }}
                >
                  {location.dinoNumber}
                </button>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {formatDistance(location.distanceKm)}
                </span>
                <a
                  href={createDinoDownloadUrl(
                    DINO_PROFILE_CSV_DOWNLOAD_BASE_URL,
                    location.dinoNumber,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-sm border border-cyan-200 bg-white px-2 py-1 text-cyan-800 hover:bg-cyan-100"
                  title={`${location.dinoNumber} CSV`}
                >
                  <DownloadIcon size={12} />
                  {dinoText.csv}
                </a>
                <a
                  href={createDinoDownloadUrl(
                    DINO_PROFILE_GEF_DOWNLOAD_BASE_URL,
                    location.dinoNumber,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-sm border border-cyan-200 bg-white px-2 py-1 text-cyan-800 hover:bg-cyan-100"
                  title={`${location.dinoNumber} GEF`}
                >
                  <DownloadIcon size={12} />
                  {dinoText.gef}
                </a>
              </div>
            ))}

          {dinoBoreholes.length > MAX_VISIBLE_DINO_LOCATIONS ? (
            <div className="border-t border-cyan-100 px-3 py-2 text-[11px] text-cyan-800">
              {dinoText.more}
            </div>
          ) : null}
        </div>
      ) : null}

      {searchResults.length > 0 ? (
        <div className="rounded-sm border border-gray-200 bg-white">
          {searchResults.map((result) => (
            <button
              key={result.placeId}
              type="button"
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 transition-colors last:border-b-0 hover:bg-gray-50"
              onClick={() => {
                focusSearchResult(result);
              }}
            >
              {result.displayName}
            </button>
          ))}
        </div>
      ) : null}

      {focusedSearchResult ? (
        <div className="rounded-sm border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
            {nearbyLocations.length > 0
              ? t("mapNearbyFiles", { count: nearbyLocations.length })
              : t("mapNearbyFilesNone")}
          </div>

          {nearbyLocations
            .slice(0, MAX_VISIBLE_NEARBY_LOCATIONS)
            .map(({ file, distanceKm }) => (
              <button
                key={file.filename}
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-xs text-gray-700 transition-colors last:border-b-0 hover:bg-blue-50"
                onClick={() => {
                  onMarkerClick(file.filename);
                }}
              >
                <span className="truncate">{file.filename}</span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {distanceKm < 1
                    ? `${Math.round(distanceKm * 1000)} m`
                    : `${distanceKm.toFixed(1)} km`}
                </span>
              </button>
            ))}

          {nearbyLocations.length > MAX_VISIBLE_NEARBY_LOCATIONS ? (
            <div className="px-3 py-2 text-[11px] text-gray-500">
              {t("mapNearbyFilesMore")}
            </div>
          ) : null}
        </div>
      ) : null}

      {locations.length === 0 && !showDinoBoreholes ? (
        <div className="text-xs text-gray-500">{t("noLocationData")}</div>
      ) : null}

      <div
        ref={mapRef}
        className="w-full h-96 rounded-sm border border-gray-300"
        style={{ zIndex: 0 }}
      />
    </div>
  );
}

async function searchOpenStreetMapDirectly(
  query: string,
  language: string,
): Promise<Array<SearchResult>> {
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
      },
    },
  );

  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed with ${response.status}`);
  }

  const results = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return results.map((result) => ({
    placeId: result.place_id,
    displayName: result.display_name,
    lat: Number(result.lat),
    lon: Number(result.lon),
  }));
}

async function fetchDinoBoreholesWithinRadius(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): Promise<{ locations: Array<DinoBoreholeLocation>; truncated: boolean }> {
  const latitudeDelta = radiusKm / 110.574;
  const longitudeKilometersPerDegree = Math.max(
    1,
    111.32 * Math.cos((centerLat * Math.PI) / 180),
  );
  const longitudeDelta = radiusKm / longitudeKilometersPerDegree;
  const minLat = Math.max(-90, centerLat - latitudeDelta);
  const maxLat = Math.min(90, centerLat + latitudeDelta);
  const minLon = Math.max(-180, centerLon - longitudeDelta);
  const maxLon = Math.min(180, centerLon + longitudeDelta);
  const collected = new Map<string, DinoBoreholeLocation>();
  let offset = 0;
  let truncated = false;

  while (collected.size < DINO_MAX_RESULTS) {
    const searchParams = new URLSearchParams({
      f: "geojson",
      where: "MP_CNT > 0",
      outFields: "DINO_NR,MP_CNT",
      returnGeometry: "true",
      geometry: `${minLon},${minLat},${maxLon},${maxLat}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultOffset: String(offset),
      resultRecordCount: String(DINO_QUERY_PAGE_SIZE),
      orderByFields: "OBJECT_ID ASC",
    });
    const response = await fetch(
      `${DINO_MAPSERVER_QUERY_URL}?${searchParams.toString()}`,
      { headers: { Accept: "application/geo+json,application/json" } },
    );

    if (!response.ok) {
      throw new Error(`DINOloket MapServer failed with ${response.status}`);
    }

    const data = (await response.json()) as DinoGeoJsonResponse;

    if (data.error) {
      throw new Error(
        `DINOloket MapServer ${data.error.code ?? ""}: ${data.error.message ?? "unknown error"}`,
      );
    }

    const features = Array.isArray(data.features) ? data.features : [];

    for (const feature of features) {
      if (feature.geometry?.type !== "Point") {
        continue;
      }

      const [lon, lat] = feature.geometry.coordinates;
      const dinoNumberValue = feature.properties?.DINO_NR;
      const dinoNumber =
        typeof dinoNumberValue === "string" ? dinoNumberValue.trim() : "";

      if (
        !dinoNumber ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        continue;
      }

      const distanceKm = calculateDistanceKm(
        centerLat,
        centerLon,
        lat,
        lon,
      );

      if (distanceKm > radiusKm) {
        continue;
      }

      const profileCountValue = feature.properties?.MP_CNT;
      const sampleProfileCount =
        typeof profileCountValue === "number" &&
        Number.isFinite(profileCountValue)
          ? profileCountValue
          : typeof profileCountValue === "string" &&
              Number.isFinite(Number(profileCountValue))
            ? Number(profileCountValue)
            : null;

      collected.set(dinoNumber, {
        dinoNumber,
        lat,
        lon,
        sampleProfileCount,
        distanceKm,
      });

      if (collected.size >= DINO_MAX_RESULTS) {
        truncated = true;
        break;
      }
    }

    if (
      features.length < DINO_QUERY_PAGE_SIZE ||
      data.exceededTransferLimit === false
    ) {
      break;
    }

    offset += features.length;

    if (features.length === 0) {
      break;
    }
  }

  return {
    locations: Array.from(collected.values()).sort((left, right) => {
      const byDistance = left.distanceKm - right.distanceKm;
      return byDistance !== 0
        ? byDistance
        : left.dinoNumber.localeCompare(right.dinoNumber);
    }),
    truncated,
  };
}

function createDinoDownloadUrl(baseUrl: string, dinoNumber: string): string {
  return `${baseUrl}/${encodeURIComponent(dinoNumber)}`;
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceKm.toFixed(1)} km`;
}

function deduplicateSearchResults(
  results: Array<SearchResult>,
): Array<SearchResult> {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = [
      result.displayName.trim().toLowerCase(),
      result.lat.toFixed(6),
      result.lon.toFixed(6),
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function calculateDistanceKm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const earthRadiusKm = 6371.0088;
  const degreesToRadians = Math.PI / 180;
  const latitudeDelta = (toLat - fromLat) * degreesToRadians;
  const longitudeDelta = (toLon - fromLon) * degreesToRadians;
  const fromLatitude = fromLat * degreesToRadians;
  const toLatitude = toLat * degreesToRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const boundedHaversine = Math.min(1, Math.max(0, haversine));

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine))
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

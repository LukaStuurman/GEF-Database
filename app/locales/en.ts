export default {
  translation: {
    // App title and description
    appTitle: "Bedrock GEF Viewer Desktop",
    appDescription:
      "View and analyze GEF (Geotechnical Exchange Format) files for CPT, dissipation tests, and geotechnical borehole data in this Windows app.",
    privacyNote: "Your data never leaves this app.",
    offlineNote: "This app runs locally and can be used offline.",
    installInstructionsDesktop:
      "Desktop version active. You can open or drag files right away.",
    installInstructionsIOS: "Tap Share, then 'Add to Home Screen' to install.",
    installInstructionsAndroid: "Tap the menu (⋮), then 'Install app'.",

    // File actions
    chooseFiles: "Choose GEF files",
    dropFilesHere: "Drop GEF files here",
    loadSampleFiles: "load sample files",
    clearAllFiles: "Clear all files",
    removeFile: "Remove file",
    processingFiles: "Processing files...",
    or: "or",

    // Errors and warnings
    failedToParse: "Failed to parse {{count}} file:",
    failedToParse_plural: "Failed to parse {{count}} files:",
    warning: "{{count}} warning:",
    warning_plural: "{{count}} warnings:",

    // Header validation warnings
    missingZidHeader:
      "File '{{filename}}' missing ZID header (height reference system). Defaulting to 'Normaal Amsterdams Peil'. This may affect elevation calculations and vertical positioning of measurements.",
    unknownHeightSystem:
      "File '{{filename}}' contains unknown height system code \"{{heightCode}}\". Defaulting to 'Normaal Amsterdams Peil'. This may cause incorrect elevation calculations.",
    zidWithoutHeight:
      "File '{{filename}}' has ZID header without height value. Defaulting surface elevation to 0m. This will affect depth-to-elevation conversions and may produce incorrect ground level readings.",
    missingXyidHeader:
      "File '{{filename}}' missing XYID header (coordinate information). Location is unknown, cannot display on map or convert to WGS84.",
    missingColumnInfoQuantity:
      "File '{{filename}}' has {{count}} COLUMNINFO {{entry}} missing quantity number (4th element per GEF spec). Defaulting to quantity 0 (unknown). This may cause data columns to be misinterpreted or not displayed correctly.",
    missingColumnInfoQuantity_entry: "entry",
    missingColumnInfoQuantity_entry_plural: "entries",
    sieveTestNotSupported: "GEF-SIEVE files are not supported",
    name: "Name",
    unit: "Unit",

    // Location
    location: "Location",
    allLocations: "All Locations",

    // Header labels
    unknownTest: "Unknown Test",
    date: "Date:",
    boringDate: "Boring date:",
    placeName: "Place:",
    drillingCompany: "Drilling company:",
    layerDescriber: "Layer describer:",
    locationLabel: "Location:",
    groundLevel: "Ground level:",
    waterLevel: "Water level:",
    depth: "Depth:",
    scanNumber: "Scan #:",
    downloadCsv: "Download CSV",
    downloadJson: "Download JSON",
    downloadCsvTooltip: "Download data only as CSV",
    downloadJsonTooltip: "Download data and metadata as JSON",

    // Copy buttons
    copyTestId: "Copy Test ID",
    copyProjectId: "Copy Project ID",
    copyDate: "Copy Date",
    copyCoordinates: "Copy coordinates",
    copyWgs84: "Copy WGS84 coordinates",
    copyElevation: "Copy elevation",
    copyWaterLevel: "Copy water level",

    // Technical details sections
    technicalDetails: "Technical Details",
    projectInformation: "Project Information",
    testInformation: "Test Information",
    coordinatesLocation: "Coordinates & Location",
    equipmentCapabilities: "Equipment & Capabilities",
    testConditionsRemarks: "Test Conditions & Remarks",
    dataProcessing: "Data Processing",
    calculationsFormulas: "Calculations & Formulas",
    dataStructure: "Data Structure",
    calibrationData: "Calibration Data",
    fileMetadata: "File Metadata",
    comments: "Comments",
    extension: "Extension",

    // Technical detail labels
    projectId: "Project ID",
    testId: "Test ID",
    company: "Company",
    address: "Address",
    country: "Country",
    countryNetherlands: "Netherlands",
    countryBelgium: "Belgium",
    countryGermany: "Germany",
    startDate: "Start Date",
    startTime: "Start Time",
    coordinateSystem: "Coordinate System",
    xCoordinate: "X Coordinate",
    yCoordinate: "Y Coordinate",
    heightSystem: "Height System",
    surfaceLevel: "Surface Level",
    numberOfColumns: "Number of Columns",
    numberOfScans: "Number of Scans",
    dataFormat: "Data Format",
    dataColumns: "Data Columns",
    gefVersion: "GEF Version",
    reportCode: "Report Code",
    measurementCode: "Measurement Code",
    fileDate: "File Date",
    fileOwner: "File Owner",
    operatingSystem: "Operating System",
    extensionType: "Extension Type",
    comment: "Comment",

    // Time scale options
    timeScale: "Time axis",
    scaleSqrt: "√t",
    scaleLog: "log",
    scaleLinear: "linear",

    // DISS-specific
    parentCpt: "Parent CPT",
    dissipationDepth: "Test depth:",
    porePressure: "Pore Pressure",
    coneResistance: "Cone Resistance",

    // Plot labels
    columns: "Columns",
    yAxisVertical: "Y-Axis (Vertical)",
    boreLog: "Borehole Log",
    graphs: "Graphs",
    legend: "Legend",
    depthM: "Depth (m)",
    downloadSvg: "Download SVG",
    downloadPng: "Download PNG",
    selectDownloadFormat: "Selecteer download formaat",

    // Soil types
    sand: "Sand",
    clay: "Clay",
    peat: "Peat",
    silt: "Silt",
    gravel: "Gravel",
    notDescribed: "Not described",

    // Specimen table
    specimens: "Specimens",
    specimensCount: "Specimens ({{count}})",
    remarks: "Remarks:",
    number: "#",
    code: "Code",
    depthM_table: "Depth (m)",
    diameterSampleMm: "Ø Sample (mm)",
    diameterApparatusMm: "Ø Apparatus (mm)",
    dateTime: "Date/Time",
    sampleCondition: "Condition",
    apparatusType: "Apparatus",
    wallMethod: "Wall/Method",

    // Pre-excavation
    preExcavation: "Pre-excavation",
    preExcavationDescription: "Soil removed before cone penetration testing",

    // Copy
    copy: "Copy",

    // Column min/max
    min: "Min",
    max: "Max",
    range: "Range",

    // Map
    loadingMap: "Loading map...",
    noValidLocations: "No valid locations to display",
    noLocationData: "No GEF files with location data",
    unknownCoordinateSystem: "Unknown",

    // File table columns
    filename: "Filename",
    testDate: "Test Date",
    filterFilesPlaceholder: "Search files",
    noFilesMatchFilter: "No files match this search.",
    showingLimitedFiles:
      "Showing {{visible}} of {{total}} files. Use the search field or map selection to narrow things down.",

    // Empty state
    uploadGefFile: "Upload a GEF file to get started",
    selectFileForDetails: "Choose a file to view details",
    selectFileForDetailsDescription:
      "Select a file in the list or click a location on the map. The full GEF content is only loaded when it is actually needed.",

    // Download
    downloadLocationsGeoJson: "Download locations as GeoJSON",

    // Desktop storage
    storageSettings: "Local database and dataset folder",
    localDatabaseDescription:
      "The dataset folder is indexed quickly for metadata and locations; the full GEF content is only loaded when you open or export a file. The database folder is used for manually added files and as a local cache, so startup stays much faster for large datasets.",
    localDatabase: "Local database",
    databaseFilesCount: "{{count}} files stored in the app",
    databaseFolderDefault: "Default app location",
    chooseDatabaseFolder: "Choose database folder",
    changeDatabaseFolder: "Change database folder",
    databaseFolderSelected:
      "Database folder updated. {{count}} files remain available.",
    databaseFolderSaveFailed: "Changing the database folder failed.",
    backupFolder: "Dataset folder",
    backupNotConfigured: "No dataset folder selected yet.",
    chooseBackupFolder: "Choose dataset folder",
    changeBackupFolder: "Change dataset folder",
    refreshDatasetFolder: "Refresh dataset",
    backupFilesCount: "{{count}} files found in the dataset folder",
    scanningDatasetFolder: "Checking the dataset folder for changes...",
    restoringFiles: "Restoring saved files...",
    restoringFilesProgress: "Loading GEF files: {{processed}} of {{total}}",
    databaseSavedStatus: "{{count}} files saved to the local database.",
    databaseAndBackupSavedStatus:
      "{{databaseCount}} files in the database, {{backupCount}} in the backup folder.",
    databaseSaveFailed: "Saving to the local database failed.",
    backupSaveFailed: "Linking the dataset folder failed.",
    backupFolderSelected: "Dataset folder updated. {{count}} files were found.",
    backupFolderRefreshed:
      "Dataset updated. {{count}} GEF files are immediately searchable.",
    backupRefreshFailed: "The dataset could not be refreshed.",
    databaseCleared:
      "The local database was cleared. Files in the selected dataset folder remain unchanged.",

    // Bore style
    customizeBoreLog: "Customize bore log colors and legend",
    legendColor: "Legend color",
    legendLabel: "Legend label",
    resetBoreStyle: "Restore default legend",

    // Map search
    mapSearchPlaceholder: "Search by address, place or coordinate",
    mapSearchButton: "Search",
    mapSearching: "Searching...",
    mapSearchNoResults: "No locations were found.",
    mapSearchError: "Map search failed.",
    mapRectangleSelectEnable: "Select GEF locations on map",
    mapRectangleSelectDisable: "Stop map selection",
    mapRectangleSelectHint:
      "Drag a rectangle over the map to add GEF files to the export selection.",
    mapRectangleSelectAdded: "{{count}} files added to the export selection.",
    mapRectangleSelectNone:
      "No exportable files were found in the selected area.",
    mapRadiusLabel: "Radius",
    mapRadiusSelectEnable: "Select by point and radius",
    mapRadiusSelectDisable: "Stop radius selection",
    mapRadiusSelectHint:
      "Click the map to choose the center. All GEF locations within the selected radius will be selected.",
    mapRadiusSelectAdded:
      "{{count}} GEF files within {{radius}} km were selected.",
    mapRadiusSelectNone:
      "No GEF locations were found within a radius of {{radius}} km.",
    mapNearbyFiles: "{{count}} GEF locations within {{radius}} km",
    mapNearbyFilesNone:
      "No GEF locations were found within {{radius}} km.",
    mapNearbyFilesMore: "The 12 nearest locations are shown.",

    // Bore PDF export
    borePdfExportTitle: "Select and export GEF files",
    borePdfExportDescription:
      "Choose one or more BORE, CPT or DISS files. Export the original GEF files to a folder or create a separate PDF for each file. For PDF, you can choose below which pages and graphs to include.",
    exportSelectedGefFiles: "Export selected GEF files",
    exportingGefFiles: "Copying GEF files...",
    gefExportCompleted: "{{count}} GEF files were saved to {{directory}}.",
    gefExportPartiallyCompleted:
      "{{savedCount}} GEF files saved to {{directory}}; {{failedCount}} files could not be copied.",
    gefExportCancelled: "GEF export was cancelled.",
    gefExportFailed: "GEF export failed.",
    borePdfExportPageOptions: "Choose which pages to include",
    borePdfIncludeSummaryPage: "Summary",
    borePdfIncludePlotPage: "Graphs / bore log",
    borePdfIncludeSpecimensPage: "Specimens",
    borePdfIncludeTechnicalPage: "Technical information",
    borePdfGraphSelectionTitle: "Choose specific graphs",
    borePdfGraphSelectionDescription:
      "Only the selected graphs will be added to the PDF for each selected file.",
    borePdfGraphSelectionLoading:
      "Loading graph options from all selected files...",
    borePdfNoGraphsAvailable:
      "No graphs are available for the current file selection.",
    borePdfExportSelectAtLeastOnePage:
      "Select at least one page or graph for the PDF export.",
    selectAllBorings: "Select all files",
    selectAllGraphs: "Select all graphs",
    clearSelection: "Clear selection",
    clearGraphSelection: "Clear graph selection",
    selectedBoringsCount: "{{count}} files selected",
    exportSelectedBoringsPdf: "Export selected files as PDF",
    exportingBorePdfs: "Creating PDFs...",
    borePdfExportCompleted: "{{count}} PDF files were exported.",
    borePdfExportSavedTo: "{{count}} PDF files were saved to {{directory}}.",
    borePdfExportFailed: "PDF export failed.",
    borePdfExportCancelled: "PDF export was cancelled.",
    boreSummaryPageTitle: "Bore information",
    cptSummaryPageTitle: "CPT information",
    dissSummaryPageTitle: "DISS information",
    borePlotPageTitle: "Bore log",
    cptGraphPageTitle: "CPT graph",
    dissPorePressurePageTitle: "DISS pore pressure",
    dissConeResistancePageTitle: "DISS cone resistance",
    specimensPageTitle: "Specimens",

    // Footer
    about: "About",
    contact: "Contact",
    feedbackOrRequests: "Bugs, feedback or requests?",
    needSimilarApp: "Need a similar app for your geotechnical workflow?",
    contactUs: "Contact us",

    // Empty state CTA
    freeToolByBedrock: "Free tool by Bedrock.engineer. We build:",
    customWebApps: "Custom web apps for geotechnical workflows",
    pythonAutomation: "Geotechnical workflow automation using Python",
    bimCadIntegrations:
      "Geotechnical data integration into BIM software like Civil3D, Revit, Rhino3D, and Grasshopper",
    emptyStateContact: "Interested?",

    // Disclaimer
    disclaimer:
      "This tool is provided for informational purposes only. All geotechnical data should be verified by a qualified geotechnical professional. No rights can be derived from the use of this tool.",

    childGefFiles: "Child GEF files",
    childGefFile: "Child GEF file",
    childGefFilesCount: "{{count}} child file",
    childGefFilesCount_plural: "{{count}} child files",
    dissTests: "Dissipation tests:",
    reference: "Reference",
    description: "Description",
  },
} as const;


export default {
  translation: {
    // App title and description
    appTitle: "Bedrock GEF Viewer Desktop",
    appDescription:
      "Bekijk en analyseer GEF (Geotechnical Exchange Format) bestanden voor CPT, dissipatietesten en geotechnische boringen in deze Windows-app.",
    privacyNote: "Je gegevens verlaten nooit deze app.",
    offlineNote: "Deze app werkt lokaal en kan offline gebruikt worden.",
    installInstructionsDesktop:
      "Desktopversie actief. Je kunt direct bestanden openen of slepen.",
    installInstructionsIOS:
      "Tik op Deel, dan 'Zet op beginscherm' om te installeren.",
    installInstructionsAndroid: "Tik op het menu (⋮), dan 'App installeren'.",

    // File actions
    chooseFiles: "Kies GEF bestanden",
    dropFilesHere: "Sleep GEF bestanden hierheen",
    loadSampleFiles: "laad voorbeeldbestanden",
    clearAllFiles: "Alle bestanden wissen",
    removeFile: "Bestand verwijderen",
    processingFiles: "Bestanden verwerken...",
    or: "of",

    // Errors and warnings
    failedToParse: "Kon {{count}} bestand niet parsen:",
    failedToParse_plural: "Kon {{count}} bestanden niet parsen:",
    warning: "{{count}} waarschuwing:",
    warning_plural: "{{count}} waarschuwingen:",

    // Header validation warnings
    missingZidHeader:
      "Bestand '{{filename}}' mist ZID header (hoogtestelsel). Standaard ingesteld op 'Normaal Amsterdams Peil'. Dit kan de hoogte berekeningen en verticale positionering van metingen beïnvloeden.",
    unknownHeightSystem:
      "Bestand '{{filename}}' bevat onbekende hoogtestelsel code \"{{heightCode}}\". Standaard ingesteld op 'Normaal Amsterdams Peil'. Dit kan leiden tot onjuiste hoogte berekeningen.",
    zidWithoutHeight:
      "Bestand '{{filename}}' heeft een ZID header zonder hoogtewaarde. Maaiveldniveau standaard ingesteld op 0m. Dit beïnvloedt diepte-naar-hoogte conversies en kan leiden tot onjuiste maaiveldmetingen.",
    missingXyidHeader:
      "Bestand '{{filename}}' mist XYID header (coördinaat informatie). Locatie is onbekend, kan niet op de kaart weergeven of converteren naar WGS84.",
    missingColumnInfoQuantity:
      "Bestand '{{filename}}' heeft {{count}} COLUMNINFO {{entry}} die het quantity nummer missen (4e element volgens GEF spec). Standaard ingesteld op quantity 0 (onbekend). Dit kan ervoor zorgen dat data kolommen verkeerd worden geïnterpreteerd of niet correct worden weergegeven.",
    missingColumnInfoQuantity_entry: "item",
    missingColumnInfoQuantity_entry_plural: "items",
    sieveTestNotSupported: "GEF-SIEVE bestanden worden niet ondersteund",

    // Location
    location: "Locatie",
    allLocations: "Alle Locaties",

    // Header labels
    unknownTest: "Onbekende Test",
    date: "Datum:",
    boringDate: "Datum boring:",
    placeName: "Plaatsnaam:",
    drillingCompany: "Boorbedrijf:",
    layerDescriber: "Beschrijver lagen:",
    locationLabel: "Locatie:",
    groundLevel: "Maaiveld:",
    waterLevel: "Waterstand:",
    depth: "Diepte:",
    scanNumber: "Scan #:",
    downloadCsv: "Download CSV",
    downloadJson: "Download JSON",
    downloadCsvTooltip: "Download alleen data als CSV",
    downloadJsonTooltip: "Download data en metadata als JSON",
    name: "Naam",
    unit: "Eenheid",

    // Copy buttons
    copyTestId: "Test ID kopiëren",
    copyProjectId: "Project ID kopiëren",
    copyDate: "Datum kopiëren",
    copyCoordinates: "Coördinaten kopiëren",
    copyWgs84: "WGS84 coördinaten kopiëren",
    copyElevation: "Hoogte kopiëren",
    copyWaterLevel: "Waterstand kopiëren",

    // Technical details sections
    technicalDetails: "Technische Details",
    projectInformation: "Projectinformatie",
    testInformation: "Testinformatie",
    coordinatesLocation: "Coördinaten & Locatie",
    equipmentCapabilities: "Apparatuur & Mogelijkheden",
    testConditionsRemarks: "Testcondities & Opmerkingen",
    dataProcessing: "Gegevensverwerking",
    calculationsFormulas: "Berekeningen & Formules",
    dataStructure: "Gegevensstructuur",
    calibrationData: "Kalibratiegegevens",
    fileMetadata: "Bestandsmetadata",
    comments: "Opmerkingen",
    extension: "Extensie",

    // Technical detail labels
    projectId: "Project ID",
    testId: "Test ID",
    company: "Bedrijf",
    address: "Adres",
    country: "Land",
    countryNetherlands: "Nederland",
    countryBelgium: "België",
    countryGermany: "Duitsland",
    startDate: "Startdatum",
    startTime: "Starttijd",
    coordinateSystem: "Coördinatenstelsel",
    xCoordinate: "X Coördinaat",
    yCoordinate: "Y Coördinaat",
    heightSystem: "Hoogtestelsel",
    surfaceLevel: "Maaiveldniveau",
    numberOfColumns: "Aantal kolommen",
    numberOfScans: "Aantal scans",
    dataFormat: "Gegevensformaat",
    dataColumns: "Gegevenskolommen",
    gefVersion: "GEF Versie",
    reportCode: "Rapportcode",
    measurementCode: "Beschrijfmethode",
    fileDate: "Bestandsdatum",
    fileOwner: "Bestandseigenaar",
    operatingSystem: "Besturingssysteem",
    extensionType: "Extensietype",
    comment: "Opmerking",

    // Time scale options
    timeScale: "Tijdas",
    scaleSqrt: "√t",
    scaleLog: "log",
    scaleLinear: "lineair",

    // DISS-specific
    parentCpt: "Bijbehorende CPT",
    dissipationDepth: "Testdiepte:",
    porePressure: "Waterspanning",
    coneResistance: "Conusweerstand",

    // Plot labels
    columns: "Kolommen",
    yAxisVertical: "Y-as (Verticaal)",
    boreLog: "Boorstaat",
    graphs: "Grafieken",
    legend: "Legenda",
    depthM: "Diepte (m)",
    downloadSvg: "Download SVG",
    downloadPng: "Download PNG",
    selectDownloadFormat: "Select download format",

    // Soil types
    sand: "Zand",
    clay: "Klei",
    peat: "Veen",
    silt: "Leem",
    gravel: "Grind",
    notDescribed: "Niet beschreven",

    // Specimen table
    specimens: "Monsters",
    specimensCount: "Monsters ({{count}})",
    remarks: "Opmerkingen:",
    number: "Nr",
    code: "Code",
    depthM_table: "Diepte (m)",
    diameterSampleMm: "Ø Monster (mm)",
    diameterApparatusMm: "Ø Apparaat (mm)",
    dateTime: "Datum/Tijd",
    sampleCondition: "Toestand",
    apparatusType: "Apparaat",
    wallMethod: "Wand/Methode",

    // Pre-excavation
    preExcavation: "Voorontgraving",
    preExcavationDescription: "Grond verwijderd vóór sonderen",

    // Copy
    copy: "Kopiëren",

    // Column min/max
    min: "Min",
    max: "Max",
    range: "Bereik",

    // Map
    loadingMap: "Kaart laden...",
    noValidLocations: "Geen geldige locaties om weer te geven",
    noLocationData: "Geen GEF-bestanden met locatiegegevens",
    unknownCoordinateSystem: "Onbekend",

    // File table columns
    filename: "Bestandsnaam",
    testDate: "Testdatum",
    filterFilesPlaceholder: "Zoek in bestanden",
    noFilesMatchFilter: "Geen bestanden gevonden voor deze zoekopdracht.",
    showingLimitedFiles:
      "{{visible}} van {{total}} bestanden worden getoond. Gebruik het zoekveld of de kaartselectie om gerichter te werken.",

    // Empty state
    uploadGefFile: "Upload een GEF-bestand om te beginnen",
    selectFileForDetails: "Kies een bestand om details te bekijken",
    selectFileForDetailsDescription:
      "Selecteer een bestand in de lijst of klik op een locatie op de kaart. De volledige GEF-inhoud wordt pas geladen zodra je die echt nodig hebt.",

    // Download
    downloadLocationsGeoJson: "Download locaties als GeoJSON",

    // Desktop storage
    storageSettings: "Lokale database en datasetmap",
    localDatabaseDescription:
      "De datasetmap wordt snel geïndexeerd op metadata en locaties; de volledige GEF-inhoud wordt pas geladen zodra je een bestand opent of exporteert. De databasemap wordt gebruikt voor handmatig toegevoegde bestanden en als lokale cache, zodat opstarten met grote datasets veel sneller blijft.",
    localDatabase: "Lokale database",
    databaseFilesCount: "{{count}} bestanden opgeslagen in de app",
    databaseFolderDefault: "Standaard app-locatie",
    chooseDatabaseFolder: "Kies databasemap",
    changeDatabaseFolder: "Wijzig databasemap",
    databaseFolderSelected:
      "Databasemap bijgewerkt. {{count}} bestanden blijven beschikbaar.",
    databaseFolderSaveFailed: "Databasemap wijzigen is mislukt.",
    backupFolder: "Datasetmap",
    backupNotConfigured: "Nog geen datasetmap gekozen.",
    chooseBackupFolder: "Kies datasetmap",
    changeBackupFolder: "Wijzig datasetmap",
    refreshDatasetFolder: "Ververs dataset",
    backupFilesCount: "{{count}} bestanden gevonden in de datasetmap",
    scanningDatasetFolder: "Datasetmap controleren op wijzigingen...",
    restoringFiles: "Opgeslagen bestanden worden hersteld...",
    restoringFilesProgress: "GEF-bestanden laden: {{processed}} van {{total}}",
    databaseSavedStatus:
      "{{count}} bestanden opgeslagen in de lokale database.",
    databaseAndBackupSavedStatus:
      "{{databaseCount}} bestanden in de database, {{backupCount}} in de backupmap.",
    databaseSaveFailed: "Opslaan in de lokale database is mislukt.",
    backupSaveFailed: "Datasetmap koppelen is mislukt.",
    backupFolderSelected:
      "Datasetmap bijgewerkt. {{count}} bestanden zijn gevonden.",
    backupFolderRefreshed:
      "Dataset is bijgewerkt. {{count}} GEF-bestanden zijn direct doorzoekbaar.",
    backupRefreshFailed: "De dataset kon niet worden bijgewerkt.",
    databaseCleared:
      "De lokale database is leeggemaakt. Bestanden in de gekozen datasetmap blijven ongewijzigd.",

    // Bore style
    customizeBoreLog: "Pas boorstaat kleuren en legenda aan",
    legendColor: "Legenda kleur",
    legendLabel: "Legenda label",
    resetBoreStyle: "Herstel standaard legenda",

    // Map search
    mapSearchPlaceholder: "Zoek op adres, plaats of coördinaat",
    mapSearchButton: "Zoeken",
    mapSearching: "Zoekt...",
    mapSearchNoResults: "Geen locaties gevonden.",
    mapSearchError: "Zoeken op de kaart is mislukt.",
    mapRectangleSelectEnable: "Selecteer GEF-locaties op kaart",
    mapRectangleSelectDisable: "Stop kaartselectie",
    mapRectangleSelectHint:
      "Sleep een rechthoek over de kaart om GEF-bestanden toe te voegen aan de exportselectie.",
    mapRectangleSelectAdded:
      "{{count}} bestanden toegevoegd aan de exportselectie.",
    mapRectangleSelectNone:
      "Geen exporteerbare bestanden gevonden in het geselecteerde vlak.",
    mapRadiusLabel: "Straal",
    mapRadiusSelectEnable: "Selecteer met punt en straal",
    mapRadiusSelectDisable: "Stop straalselectie",
    mapRadiusSelectHint:
      "Klik op de kaart om het middelpunt te kiezen. Alle GEF-locaties binnen de ingestelde straal worden geselecteerd.",
    mapRadiusSelectAdded:
      "{{count}} GEF-bestanden binnen {{radius}} km zijn geselecteerd.",
    mapRadiusSelectNone:
      "Geen GEF-locaties gevonden binnen een straal van {{radius}} km.",
    mapNearbyFiles: "{{count}} GEF-locaties binnen {{radius}} km",
    mapNearbyFilesNone:
      "Geen GEF-locaties gevonden binnen {{radius}} km.",
    mapNearbyFilesMore: "De 12 dichtstbijzijnde locaties worden getoond.",

    // Bore PDF export
    borePdfExportTitle: "GEF-bestanden selecteren en exporteren",
    borePdfExportDescription:
      "Kies een of meerdere BORE-, CPT- of DISS-bestanden. Exporteer de originele GEF-bestanden naar een map of maak per bestand een eigen PDF. Voor PDF kun je hieronder bepalen welke pagina's en grafieken mee moeten.",
    exportSelectedGefFiles: "Exporteer geselecteerde GEF-bestanden",
    exportingGefFiles: "GEF-bestanden worden gekopieerd...",
    gefExportCompleted:
      "{{count}} GEF-bestanden zijn opgeslagen in {{directory}}.",
    gefExportPartiallyCompleted:
      "{{savedCount}} GEF-bestanden opgeslagen in {{directory}}; {{failedCount}} bestanden konden niet worden gekopieerd.",
    gefExportCancelled: "GEF-export is geannuleerd.",
    gefExportFailed: "GEF-export is mislukt.",
    borePdfExportPageOptions: "Kies welke pagina's mee moeten",
    borePdfIncludeSummaryPage: "Samenvatting",
    borePdfIncludePlotPage: "Grafieken / boorstaat",
    borePdfIncludeSpecimensPage: "Monsters",
    borePdfIncludeTechnicalPage: "Technische informatie",
    borePdfGraphSelectionTitle: "Kies specifieke grafieken",
    borePdfGraphSelectionDescription:
      "Alleen de aangevinkte grafieken worden per geselecteerd bestand aan de PDF toegevoegd.",
    borePdfGraphSelectionLoading:
      "Grafiekopties van alle geselecteerde bestanden worden geladen...",
    borePdfNoGraphsAvailable:
      "Voor de huidige bestandsselectie zijn geen grafieken beschikbaar.",
    borePdfExportSelectAtLeastOnePage:
      "Kies minimaal een pagina of grafiek voor de PDF-export.",
    selectAllBorings: "Selecteer alle bestanden",
    selectAllGraphs: "Selecteer alle grafieken",
    clearSelection: "Wis selectie",
    clearGraphSelection: "Wis grafiekselectie",
    selectedBoringsCount: "{{count}} bestanden geselecteerd",
    exportSelectedBoringsPdf: "Exporteer geselecteerde bestanden als PDF",
    exportingBorePdfs: "PDF's worden gemaakt...",
    borePdfExportCompleted: "{{count}} PDF-bestanden zijn geëxporteerd.",
    borePdfExportSavedTo:
      "{{count}} PDF-bestanden zijn opgeslagen in {{directory}}.",
    borePdfExportFailed: "PDF-export is mislukt.",
    borePdfExportCancelled: "PDF-export is geannuleerd.",
    boreSummaryPageTitle: "Boorinformatie",
    cptSummaryPageTitle: "CPT informatie",
    dissSummaryPageTitle: "DISS informatie",
    borePlotPageTitle: "Boorstaat",
    cptGraphPageTitle: "CPT grafiek",
    dissPorePressurePageTitle: "DISS waterspanning",
    dissConeResistancePageTitle: "DISS conusweerstand",
    specimensPageTitle: "Monsters",

    // Footer
    about: "Over",
    contact: "Contact",
    feedbackOrRequests: "Bugs, feedback of verzoeken?",
    needSimilarApp:
      "Heb je een vergelijkbare app nodig voor je geotechnische workflow?",
    contactUs: "Neem contact op",

    // Empty state CTA
    freeToolByBedrock: "Gratis tool van Bedrock.engineer. Wij bouwen:",
    customWebApps: "Webapps op maat voor geotechnische workflows",
    pythonAutomation: "Geotechnische workflow automatisering met Python",
    bimCadIntegrations:
      "Geotechnische data-integratie in BIM software zoals Civil3D, Revit, Rhino3D, en Grashopper",
    emptyStateContact: "Geïnteresseerd?",

    // Disclaimer
    disclaimer:
      "Deze tool is bedoeld voor informatieve doeleinden. Alle geotechnische gegevens dienen te worden geverifieerd door een bevoegd geotechnisch specialist. Aan het gebruik kunnen geen rechten worden ontleend.",

    childGefFiles: "Child GEF bestanden",
    childGefFile: "Child GEF bestand",
    childGefFilesCount: "{{count}} child bestand",
    childGefFilesCount_plural: "{{count}} child bestanden",
    dissTests: "Dissipatie testen:",
    reference: "Referentie",
    description: "Beschrijving",
  },
} as const;


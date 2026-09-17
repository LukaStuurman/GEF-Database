# GEF Viewer Desktop 1.3.0

## Installeren of portable gebruiken

- `GEF Viewer Desktop-1.3.0-x64.exe`: normale Windows-installatie.
- `GEF Viewer Desktop-1.3.0-x64-portable.exe`: portable versie; kan direct worden gestart.

## Nieuw in 1.3.0

- Exporteer alle geselecteerde originele GEF-bestanden rechtstreeks naar een gekozen map.
- De export leest rechtstreeks uit de datasetmap of lokale database en hoeft bestanden niet opnieuw te parsen.
- Bestaande bestanden worden niet overschreven; bij een dubbele naam wordt automatisch `(2)`, `(3)`, enzovoort toegevoegd.
- Nieuwe kaartmodus **Selecteer met punt en straal**.
- Stel een straal in van 0,1 tot 100 km en klik op de kaart om het middelpunt te kiezen.
- De exportselectie wordt vervangen door exact alle GEF-locaties binnen de getekende cirkel.
- Als de straal wordt gewijzigd, worden de cirkel en selectie onmiddellijk bijgewerkt.
- Rechthoekselectie en punt/straalselectie kunnen naast de gewone bestandsselectie worden gebruikt.

De bestaande automatische datasetindex blijft actief. De verpakte app is getest met 9.991 GEF-locaties; alle records werden correct geladen.

## Testresultaten

- Productiebuild geslaagd.
- Originele GEF-export byte-identiek gecontroleerd.
- Dubbele exportnaam gecontroleerd: `bestand.GEF` en `bestand (2).GEF`.
- Punt/straalmodus interactief gecontroleerd met 100 km en 0,1 km.
- Geen browser- of rendererfouten tijdens de UI-test.

## SHA-256

- Installer: `A780695C740B979CC0B8EE0DCCC8A1B11CC9467940F943E5AE72F6BD5D46C18E`
- Portable: `F82DC81D30DF2713D66C9E5ABF25C08E881670E790CD24A7860E4BD9D8ADFBC0`

De uitvoerbare bestanden zijn niet met een uitgeverscertificaat ondertekend. Windows SmartScreen kan daarom bij de eerste start een waarschuwing tonen.


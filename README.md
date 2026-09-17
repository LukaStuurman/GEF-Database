# GEF Database

Windows desktop application for quickly searching, mapping and exporting GEF
(Geotechnical Exchange Format) files.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

The application keeps a fast local index of a configurable backup/dataset
folder. It loads the indexed locations at startup, so thousands of soundings
can be searched without reparsing every file. The map supports both rectangle
selection and point-plus-radius selection, and selected GEF files can be
exported to another folder.

## About

<img src="/public/bedrock.svg" width="300px" alt="Bedrock Logo" />

The source application also contains the original browser viewer and its
visualisation/export components. The Electron desktop shell adds the local
dataset index and Windows file-system integration.

### Supported GEF Types

- [GEF-CPT](https://bedrock.engineer/reference/formats/gef/gef-cpt/)
  - [Basisregistratie Ondergrond Additions](https://www.cptdata.nl/downloads/gef113Releasenotes.pdf)
  - [Databank Ondergrond Vlaanderen Additions](https://www.milieuinfo.be/confluence/display/DDOV/Toelichting+DOV-GEF+formaat)
- [GEF-BORE](https://bedrock.engineer/reference/formats/gef/gef-bore/)
- GEF-DISS

GEF-SIEVE files are not supported.

## Technology stack

- **GEF Parsing**: [`@bedrock-engineer/gef-parser-ts](https://github.com/bedrock-engineer/gef-parser-ts) which uses [gef-file-to-map](https://github.com/cemsbv/gef-file-to-map) and [Zod](https://zod.dev/)
- **Framework**: [React Router v7](https://reactrouter.com/) with Server-Side Rendering
- **Build Tool**: [Vite](https://vite.dev/)
- **Language**: TypeScript (strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Visualization**: [Observable Plot](https://observablehq.com/plot/)
- **Maps**: [Leaflet](https://leafletjs.com/)
- **UI Components**: [React Aria Components](https://react-spectrum.adobe.com/react-aria/)
- **Internationalization**: [i18next](https://www.i18next.com/)

## Getting started

### Prerequisites

- Node.js 20 or higher
- npm

### Local development

```bash
git clone https://github.com/LukaStuurman/GEF-Database.git
cd GEF-Database

npm install

npm run dev
```

The browser app will be available at `http://localhost:5173`.

For the Windows desktop shell, run `npm run desktop:dev`. Create an installer
and portable executable with `npm run dist`.

### Development Commands

```bash
npm run dev        # Start development server with HMR
npm run build      # Create production build
npm run start      # Start production server
npm run typecheck  # Run TypeScript type checking
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

## Project Structure

```
  GEF-Database/
├── app/
│   ├── components/       # React components
│   ├── gef/              # GEF file parsing and schemas
│   ├── locales/          # Translation files
│   ├── middleware/       # Request middleware
│   ├── routes/           # React-router route components
│   └── util/             # Utility functions
├── public/               # Static assets
└── workers/              # Cloudflare Workers
```

## Desktop dataset folder

On first startup the desktop app uses the configured backup folder when it is
available and builds an index of all `.GEF` files. The folder can be changed
from the Dataset folder card in the app. The index is stored in the Windows
application data directory and is reused on subsequent starts.

## Release 1.3.0

Release notes and checksums are in
[`release-v1.3.0/RELEASE-NOTES-v1.3.0.md`](release-v1.3.0/RELEASE-NOTES-v1.3.0.md).
The installer and portable executable were built and verified locally. They
are intentionally kept out of the source tree because each Windows binary is
around 90 MB; attach the two files from the local `release-v1.3.0` folder to a
GitHub Release when distributing installers.

## Deployment

This application can be deployed to various platforms. See [React Router docs on deploying](https://reactrouter.com/start/framework/deploying).

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Run `npm run typecheck`, `npm run lint`, and `npm run knip`, read the warnings and use your best judgement before committing
2. Follow the existing code style
3. Adding tests for new features, or tests for existing code for that matter, is encouraged

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/LukaStuurman/GEF-Database/issues)

[Bedrock](https://bedrock.engineer)


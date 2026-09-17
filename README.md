# Emboss

Emboss is being built to convert short PDF documents into accessible output for blind and
low-vision readers. The v1 pipeline extracts text and simple tables as braille,
and turns supported bar charts and single-series line graphs into tactile,
3D-printable STL geometry. AI is used for perception; deterministic code owns
measurements, geometry, and BANA validation.

The current web UI is still a Next.js scaffold. Later human-review, edit, and
export stages are not yet implemented.

## Development

This project uses npm only.

```bash
npm install
npm run dev
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) after starting the dev
server.

Copy `env.example` to `.env.local` and fill in the required local values before
running the application. Keep `.env.local` private and never commit it.

Available verification commands include:

```bash
npm run test:phase1
npm run test:phase2
npm run test:phase3
```

## Project documentation

- [Agent instructions](AGENTS.md)
- [Task list](TASKS.md)
- [Pipeline](docs/pipeline.md)
- [Phase 2 verification](docs/phase2-verification.md)
- [Phase 3 verification](docs/phase3-verification.md)
- [Compliance report](docs/compliance-report.md)

See the linked documents for architecture, supported scope, data contracts, and
accessibility standards.

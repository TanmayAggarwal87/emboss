# Graph Report - emboss  (2026-09-23)

## Corpus Check
- 154 files · ~76,654 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .brf 15, .stl 4, (none) 2)

## Summary
- 1021 nodes · 2498 edges · 60 communities (56 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `29f86c3e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generate.ts
- createUploadHandler
- table-processing/types.ts
- frontend_prompt.md
- AGENTS.md — Emboss
- document-processing/errors.ts
- frontend-types.ts
- cn
- source-preview.ts
- verify-preview-browser.ts
- components.json
- dependencies
- page.tsx
- compilerOptions
- package.json
- scripts
- ProcessingView.tsx
- lucide-react
- table-processor.ts
- devDependencies
- layout.tsx
- pdf.ts
- BANA Standards Reference — Emboss
- ocr-worker.cjs
- verify-text-processing.ts
- Pipeline — Emboss
- postcss.config.mjs
- ReviewWorkspace.tsx
- TASKS.md — Emboss build plan
- Testing Scope — Emboss v1
- README.md
- 34. EMPTY / ERROR / EDGE STATES
- translateLine
- Emboss — Compliance & Validation Report
- document-processing/types.ts
- B. Pipeline evidence
- Table processing verification
- Text processing verification
- tactile-geometry/upload.test.ts
- 12. Small “How Emboss works” section
- 11. Upload validation states
- 15. Page processing summary
- 36. Responsive behaviour
- NOTES.md — Emboss
- 4. Design tokens
- 2. VERY IMPORTANT visual restrictions
- button.tsx
- format-table.ts
- eslint.config.mjs
- UploadError
- verify-table-processing.ts
- text-processing/upload.test.ts
- runtime.ts
- Tactile3DViewer.tsx
- verify-diagram-extraction.ts
- upload-handler.ts
- COMPONENTS.md — Emboss
- ExportView.tsx

## God Nodes (most connected - your core abstractions)
1. `UploadError` - 47 edges
2. `createUploadHandler()` - 33 edges
3. `validateGeometry()` - 30 edges
4. `openPdf()` - 26 edges
5. `SupabaseJobRepository` - 26 edges
6. `react` - 23 edges
7. `lucide-react` - 22 edges
8. `UploadRateLimiter` - 22 edges
9. `PdfDocumentHandle` - 22 edges
10. `GeometryState` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Export Stage` --references--> `ExportView()`  [INFERRED]
  docs/components.md → src/components/export/ExportView.tsx
- `Review Stage (Phase 6)` --references--> `ReviewActions()`  [INFERRED]
  docs/components.md → src/components/review/ReviewActions.tsx
- `Unsupported type` --references--> `Alert()`  [INFERRED]
  docs/frontend_prompt.md → src/components/ui/alert.tsx
- `Phase 5 — Deterministic geometry processing` --references--> `GeometryState`  [INFERRED]
  docs/pipeline.md → src/lib/tactile-geometry/types.ts
- `34. EMPTY / ERROR / EDGE STATES` --references--> `ProcessingStatus`  [INFERRED]
  docs/frontend_prompt.md → src/lib/document-processing/retry-sessions.ts

## Import Cycles
- None detected.

## Communities (60 total, 4 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.05
Nodes (91): Phase 5 diagram geometry state and element IDs, three, zod, fixtureResponse(), escapeXml(), generateGeometrySafely(), svgAudit(), { values } (+83 more)

### Community 1 - "createUploadHandler"
Cohesion: 0.27
Nodes (10): RetrySessionStore, consumeRequest(), createRetryHandler(), createUploadHandler(), errorResponse(), openDocumentSafely(), sessionResponse(), harness() (+2 more)

### Community 2 - "table-processing/types.ts"
Cohesion: 0.16
Nodes (17): cellText(), coordinates(), covered(), extractTable(), fail(), groupLines(), splitColumns(), textRuns() (+9 more)

### Community 3 - "frontend_prompt.md"
Cohesion: 0.05
Nodes (40): 10. Upload card, 13. Trust / validation callout, 14. PROCESSING SCREEN, 16. Processing failure behaviour, 17. REVIEW SCREEN — MOST IMPORTANT SCREEN, 18. Review header, 19. Region navigator, 1. Design philosophy (+32 more)

### Community 4 - "AGENTS.md — Emboss"
Cohesion: 0.05
Nodes (40): 10. Reference docs, 11. When in doubt, 12. Project-wide config notes, 1. What Emboss is, 2. The one rule that overrides every other decision, 3. Pipeline (follow this order, do not skip stages), 4. Gemini's job is narrower than it looks — two different calls, never blur them, 5. Scope boundaries for v1 — do not silently expand these (+32 more)

### Community 5 - "document-processing/errors.ts"
Cohesion: 0.06
Nodes (35): @google/genai, ref_node_fs, ref_node_timers, DiagramProcessingError, DiagramValidationError, Generate, independentAxis, nullableString (+27 more)

### Community 6 - "frontend-types.ts"
Cohesion: 0.15
Nodes (17): react, ReviewActions(), ReviewActionsProps, RegionTypeBadge(), ReviewStatusBadge(), UnsupportedStateProps, Badge(), badgeVariants (+9 more)

### Community 7 - "cn"
Cohesion: 0.12
Nodes (5): @base-ui/react, class-variance-authority, cn, TabsList(), tabsListVariants

### Community 8 - "source-preview.ts"
Cohesion: 0.21
Nodes (8): GET(), runtime, Entry, getSourcePreviewStore(), shared, SourcePreview, sourcePreviewResponse(), SourcePreviewStore

### Community 9 - "verify-preview-browser.ts"
Cohesion: 0.12
Nodes (16): ref_node_child_process, CdpCaptureScreenshotResult, CdpClient, cdpConnect(), CdpEvaluateResult, CdpGetDocumentResult, CdpMessage, CdpQuerySelectorResult (+8 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @base-ui/react, class-variance-authority, cn, @google/genai, jszip, liblouis, lucide-react (+13 more)

### Community 12 - "page.tsx"
Cohesion: 0.15
Nodes (19): Component Registry, Export Stage, Layout & Navigation, Processing Stage, Upload Stage, Home(), normalizeRegions(), AppHeader() (+11 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 14 - "package.json"
Cohesion: 0.11
Nodes (17): name, private, version, liblouis, react-dom, shadcn, tailwindcss, @tailwindcss/postcss (+9 more)

### Community 15 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, dev, lint, start, test:classification-recovery, test:diagram-extraction, test:document-processing (+11 more)

### Community 16 - "ProcessingView.tsx"
Cohesion: 0.16
Nodes (10): ProcessingViewProps, STAGES, Alert(), AlertDescription(), AlertTitle(), alertVariants, Progress(), UploadDropzoneProps (+2 more)

### Community 17 - "lucide-react"
Cohesion: 0.22
Nodes (9): 27. Request edit interaction, lucide-react, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle() (+1 more)

### Community 18 - "table-processor.ts"
Cohesion: 0.16
Nodes (12): ref_node_module, ref_node_path, ref_node_worker_threads, server-only, RasterizedPage, TextProcessingError, require, BrailleGrade (+4 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+3 more)

### Community 20 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, src_app_globals, geistMono, geistSans, inter, metadata

### Community 21 - "pdf.ts"
Cohesion: 0.24
Nodes (11): mupdf, CLASSIFICATION_RASTER_SIZE, classificationTransform(), validateRasterBox(), MuPdfDocumentHandle, renderClassificationRaster(), BoundingBox, inspectTablePage() (+3 more)

### Community 22 - "BANA Standards Reference — Emboss"
Cohesion: 0.12
Nodes (15): 10. Physical scale computation rule (ties to AGENTS.md §6), 11. Emboss v1 manufacturing profile (not BANA/NLS requirements), 1. Braille cells & general page layout, 2. Size & density minimums (general), 3. Line weight hierarchy (charts), 4. Spacing & clearance rules, 5. Bar charts, 6. Line graphs (single-series only, v1) (+7 more)

### Community 23 - "ocr-worker.cjs"
Cohesion: 0.40
Nodes (4): tesseract.js, { createWorker, OEM, PSM }, { parentPort, workerData }, recognize()

### Community 24 - "verify-text-processing.ts"
Cohesion: 0.25
Nodes (13): ref_node_events, inspectPdf(), { values }, verifyFixture(), getBrailleGrade(), LocalTextRecognizer, TextRegionProcessor, createTextFixture() (+5 more)

### Community 25 - "Pipeline — Emboss"
Cohesion: 0.13
Nodes (15): Classification recovery (Stage 2 follow-up), Cost/token discipline (ties to AGENTS.md §4), Overview, Phase 5 — Deterministic geometry processing, Pipeline — Emboss, Stage 1 — Page raster, Stage 2 — Region classification (Gemini Call Type A), Stage 3a — Text regions (+7 more)

### Community 27 - "ReviewWorkspace.tsx"
Cohesion: 0.36
Nodes (8): Review Stage (Phase 6), BraillePreview(), DocumentOutline(), EditRequestDialog(), RegionNavigator(), ReviewWorkspace(), TablePreview(), ValidationSummary()

### Community 28 - "TASKS.md — Emboss build plan"
Cohesion: 0.15
Nodes (13): Classification reliability follow-up (20, Deferred / not part of this checklist, Phase 0 — Project scaffolding, Phase 1 — Upload, raster, and region classification, Phase 2 — Text region pipeline, Phase 3 — Table region pipeline, Phase 4 — Diagram data extraction, Phase 5 — Deterministic geometry generation + BANA validation (+5 more)

### Community 29 - "Testing Scope — Emboss v1"
Cohesion: 0.17
Nodes (11): Classification recovery verification, Cost/token scope, Diagram scope, Document scope, Explicitly not in v1 testing scope, Phase 4 verification, Processing scope, Review/edit scope (+3 more)

### Community 30 - "README.md"
Cohesion: 0.29
Nodes (4): Development, Emboss, Project documentation, Running the App & Phase 6 Preview UI

### Community 31 - "34. EMPTY / ERROR / EDGE STATES"
Cohesion: 0.32
Nodes (7): Shared & Primitives, 34. EMPTY / ERROR / EDGE STATES, EmptyState(), EmptyStateProps, ErrorState(), UnsupportedState(), ProcessingStatus

### Community 32 - "translateLine"
Cohesion: 0.39
Nodes (3): LouisCapi, translateLine(), allocate()

### Community 33 - "Emboss — Compliance & Validation Report"
Cohesion: 0.29
Nodes (6): A. Physical / BANA specification conformance, C. Known limitations / provisional results, D. What this report explicitly does not claim, Emboss — Compliance & Validation Report, How to use this file (read before editing), Phase 3 braille text-layout evidence (not physical measurements)

### Community 34 - "document-processing/types.ts"
Cohesion: 0.18
Nodes (9): failure(), DiagramData, DiagramExtractor, DiagramProcessor, DiagramRegionResult, PdfDocumentHandle, RegionType, pageFailure() (+1 more)

### Community 35 - "B. Pipeline evidence"
Cohesion: 0.33
Nodes (6): B. Pipeline evidence, Classification recovery evidence (2026-09-17), Phase 4 evidence — 2026-09-17, Phase 5 evidence — 2026-09-17, Phase 6 evidence — 2026-09-18, Scoped phase evidence

### Community 36 - "Table processing verification"
Cohesion: 0.40
Nodes (4): Limitations, Recorded results, Repeatable checks, Table processing verification

### Community 37 - "Text processing verification"
Cohesion: 0.40
Nodes (4): Evidence and limits (2026-09-17), Repeatable diagnostic, Supabase read-back, Text processing verification

### Community 38 - "tactile-geometry/upload.test.ts"
Cohesion: 0.13
Nodes (7): UploadDependencies, CHART_BOX, createDiagramFixture(), CONFIG, process(), request(), TEXT_BOX

### Community 39 - "12. Small “How Emboss works” section"
Cohesion: 0.50
Nodes (4): 01, 02, 03, 12. Small “How Emboss works” section

### Community 40 - "11. Upload validation states"
Cohesion: 0.50
Nodes (4): 11. Upload validation states, File too large, Too many pages, Unsupported type

### Community 41 - "15. Page processing summary"
Cohesion: 0.50
Nodes (4): 15. Page processing summary, Page 1, Page 2, Page 3

### Community 42 - "36. Responsive behaviour"
Cohesion: 0.50
Nodes (4): 36. Responsive behaviour, Desktop, Mobile, Tablet

### Community 43 - "NOTES.md — Emboss"
Cohesion: 0.50
Nodes (3): Entries, How to use this file, NOTES.md — Emboss

### Community 44 - "4. Design tokens"
Cohesion: 0.67
Nodes (3): 4. Design tokens, Radius, Shadows

### Community 47 - "button.tsx"
Cohesion: 0.29
Nodes (6): ImageState, SourcePreview(), ErrorStateProps, Button(), buttonVariants, SelectedFileCardProps

### Community 48 - "format-table.ts"
Cohesion: 0.29
Nodes (11): alignedPages(), formatTable(), FormattedTable, guidePadding(), isNumeric(), validateTablePages(), verticalPages(), wrap() (+3 more)

### Community 49 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 50 - "UploadError"
Cohesion: 0.08
Nodes (27): ref_node_crypto, @supabase/supabase-js, POST(), runtime, handleEdit, POST(), runtime, POST() (+19 more)

### Community 51 - "verify-table-processing.ts"
Cohesion: 0.17
Nodes (15): ref_node_assert, ref_node_test, repository, rows, { values }, DiagramRegionProcessor, openPdf(), TableRegionProcessor (+7 more)

### Community 52 - "text-processing/upload.test.ts"
Cohesion: 0.15
Nodes (11): RFC-5737, getClientIp(), UploadRateLimiter, ClassifiedRegion, PersistedRegion, config, createHarness(), createHarness() (+3 more)

### Community 53 - "runtime.ts"
Cohesion: 0.20
Nodes (11): maxDuration, POST(), runtime, maxDuration, POST(), runtime, GeminiDiagramExtractor, getPhase1Config() (+3 more)

### Community 54 - "Tactile3DViewer.tsx"
Cohesion: 0.22
Nodes (6): Tactile3DViewer, Props, Tactile3DViewer, Tactile3DViewerHandle, View, PreviewMeshHandle

### Community 55 - "verify-diagram-extraction.ts"
Cohesion: 0.22
Nodes (9): ref_node_os, ref_node_process, ref_node_util, bytes, document, extract(), { values }, extractWithValidationRetries() (+1 more)

### Community 57 - "upload-handler.ts"
Cohesion: 0.15
Nodes (13): ClassifiedPage, FailedPage, PageResult, PreparedPage, RetrySession, JobRepository, jobFailed(), readRetryPages() (+5 more)

### Community 58 - "COMPONENTS.md — Emboss"
Cohesion: 0.50
Nodes (3): Anti-duplication checklist (re-check before adding a component), COMPONENTS.md — Emboss, How to use this file

### Community 59 - "ExportView.tsx"
Cohesion: 0.25
Nodes (8): jszip, ExportView(), ExportViewProps, DocumentOutlineProps, EditRequestDialogProps, RegionNavigatorProps, serializeStl(), PersistedRegionItem

## Knowledge Gaps
- **357 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 444 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GeometryState` connect `generate.ts` to `document-processing/types.ts`, `AGENTS.md — Emboss`, `frontend-types.ts`, `UploadError`, `Tactile3DViewer.tsx`, `Pipeline — Emboss`, `ExportView.tsx`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `Pipeline — Emboss` connect `Pipeline — Emboss` to `README.md`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `Phase 5 — Deterministic geometry processing` connect `Pipeline — Emboss` to `generate.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createUploadHandler()` (e.g. with `.now()` and `.release()`) actually correct?**
  _`createUploadHandler()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _357 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `frontend_prompt.md` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
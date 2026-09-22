# Graph Report - emboss  (2026-09-23)

## Corpus Check
- 143 files · ~73,741 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 1, .example 1, .ico 1)

## Summary
- 973 nodes · 2327 edges · 50 communities (47 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- generate.ts
- upload-handler.ts
- document-processing/types.ts
- frontend_prompt.md
- AGENTS.md — Emboss
- document-processing/gemini.ts
- frontend-types.ts
- cn
- source-preview.test.ts
- verify-preview-browser.ts
- components.json
- dependencies
- page.tsx
- compilerOptions
- package.json
- scripts
- ProcessingView.tsx
- EditRequestDialog.tsx
- diagram-extraction/gemini.ts
- devDependencies
- layout.tsx
- schema.ts
- BANA Standards Reference — Emboss
- ocr-worker.cjs
- tactile-geometry/upload.test.ts
- Pipeline — Emboss
- postcss.config.mjs
- ReviewWorkspace.tsx
- TASKS.md — Emboss build plan
- Testing Scope — Emboss v1
- README.md
- 34. EMPTY / ERROR / EDGE STATES
- translateLine
- Emboss — Compliance & Validation Report
- document-processing/errors.ts
- B. Pipeline evidence
- Table processing verification
- Text processing verification
- document-processing/config.ts
- 12. Small “How Emboss works” section
- 11. Upload validation states
- 15. Page processing summary
- 36. Responsive behaviour
- NOTES.md — Emboss
- 4. Design tokens
- 2. VERY IMPORTANT visual restrictions
- button.tsx
- document-processing/prompt.ts
- eslint.config.mjs

## God Nodes (most connected - your core abstractions)
1. `UploadError` - 36 edges
2. `createUploadHandler()` - 33 edges
3. `openPdf()` - 26 edges
4. `react` - 23 edges
5. `validateGeometry()` - 23 edges
6. `lucide-react` - 22 edges
7. `UploadRateLimiter` - 22 edges
8. `PdfDocumentHandle` - 22 edges
9. `getUploadDependencies()` - 20 edges
10. `SupabaseJobRepository` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Export Stage` --references--> `ExportView()`  [INFERRED]
  docs/components.md → src/components/export/ExportView.tsx
- `Review Stage (Phase 6)` --references--> `ReviewActions()`  [INFERRED]
  docs/components.md → src/components/review/ReviewActions.tsx
- `Unsupported type` --references--> `Alert()`  [INFERRED]
  docs/frontend_prompt.md → src/components/ui/alert.tsx
- `Diagram region result (Phase 4)` --references--> `GeometryState`  [INFERRED]
  docs/data-model.md → src/lib/tactile-geometry/types.ts
- `Phase 5 — Deterministic geometry processing` --references--> `GeometryState`  [INFERRED]
  docs/pipeline.md → src/lib/tactile-geometry/types.ts

## Import Cycles
- None detected.

## Communities (50 total, 3 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.06
Nodes (77): Phase 5 diagram geometry state and element IDs, three, fixtureResponse(), escapeXml(), generateGeometrySafely(), svgAudit(), { values }, ExportView() (+69 more)

### Community 1 - "upload-handler.ts"
Cohesion: 0.06
Nodes (48): RFC-5737, @supabase/supabase-js, POST(), runtime, maxDuration, POST(), runtime, maxDuration (+40 more)

### Community 2 - "document-processing/types.ts"
Cohesion: 0.07
Nodes (49): mupdf, server-only, CLASSIFICATION_RASTER_SIZE, classificationTransform(), validateRasterBox(), MuPdfDocumentHandle, renderClassificationRaster(), BoundingBox (+41 more)

### Community 3 - "frontend_prompt.md"
Cohesion: 0.05
Nodes (40): 10. Upload card, 13. Trust / validation callout, 14. PROCESSING SCREEN, 16. Processing failure behaviour, 17. REVIEW SCREEN — MOST IMPORTANT SCREEN, 18. Review header, 19. Region navigator, 1. Design philosophy (+32 more)

### Community 4 - "AGENTS.md — Emboss"
Cohesion: 0.05
Nodes (39): 10. Reference docs, 11. When in doubt, 12. Project-wide config notes, 1. What Emboss is, 2. The one rule that overrides every other decision, 3. Pipeline (follow this order, do not skip stages), 4. Gemini's job is narrower than it looks — two different calls, never blur them, 5. Scope boundaries for v1 — do not silently expand these (+31 more)

### Community 5 - "document-processing/gemini.ts"
Cohesion: 0.15
Nodes (13): @google/genai, ref_node_timers, ClassificationServiceError, classificationResponseSchema, GeminiRegionClassifier, logTokenUsage(), BACKOFF_MS, providerStatus() (+5 more)

### Community 6 - "frontend-types.ts"
Cohesion: 0.15
Nodes (15): ExportViewProps, DocumentOutlineProps, EditRequestDialogProps, RegionNavigatorProps, BoundingBox, DiagramExtractedData, ExtractedData, PersistedRegionItem (+7 more)

### Community 7 - "cn"
Cohesion: 0.07
Nodes (6): @base-ui/react, class-variance-authority, cn, Progress(), TabsList(), tabsListVariants

### Community 8 - "source-preview.test.ts"
Cohesion: 0.14
Nodes (8): GET(), runtime, Entry, getSourcePreviewStore(), shared, SourcePreview, sourcePreviewResponse(), SourcePreviewStore

### Community 9 - "verify-preview-browser.ts"
Cohesion: 0.11
Nodes (17): ref_node_child_process, ref_node_crypto, CdpCaptureScreenshotResult, CdpClient, cdpConnect(), CdpEvaluateResult, CdpGetDocumentResult, CdpMessage (+9 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @base-ui/react, class-variance-authority, cn, @google/genai, jszip, liblouis, lucide-react (+13 more)

### Community 12 - "page.tsx"
Cohesion: 0.15
Nodes (16): Anti-duplication checklist (re-check before adding a component), Component Registry, COMPONENTS.md — Emboss, Export Stage, How to use this file, Layout & Navigation, Processing Stage, Upload Stage (+8 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 14 - "package.json"
Cohesion: 0.11
Nodes (18): name, private, version, jszip, liblouis, react-dom, shadcn, tailwindcss (+10 more)

### Community 15 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, dev, lint, start, test:classification-recovery, test:diagram-extraction, test:document-processing (+10 more)

### Community 16 - "ProcessingView.tsx"
Cohesion: 0.26
Nodes (9): ProcessingViewProps, STAGES, Alert(), AlertDescription(), AlertTitle(), alertVariants, UploadDropzoneProps, JobApiResponse (+1 more)

### Community 17 - "EditRequestDialog.tsx"
Cohesion: 0.23
Nodes (8): 27. Request edit interaction, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle(), Textarea()

### Community 18 - "diagram-extraction/gemini.ts"
Cohesion: 0.18
Nodes (10): ref_node_fs, GeminiDiagramExtractor, Generate, independentAxis, nullableString, responseSchema, extractCallTypeBPrompt(), getCallTypeBPrompt() (+2 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+3 more)

### Community 20 - "layout.tsx"
Cohesion: 0.14
Nodes (10): nextConfig, next, src_app_globals, geistMono, geistSans, inter, metadata, STEPS (+2 more)

### Community 21 - "schema.ts"
Cohesion: 0.20
Nodes (10): extract(), DiagramProcessingError, DiagramValidationError, diagramSchemaBase, extractWithValidationRetries(), fields, independentAxis, label (+2 more)

### Community 22 - "BANA Standards Reference — Emboss"
Cohesion: 0.12
Nodes (15): 10. Physical scale computation rule (ties to AGENTS.md §6), 11. Emboss v1 manufacturing profile (not BANA/NLS requirements), 1. Braille cells & general page layout, 2. Size & density minimums (general), 3. Line weight hierarchy (charts), 4. Spacing & clearance rules, 5. Bar charts, 6. Line graphs (single-series only, v1) (+7 more)

### Community 23 - "ocr-worker.cjs"
Cohesion: 0.40
Nodes (4): tesseract.js, { createWorker, OEM, PSM }, { parentPort, workerData }, recognize()

### Community 24 - "tactile-geometry/upload.test.ts"
Cohesion: 0.06
Nodes (60): ref_node_assert, ref_node_events, ref_node_module, ref_node_os, ref_node_path, ref_node_process, ref_node_test, ref_node_util (+52 more)

### Community 25 - "Pipeline — Emboss"
Cohesion: 0.13
Nodes (15): Classification recovery (Stage 2 follow-up), Cost/token discipline (ties to AGENTS.md §4), Overview, Phase 5 — Deterministic geometry processing, Pipeline — Emboss, Stage 1 — Page raster, Stage 2 — Region classification (Gemini Call Type A), Stage 3a — Text regions (+7 more)

### Community 27 - "ReviewWorkspace.tsx"
Cohesion: 0.18
Nodes (18): Review Stage (Phase 6), lucide-react, react, BraillePreview(), DocumentOutline(), EditRequestDialog(), RegionNavigator(), ReviewWorkspace() (+10 more)

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

### Community 34 - "document-processing/errors.ts"
Cohesion: 0.24
Nodes (8): zod, ClassificationResponse, classifyWithValidationRetries(), parseClassificationResponse(), ClassificationValidationError, ApprovedRegion, ApproveRegion, validResponse

### Community 35 - "B. Pipeline evidence"
Cohesion: 0.33
Nodes (6): B. Pipeline evidence, Classification recovery evidence (2026-09-17), Phase 4 evidence — 2026-09-17, Phase 5 evidence — 2026-09-17, Phase 6 evidence — 2026-09-18, Scoped phase evidence

### Community 36 - "Table processing verification"
Cohesion: 0.40
Nodes (4): Limitations, Recorded results, Repeatable checks, Table processing verification

### Community 37 - "Text processing verification"
Cohesion: 0.40
Nodes (4): Evidence and limits (2026-09-17), Repeatable diagnostic, Supabase read-back, Text processing verification

### Community 38 - "document-processing/config.ts"
Cohesion: 0.40
Nodes (4): geminiEnvironmentSchema, phase1EnvironmentSchema, positiveInteger, Phase1Config

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
Cohesion: 0.27
Nodes (7): ReviewActions(), ReviewActionsProps, ErrorStateProps, Button(), buttonVariants, SelectedFileCardProps, ReviewStatus

### Community 48 - "document-processing/prompt.ts"
Cohesion: 0.70
Nodes (3): extractCallTypeATemplate(), getCallTypeAPrompt(), loadCallTypeATemplate()

### Community 49 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

## Knowledge Gaps
- **349 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 433 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GeometryState` connect `generate.ts` to `Pipeline — Emboss`, `document-processing/types.ts`, `AGENTS.md — Emboss`, `frontend-types.ts`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `Pipeline — Emboss` connect `Pipeline — Emboss` to `README.md`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `Phase 5 — Deterministic geometry processing` connect `Pipeline — Emboss` to `generate.ts`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createUploadHandler()` (e.g. with `.now()` and `.release()`) actually correct?**
  _`createUploadHandler()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `openPdf()` (e.g. with `verify-table-processing.ts` and `verifyFixture()`) actually correct?**
  _`openPdf()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05691985532076908 - nodes in this community are weakly interconnected._
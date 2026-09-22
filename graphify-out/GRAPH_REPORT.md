# Graph Report - emboss  (2026-09-23)

## Corpus Check
- 139 files · ~71,430 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 1, .example 1, .ico 1)

## Summary
- 956 nodes · 2278 edges · 47 communities (43 shown, 4 thin omitted)
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
- source-preview.ts
- verify-preview-browser.ts
- components.json
- dependencies
- page.tsx
- compilerOptions
- package.json
- scripts
- react
- dialog.tsx
- diagram-extraction/upload.test.ts
- devDependencies
- layout.tsx
- BANA Standards Reference — Emboss
- ocr-worker.cjs
- verify-table-processing.ts
- Pipeline — Emboss
- postcss.config.mjs
- ReviewWorkspace.tsx
- TASKS.md — Emboss build plan
- Testing Scope — Emboss v1
- README.md
- 34. EMPTY / ERROR / EDGE STATES
- translateLine
- Emboss — Compliance & Validation Report
- badge.tsx
- B. Pipeline evidence
- Table processing verification
- Text processing verification
- COMPONENTS.md — Emboss
- 12. Small “How Emboss works” section
- 11. Upload validation states
- 15. Page processing summary
- 36. Responsive behaviour
- NOTES.md — Emboss
- 4. Design tokens
- 2. VERY IMPORTANT visual restrictions

## God Nodes (most connected - your core abstractions)
1. `UploadError` - 33 edges
2. `createUploadHandler()` - 33 edges
3. `openPdf()` - 26 edges
4. `react` - 23 edges
5. `lucide-react` - 22 edges
6. `UploadRateLimiter` - 22 edges
7. `PdfDocumentHandle` - 22 edges
8. `validateGeometry()` - 22 edges
9. `getUploadDependencies()` - 20 edges
10. `generateGeometry()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Review Stage (Phase 6)` --references--> `ReviewActions()`  [INFERRED]
  docs/components.md → src/components/review/ReviewActions.tsx
- `Unsupported type` --references--> `Alert()`  [INFERRED]
  docs/frontend_prompt.md → src/components/ui/alert.tsx
- `Diagram region result (Phase 4)` --references--> `GeometryState`  [INFERRED]
  docs/data-model.md → src/lib/tactile-geometry/types.ts
- `Phase 5 — Deterministic geometry processing` --references--> `GeometryState`  [INFERRED]
  docs/pipeline.md → src/lib/tactile-geometry/types.ts
- `Export Stage` --references--> `ExportView()`  [INFERRED]
  docs/components.md → src/components/export/ExportView.tsx

## Import Cycles
- None detected.

## Communities (47 total, 4 thin omitted)

### Community 0 - "generate.ts"
Cohesion: 0.05
Nodes (82): Phase 5 diagram geometry state and element IDs, ref_node_assert, ref_node_test, three, zod, fixtureResponse(), escapeXml(), generateGeometrySafely() (+74 more)

### Community 1 - "upload-handler.ts"
Cohesion: 0.05
Nodes (54): RFC-5737, maxDuration, POST(), runtime, maxDuration, POST(), runtime, GeminiDiagramExtractor (+46 more)

### Community 2 - "document-processing/types.ts"
Cohesion: 0.06
Nodes (50): mupdf, ref_node_module, server-only, CLASSIFICATION_RASTER_SIZE, classificationTransform(), validateRasterBox(), MuPdfDocumentHandle, renderClassificationRaster() (+42 more)

### Community 3 - "frontend_prompt.md"
Cohesion: 0.05
Nodes (40): 10. Upload card, 13. Trust / validation callout, 14. PROCESSING SCREEN, 16. Processing failure behaviour, 17. REVIEW SCREEN — MOST IMPORTANT SCREEN, 18. Review header, 19. Region navigator, 1. Design philosophy (+32 more)

### Community 4 - "AGENTS.md — Emboss"
Cohesion: 0.05
Nodes (38): 10. Reference docs, 11. When in doubt, 12. Project-wide config notes, 1. What Emboss is, 2. The one rule that overrides every other decision, 3. Pipeline (follow this order, do not skip stages), 4. Gemini's job is narrower than it looks — two different calls, never blur them, 5. Scope boundaries for v1 — do not silently expand these (+30 more)

### Community 5 - "document-processing/gemini.ts"
Cohesion: 0.09
Nodes (26): @google/genai, ref_node_fs, ref_node_path, ref_node_timers, extractCallTypeBPrompt(), getCallTypeBPrompt(), ClassificationResponse, classifyWithValidationRetries() (+18 more)

### Community 6 - "frontend-types.ts"
Cohesion: 0.14
Nodes (19): lucide-react, ExportViewProps, DocumentOutlineProps, EditRequestDialogProps, RegionNavigatorProps, ReviewActions(), ReviewActionsProps, RegionTypeBadge() (+11 more)

### Community 7 - "cn"
Cohesion: 0.09
Nodes (6): @base-ui/react, class-variance-authority, cn, Progress(), TabsList(), tabsListVariants

### Community 8 - "source-preview.ts"
Cohesion: 0.21
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
Cohesion: 0.12
Nodes (21): Component Registry, Export Stage, Layout & Navigation, Processing Stage, Upload Stage, Home(), normalizeRegions(), ExportView() (+13 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 14 - "package.json"
Cohesion: 0.09
Nodes (21): eslintConfig, name, private, version, eslint, eslint-config-next, jszip, liblouis (+13 more)

### Community 15 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, dev, lint, start, test:classification-recovery, test:diagram-extraction, test:document-processing (+9 more)

### Community 16 - "react"
Cohesion: 0.25
Nodes (10): react, ProcessingViewProps, STAGES, Alert(), AlertDescription(), AlertTitle(), alertVariants, Textarea() (+2 more)

### Community 17 - "dialog.tsx"
Cohesion: 0.22
Nodes (7): 27. Request edit interaction, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle()

### Community 18 - "diagram-extraction/upload.test.ts"
Cohesion: 0.12
Nodes (16): extract(), DiagramRegionProcessor, failure(), DiagramProcessingError, DiagramValidationError, Generate, independentAxis, nullableString (+8 more)

### Community 19 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+3 more)

### Community 20 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, src_app_globals, geistMono, geistSans, inter, metadata

### Community 22 - "BANA Standards Reference — Emboss"
Cohesion: 0.12
Nodes (15): 10. Physical scale computation rule (ties to AGENTS.md §6), 11. Emboss v1 manufacturing profile (not BANA/NLS requirements), 1. Braille cells & general page layout, 2. Size & density minimums (general), 3. Line weight hierarchy (charts), 4. Spacing & clearance rules, 5. Bar charts, 6. Line graphs (single-series only, v1) (+7 more)

### Community 23 - "ocr-worker.cjs"
Cohesion: 0.33
Nodes (5): ref_node_worker_threads, tesseract.js, { createWorker, OEM, PSM }, { parentPort, workerData }, recognize()

### Community 24 - "verify-table-processing.ts"
Cohesion: 0.07
Nodes (44): ref_node_events, ref_node_os, ref_node_process, ref_node_util, @supabase/supabase-js, bytes, document, { values } (+36 more)

### Community 25 - "Pipeline — Emboss"
Cohesion: 0.13
Nodes (15): Classification recovery (Stage 2 follow-up), Cost/token discipline (ties to AGENTS.md §4), Overview, Phase 5 — Deterministic geometry processing, Pipeline — Emboss, Stage 1 — Page raster, Stage 2 — Region classification (Gemini Call Type A), Stage 3a — Text regions (+7 more)

### Community 27 - "ReviewWorkspace.tsx"
Cohesion: 0.24
Nodes (10): Review Stage (Phase 6), BraillePreview(), DocumentOutline(), EditRequestDialog(), RegionNavigator(), ReviewWorkspace(), ImageState, SourcePreview() (+2 more)

### Community 28 - "TASKS.md — Emboss build plan"
Cohesion: 0.15
Nodes (13): Classification reliability follow-up (20, Deferred / not part of this checklist, Phase 0 — Project scaffolding, Phase 1 — Upload, raster, and region classification, Phase 2 — Text region pipeline, Phase 3 — Table region pipeline, Phase 4 — Diagram data extraction, Phase 5 — Deterministic geometry generation + BANA validation (+5 more)

### Community 29 - "Testing Scope — Emboss v1"
Cohesion: 0.17
Nodes (11): Classification recovery verification, Cost/token scope, Diagram scope, Document scope, Explicitly not in v1 testing scope, Phase 4 verification, Processing scope, Review/edit scope (+3 more)

### Community 30 - "README.md"
Cohesion: 0.22
Nodes (5): This is NOT the Next.js you know, Development, Emboss, Project documentation, Running the App & Phase 6 Preview UI

### Community 31 - "34. EMPTY / ERROR / EDGE STATES"
Cohesion: 0.32
Nodes (7): Shared & Primitives, 34. EMPTY / ERROR / EDGE STATES, EmptyState(), EmptyStateProps, ErrorState(), UnsupportedState(), ProcessingStatus

### Community 32 - "translateLine"
Cohesion: 0.39
Nodes (3): LouisCapi, translateLine(), allocate()

### Community 33 - "Emboss — Compliance & Validation Report"
Cohesion: 0.29
Nodes (6): A. Physical / BANA specification conformance, C. Known limitations / provisional results, D. What this report explicitly does not claim, Emboss — Compliance & Validation Report, How to use this file (read before editing), Phase 3 braille text-layout evidence (not physical measurements)

### Community 34 - "badge.tsx"
Cohesion: 0.43
Nodes (4): UnsupportedStateProps, Badge(), badgeVariants, TableExtractedData

### Community 35 - "B. Pipeline evidence"
Cohesion: 0.33
Nodes (6): B. Pipeline evidence, Classification recovery evidence (2026-09-17), Phase 4 evidence — 2026-09-17, Phase 5 evidence — 2026-09-17, Phase 6 evidence — 2026-09-18, Scoped phase evidence

### Community 36 - "Table processing verification"
Cohesion: 0.40
Nodes (4): Limitations, Recorded results, Repeatable checks, Table processing verification

### Community 37 - "Text processing verification"
Cohesion: 0.40
Nodes (4): Evidence and limits (2026-09-17), Repeatable diagnostic, Supabase read-back, Text processing verification

### Community 38 - "COMPONENTS.md — Emboss"
Cohesion: 0.50
Nodes (3): Anti-duplication checklist (re-check before adding a component), COMPONENTS.md — Emboss, How to use this file

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

## Knowledge Gaps
- **345 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+340 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 429 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GeometryState` connect `generate.ts` to `Pipeline — Emboss`, `document-processing/types.ts`, `AGENTS.md — Emboss`, `frontend-types.ts`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `Pipeline — Emboss` connect `Pipeline — Emboss` to `README.md`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `Phase 5 — Deterministic geometry processing` connect `Pipeline — Emboss` to `generate.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createUploadHandler()` (e.g. with `.now()` and `.release()`) actually correct?**
  _`createUploadHandler()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `openPdf()` (e.g. with `verify-table-processing.ts` and `verifyFixture()`) actually correct?**
  _`openPdf()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _345 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05368671423717295 - nodes in this community are weakly interconnected._
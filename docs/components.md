# COMPONENTS.md — Emboss

Living registry of every reusable frontend component in this repo. **Check this file
before creating any new component.** If something close to what you need already
exists, extend or reuse it — don't create `DiagramPreview2.tsx` next to an existing
`DiagramPreview.tsx` because it was faster than checking. If you do create a new
component, add it here in the same commit/session — this file is only useful if it
stays current.

This is different from `STRUCTURE.md`: that file shows the folder tree. This file
answers "what does this component actually do, and can I reuse it?" — one row per
component, not a file listing.

---

## How to use this file

**Before creating a component:**
1. Search this table for anything with overlapping purpose.
2. If something's close but not quite right, prefer adding a prop/variant to the
   existing component over forking a near-duplicate.
3. If nothing fits, create the new component, then add a row here before considering
   the task done.

**When editing an existing component:**
- Update its row's description if its purpose/props meaningfully changed.
- If you're tempted to add a one-off variant that only one screen will ever use,
  consider whether that logic belongs in the parent screen instead of the shared
  component — shared components should stay genuinely shared.

---

## Component Registry

### Layout & Navigation

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `AppHeader` | `src/components/layout/AppHeader.tsx` | Top application header with brand logo, document title, and live job status | `jobId?: string`, `status?: JobStatus` | Global layout across all workflow steps |
| `WorkflowStepper` | `src/components/layout/WorkflowStepper.tsx` | 4-step progress stepper (Upload → Processing → Review → Export) | `currentStep: 1 \| 2 \| 3 \| 4`, `onStepClick?: (step) => void` | Global layout, top of every stage view |

### Upload Stage

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `UploadDropzone` | `src/components/upload/UploadDropzone.tsx` | Drag-and-drop file upload zone enforcing 7 MB cap and PDF validation | `onFileSelect: (file: File) => void`, `isUploading?: boolean`, `error?: string` | Upload screen, re-upload modals |
| `SelectedFileCard` | `src/components/upload/SelectedFileCard.tsx` | Card displaying selected PDF name, file size, page estimate, and remove action | `file: File`, `onRemove: () => void`, `disabled?: boolean` | Upload screen |
| `UploadFeatures` | `src/components/upload/UploadFeatures.tsx` | Feature highlights explaining BANA compliance, deterministic geometry, braille | None (static presentation) | Upload landing screen |

### Processing Stage

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `ProcessingView` | `src/components/processing/ProcessingView.tsx` | Multi-step live progress indicator tracking rasterization, classification, translation, modeling | `jobId: string`, `onComplete: () => void`, `onError: (err) => void` | Processing screen |

### Review Stage (Phase 6)

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `ReviewWorkspace` | `src/components/review/ReviewWorkspace.tsx` | Top-level review screen with per-region approval, document outline, side-by-side inspection, and export navigation | `regions`, `onApprove`, `onExport`, `approvingRegionId` | Review screen |
| `DocumentOutline` | `src/components/review/DocumentOutline.tsx` | Sidebar outline of all pages and detected regions with type icons and status badges | `regions: RegionSummary[]`, `selectedId: string`, `onSelect: (id) => void` | Review workspace sidebar |
| `RegionNavigator` | `src/components/review/RegionNavigator.tsx` | Previous/Next region navigation bar with counter, type badge, and jump controls | `currentIndex: number`, `totalCount: number`, `onPrev: () => void`, `onNext: () => void` | Review workspace header/footer |
| `SourcePreview` | `src/components/review/SourcePreview.tsx` | Left pane displaying original high-res MuPDF source image crop with zoom/pan and 410 fallback | `cropUrl: string`, `altText: string`, `bbox?: BoundingBox` | Review split-screen |
| `Tactile3DViewer` | `src/components/review/Tactile3DViewer.tsx` | Right pane Three.js WebGL 3D tactile mesh preview with mouse/touch orbit & accessible camera buttons | `geometry: TactileGeometry`, `ariaLabel?: string`, `preserveDrawingBuffer?: boolean` | Review split-screen, export summary |
| `ValidationSummary` | `src/components/review/ValidationSummary.tsx` | Collapsible panel showing deterministic BANA metrics (dimensions, rise, separation, dot pitch) | `validation: BANAValidationResult` | Review inspector |
| `BraillePreview` | `src/components/review/BraillePreview.tsx` | Sighted-accessible braille viewer showing dot representations alongside back-translated plain text | `brailleAscii: string`, `plainText: string` | Text/table region review |
| `TablePreview` | `src/components/review/TablePreview.tsx` | Structured braille table inspector showing columns, guide dots, and header separation | `tableData: BrailleTableResult` | Table region review |
| `ReviewActions` | `src/components/review/ReviewActions.tsx` | Reusable action bar with approve/edit/reject callbacks; the active review workspace currently wires per-region approval and export, while edit/reject remain inactive | `currentStatus`, `onApprove`, `onReject`, `onRequestEdit` | Review workspace action bar |
| `EditRequestDialog` | `src/components/review/EditRequestDialog.tsx` | Modal dialog for sighted reviewers to enter plain-English tactile edit requests (Phase 7 ready) | `isOpen: boolean`, `onClose: () => void`, `onSubmit: (prompt: string) => void` | Review workspace |

### Export Stage

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `ExportView` | `src/components/export/ExportView.tsx` | Individually downloadable approved-region files plus a combined ZIP package | `fileName`, `regions`, `onBack`, `onReset` | Export screen |

### Shared & Primitives

| Component | Path | Purpose | Key Props / Variants | Reusable Contexts |
|---|---|---|---|---|
| `StatusBadge` | `src/components/shared/StatusBadge.tsx` | Color-coded status badge for pending, processing, approved, rejected, warning, error | `status: string`, `size?: 'sm' \| 'md'` | Document outline, headers, lists |
| `ErrorState` | `src/components/shared/ErrorState.tsx` | Structured error display with message, retry button, and troubleshooting tips | `title: string`, `message: string`, `onRetry?: () => void` | Error boundaries, failed regions |
| `EmptyState` | `src/components/shared/EmptyState.tsx` | Neutral placeholder when no item or region is selected | `title: string`, `description?: string`, `icon?: ReactNode` | Empty workspace panels |
| `UnsupportedState` | `src/components/shared/UnsupportedState.tsx` | Clear diagnostic message when a diagram/table exceeds v1 supported scope | `reason: string`, `detectedType: string` | Unsupported region panels |
| `UI Primitives` | `src/components/ui/*.tsx` | Radix-based accessible UI atoms (button, card, dialog, progress, tabs, tooltip, etc.) | Standard variant props | Application-wide |

---

## Anti-duplication checklist (re-check before adding a component)

- [ ] Did I search this file for an existing component with overlapping purpose?
- [ ] If something similar exists, did I consider extending it (new prop/variant)
      before creating a new file?
- [ ] Am I about to build a second version of something because the first felt
      "specific to one screen" — could that actually be a prop instead?
- [ ] Did I add a row here for anything genuinely new before finishing the task?

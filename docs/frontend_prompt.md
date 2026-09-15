You are an expert frontend engineer and product UI designer.

Your task is to design and implement the frontend for **Emboss**, an accessibility-focused web application that converts short educational PDF documents into accessible material for blind and low-vision readers.

Emboss processes PDFs into:

* Braille text
* Braille-compatible tables
* 3D-printable tactile graphics for supported charts

The person using the web application is typically a **sighted teacher, publisher, accessibility volunteer, or transcriber** who reviews the generated accessibility output before it is exported.

The UI must therefore feel:

**Trustworthy, calm, extremely clear, accessible, professional, lightweight, and easy to understand within seconds.**

This is a hackathon project, but the frontend should look like a polished real-world product rather than a stereotypical flashy hackathon dashboard.

---

# 1. Design philosophy

The visual direction should be:

* Light theme only
* Clean
* Minimal
* Functional
* Calm
* Modern SaaS/product UI
* Extremely readable
* Spacious without wasting screen space
* Professional enough for schools, publishers, accessibility organisations, and institutions

Think along the lines of:

**Linear / Vercel / modern Notion / shadcn dashboard cleanliness**

but slightly warmer and more approachable because this is an accessibility-focused product.

DO NOT create a generic AI startup interface.

DO NOT make the interface visually loud.

---

# 2. VERY IMPORTANT visual restrictions

### Absolutely NO gradients.

Do not use gradients anywhere:

* No gradient backgrounds
* No gradient buttons
* No gradient text
* No glowing gradient borders
* No purple/blue AI gradients
* No animated gradient blobs

Also avoid:

* excessive glassmorphism
* neon colors
* giant rounded cards everywhere
* excessive shadows
* excessive animations
* glowing borders
* random illustrations
* unnecessary decorative elements
* huge hero typography
* rainbow AI styling
* overly futuristic interfaces
* gimmicky dashboards
* excessive pill-shaped UI

Emboss should feel like a **serious accessibility tool**, not an AI crypto landing page.

---

# 3. Component system

Use **shadcn/ui components throughout the frontend for consistency**.

Prefer shadcn components such as:

* Button
* Card
* Alert
* Badge
* Progress
* Tabs
* Tooltip
* Dialog
* Sheet
* DropdownMenu
* Separator
* Skeleton
* Textarea
* Input
* ScrollArea
* Accordion
* Breadcrumb
* Sonner / Toast
* AlertDialog

Do not manually recreate components that shadcn already provides.

All shared UI states should use consistent component primitives.

Use **Lucide React** for icons.

Keep icon usage restrained and purposeful.

---

# 4. Design tokens

Use a neutral light color system.

Suggested base:

Background:
`#FAFAFA` or equivalent neutral-50

Primary surfaces:
white

Primary text:
near-black / neutral-900

Secondary text:
neutral-500 / neutral-600

Borders:
neutral-200

Primary accent:
a restrained blue such as blue-600

Success:
emerald/green

Warning:
amber

Error:
red

Information:
blue

Keep the majority of the interface neutral.

Accent colors should primarily communicate **state**, not decoration.

### Radius

Use subtle rounded corners.

Prefer approximately:

`rounded-lg`

Avoid huge `rounded-3xl` containers everywhere.

### Shadows

Use very subtle shadows only when necessary.

Prefer:

border + tiny shadow

rather than floating cards with huge shadows.

---

# 5. Typography

Use a clean sans-serif typeface such as:

* Inter
* Geist
* system sans-serif

Typography hierarchy should be obvious.

Suggested hierarchy:

Page title:
28–32px, semibold

Section title:
18–22px, semibold

Card title:
15–17px, medium/semibold

Body:
14–16px

Metadata:
12–14px

Avoid giant 60–80px marketing headings.

This is primarily a **tool**, not a marketing site.

---

# 6. Overall application architecture

Create the frontend around a simple linear flow:

`Upload → Processing → Review → Export`

The user should ALWAYS understand:

1. Where they are
2. What Emboss is currently doing
3. Whether something succeeded or failed
4. What they need to do next

Do not create a traditional analytics dashboard sidebar because Emboss has no accounts, saved history, or complex navigation.

Prefer a compact top application header.

---

# 7. Global application header

Create a simple sticky or static top header.

Left side:

Emboss logo/icon + `Emboss`

Optional small descriptor underneath or beside it:

`Accessible documents, made tactile`

Right side:

* `How it works`
* `Accessibility`
* optional GitHub button if the existing project supports it

Keep the header around 60–68px tall.

Do NOT add:

* account avatar
* notifications
* fake profile menu
* fake dashboard links
* pricing
* unnecessary navigation

There is intentionally no account/login system.

---

# 8. Workflow stepper

On workflow screens, show a small horizontal stepper underneath the header:

`1 Upload → 2 Processing → 3 Review → 4 Export`

Current step:
strong text + accent indicator

Completed:
checkmark + subtle success styling

Upcoming:
muted

Avoid large wizard UI.

The stepper should quietly orient the user rather than dominate the page.

On mobile, simplify this to:

`Step 2 of 4 · Processing`

---

# 9. LANDING / UPLOAD PAGE

This is the most important first screen.

It should be extremely simple.

Use a centered content container around:

`max-w-5xl`

The opening section should contain:

Small accessibility-oriented badge:

`Built for accessible learning`

Heading:

**Turn visual documents into tactile, accessible material.**

Supporting copy:

`Upload a short PDF and Emboss converts text into braille and supported charts into standards-checked tactile graphics ready for human review.`

Do not over-market it.

Below the introduction, make the **upload area the visual focus**.

---

# 10. Upload card

Create a large centered upload card.

Inside:

PDF/document icon

Heading:

`Upload a PDF`

Secondary text:

`Drag and drop your document here, or choose a file`

Button:

`Choose PDF`

Below it show the actual restrictions clearly:

`PDF only · Up to 3 pages · Maximum 7 MB`

The application only accepts PDFs up to 3 pages and 7 MB, so those limitations should be visible BEFORE someone uploads.

Do not hide them in tooltips.

For drag state:

* slightly darker border
* subtle blue background
* no exaggerated animation

After a file is selected, transform the upload area into a compact file card:

PDF icon

`lesson-material.pdf`

`2 pages · 1.8 MB`

Right side:

* Remove icon
* Change file

Primary CTA:

`Process document`

---

# 11. Upload validation states

Design polished validation states.

Examples:

### Too many pages

Alert:

`This PDF has 5 pages`

`Emboss currently supports documents up to 3 pages. Please upload a shorter document.`

### File too large

`This PDF is larger than 7 MB`

`Please upload a file smaller than 7 MB.`

### Unsupported type

`Only PDF files are supported.`

Use shadcn `Alert`.

Messages must be human-readable.

Never expose raw backend errors to users.

---

# 12. Small “How Emboss works” section

Below the uploader, include a compact three-column explanation.

### 01

`Analyse`

`Emboss identifies text, tables, and supported charts.`

### 02

`Convert`

`Text becomes braille while charts become standards-checked tactile graphics.`

### 03

`Review`

`You verify every generated region before anything can be exported.`

Use small outlined icons.

No large illustrations.

On mobile stack vertically.

---

# 13. Trust / validation callout

Add one understated section explaining why Emboss is trustworthy.

Heading:

`AI interprets. Code validates.`

Description:

`AI helps understand document structure and chart data. Physical dimensions and tactile spacing are calculated deterministically and validated against accessibility rules before review.`

Possible small visual:

AI interpretation
↓
Deterministic layout
↓
BANA validation
↓
Human review

Keep this incredibly clean.

This concept is one of the application's strongest differentiators and should be understandable immediately.

---

# 14. PROCESSING SCREEN

The processing screen should feel active but calm.

Do NOT build a fake terminal.

Do NOT stream meaningless technical logs.

Header:

`Preparing your accessible document`

Subtitle:

`Emboss is analysing each page and generating accessible output.`

Show one main progress card.

Example:

`Processing document`

Progress bar — 62%

`Page 2 of 3`

Then show stages vertically:

✓ Preparing pages

✓ Detecting content regions

● Converting text and tables

○ Generating tactile graphics

○ Running accessibility validation

Use:

* CheckCircle
* LoaderCircle
* Circle

Current action may use a restrained spinner.

---

# 15. Page processing summary

Under the main progress indicator show compact page cards.

Example:

### Page 1

`Completed`

3 text regions
1 chart

### Page 2

`Processing`

Detecting content…

### Page 3

`Waiting`

Use subtle status badges.

Do not show information the backend does not actually know.

---

# 16. Processing failure behaviour

Failure states are extremely important.

Failures can happen to individual pages or regions without destroying the whole document.

Represent that clearly.

For example:

`Page 2 · Chart`

red outlined alert

`We couldn't reliably interpret this chart after several attempts.`

Secondary copy:

`The rest of your document can still be reviewed.`

Possible action:

`Continue to review`

Avoid dramatic full-screen failure states when only one region failed.

---

# 17. REVIEW SCREEN — MOST IMPORTANT SCREEN

This should receive the greatest amount of design attention.

Desktop layout:

top page heading

then two-column workspace

Suggested proportions:

`grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]`

LEFT:

Original document / source region

RIGHT:

Generated accessible output

The user should be able to visually compare both.

---

# 18. Review header

Top:

Breadcrumb-ish context:

`Document / Page 2 / Region 3`

Heading:

`Review generated output`

Supporting line:

`Compare the source with Emboss's accessible version before approving it.`

Right side:

`4 of 7 reviewed`

small progress indicator.

---

# 19. Region navigator

Above the comparison workspace provide a compact region navigation bar.

Example:

`← Previous`

`Region 3 of 7`

Badge:
`Bar chart`

`Next →`

Other region badges could be:

* Text
* Table
* Bar chart
* Line graph
* Unsupported

Do not use tabs for 15 different regions.

Keep navigation simple.

---

# 20. Original document panel

Left card header:

`Original`

Secondary metadata:

`Page 2 · Bar chart`

Card body:

show the cropped source region or PDF preview.

Give it a soft neutral checker/gray backing if needed, but keep it subtle.

Useful controls:

* Zoom out
* Zoom reset
* Zoom in

Use icon buttons with tooltips.

Avoid unnecessary PDF viewer chrome.

---

# 21. Generated output panel

Right card header:

`Tactile preview`

Badge:

`BANA validated`

If validation succeeded, show a subtle green check.

The panel body should contain the actual 3D tactile preview.

Give the 3D model significant space.

Controls can include:

* Rotate
* Reset view
* Zoom
* Fullscreen

Use icon buttons with tooltips.

Avoid a dark 3D viewer if possible.

Prefer a light neutral viewer canvas so the whole product remains visually consistent.

---

# 22. Validation details

Under the tactile preview provide a compact expandable section:

`Accessibility checks`

Default collapsed or summarized.

Summary:

green check icon

`All required tactile rules passed`

Expanded content could show categories such as:

* Minimum spacing
* Braille dimensions
* Bar thickness
* Symbol separation
* Label placement

Do not expose meaningless numerical internals unless they actually help the reviewer.

This should build confidence without overwhelming non-technical users.

---

# 23. Text region review

For text regions, the two panels should instead show:

LEFT:
Original extracted text

RIGHT:
Braille output

Header:

`Braille translation`

Allow good line wrapping and monospaced rendering where appropriate.

Provide:

`Copy braille`

if useful and supported.

Still use the same review shell so the interaction model stays consistent.

---

# 24. Table region review

For supported tables:

LEFT:
Source table

RIGHT:
Braille-formatted table preview

If the table is unsupported because of merged/nested/complex structure, show a clear unsupported state rather than pretending conversion succeeded.

Example:

`This table is too complex for automatic conversion`

`Emboss currently supports simple rectangular tables without merged cells.`

---

# 25. Unsupported chart UI

Emboss only supports:

* Bar charts
* Single-line line graphs

Unsupported types should get a deliberate, polished state.

Example:

icon

`This diagram isn't supported yet`

`Emboss currently supports bar charts and single-line line graphs. This region will not be included in the export.`

Badge:

`Unsupported`

Do not style this like an unexpected application crash.

Unsupported content is an expected product state.

---

# 26. Review actions

At the bottom of the review workspace create a sticky or highly visible action bar.

Three actions:

Secondary destructive:
`Reject`

Secondary:
`Request edit`

Primary:
`Approve`

Use icons sparingly:

X
Pencil
Check

The primary visual hierarchy should be:

Approve > Request edit > Reject

However, do NOT make Reject difficult to find.

After choosing an action, move naturally to the next region.

---

# 27. Request edit interaction

Clicking `Request edit` should open a shadcn `Sheet` or `Dialog`.

Title:

`Request a correction`

Description:

`Describe what should change in this tactile graphic.`

Textarea placeholder:

`For example: move the x-axis label to the left.`

Below the textarea, show subtle helper text:

`Edits are revalidated before they can be approved.`

Buttons:

`Cancel`

`Apply edit`

When processing:

`Applying correction…`

After success:

green small success callout

`Correction applied and validation passed.`

Then show the updated preview.

---

# 28. Invalid edit request

If an edit cannot be performed, display:

`We couldn't apply that correction`

Then the actual human-readable reason.

Examples:

`The instruction refers to an element that doesn't exist in this graphic.`

or

`This type of change isn't currently supported.`

Actions:

`Edit request`

`Cancel`

Never silently guess what the user meant.

---

# 29. Approval status

When a region has been approved, make the status unmistakable but subtle.

Header badge:

green check

`Approved`

When rejected:

neutral/red muted badge

`Excluded`

When awaiting review:

amber/neutral

`Needs review`

When edited and waiting for approval:

blue

`Updated · Needs review`

---

# 30. Review sidebar / document overview

For desktop, optionally include a small document navigation panel if it improves navigation.

Keep it narrow and unobtrusive.

Example:

Page 1

* ✓ Text
* ✓ Text
* ✓ Bar chart

Page 2

* ● Line graph
* ○ Table

Page 3

* ⚠ Unsupported chart

Clicking a region navigates directly to it.

Do not turn this into an enterprise dashboard sidebar.

On mobile, use a Sheet instead.

---

# 31. EXPORT SCREEN

Once every region has been reviewed, transition to a simple completion page.

Use an understated success visual.

No confetti.

No giant animation.

Icon:
CheckCircle

Heading:

`Your accessible document is ready`

Supporting text:

`All regions have been reviewed. Approved content is ready to export.`

---

# 32. Export summary card

Show:

Document:
`lesson-material.pdf`

Then:

`5 approved`

`1 rejected`

`1 unsupported`

Export contents:

* Braille text
* Braille tables
* 2 tactile STL files

Primary CTA:

`Download export package`

Use Download icon.

Below the button:

`Only approved regions are included.`

---

# 33. Privacy message

Since Emboss does not use accounts or persistent storage, communicate that clearly.

Small shield icon.

Heading:

`Your document isn't stored permanently`

Text:

`Emboss keeps this job only for the current workflow. There is no account history or document library.`

Do not exaggerate security claims beyond what the product actually guarantees.

---

# 34. EMPTY / ERROR / EDGE STATES

Design these states deliberately.

Implement reusable components such as:

`EmptyState`

`ErrorState`

`UnsupportedState`

`RegionStatus`

`ProcessingStatus`

`ValidationBadge`

Important states include:

* file too large
* too many pages
* wrong file format
* page processing failed
* region detection failed
* chart interpretation failed
* unsupported chart
* unsupported table
* tactile validation failed
* edit request failed
* export unavailable because regions remain unreviewed
* general network error

Every state should explain:

**What happened**

and

**What the user can do next**

Never show generic:

`Something went wrong`

when a more useful explanation exists.

---

# 35. Accessibility requirements

Because this is literally an accessibility-oriented product, the frontend accessibility quality should be excellent.

Follow WCAG-friendly patterns.

Requirements:

* semantic HTML
* correct heading hierarchy
* keyboard-accessible interactions
* visible focus rings
* sufficient contrast
* form labels
* accessible button labels
* `aria-live` for processing status changes when appropriate
* descriptive error text
* never encode meaning using color alone
* minimum practical touch target sizes
* support browser zoom properly
* no essential hover-only interactions
* respect `prefers-reduced-motion`

Avoid tiny low-contrast gray text.

Accessibility is not optional.

---

# 36. Responsive behaviour

Desktop should be the richest experience because tactile preview comparison benefits from horizontal space.

### Desktop

Original and generated output side-by-side.

### Tablet

Two-column when practical, otherwise stacked.

### Mobile

Stack:

Original
↓
Generated output
↓
Validation
↓
Actions

The action bar can become sticky at the bottom.

Make sure dialogs become mobile-friendly sheets where appropriate.

---

# 37. Motion

Use extremely restrained animation.

Allowed:

* 150–200ms hover transitions
* progress changes
* subtle dialog transitions
* skeleton loading
* gentle spinner

Avoid:

* bouncing elements
* parallax
* animated backgrounds
* text reveal animations
* unnecessary entrance animations
* excessive spring animations

The interface should feel stable.

---

# 38. Suggested component architecture

Create reusable components rather than giant page components.

Possible structure:

```txt
components/
  layout/
    AppHeader
    WorkflowStepper
    PageContainer

  upload/
    UploadDropzone
    SelectedFileCard
    UploadRequirements

  processing/
    ProcessingOverview
    ProcessingStage
    PageProcessingCard

  review/
    ReviewHeader
    RegionNavigator
    SourcePreview
    TactilePreview
    BraillePreview
    TablePreview
    RegionStatusBadge
    ValidationSummary
    ReviewActions
    EditRequestDialog
    DocumentOutline

  export/
    ExportSummary
    ExportContents
    PrivacyNotice

  shared/
    StatusBadge
    ErrorState
    EmptyState
    UnsupportedState
```

Use the existing project architecture if one already exists.

Do NOT restructure working code unnecessarily.

---

# 39. State model

The UI should visually support statuses like:

```ts
type RegionStatus =
  | "processing"
  | "needs_review"
  | "approved"
  | "rejected"
  | "unsupported"
  | "failed"
  | "editing";
```

Do not invent backend fields without checking the existing types/API.

Adapt the UI to the project's actual contracts.

---

# 40. Loading states

Use skeletons rather than layout jumps.

For example:

During source image loading:
rectangular skeleton

During tactile model loading:
viewer skeleton

During region metadata loading:
small text skeletons

Do not block the entire application with a global spinner unless the whole page truly depends on a single request.

---

# 41. Microcopy style

Microcopy should be:

* short
* calm
* specific
* non-technical
* respectful

GOOD:

`This chart couldn't be interpreted reliably.`

BAD:

`AI PROCESSING FAILURE: MODEL JSON RESPONSE INVALID`

GOOD:

`This chart type isn't supported yet.`

BAD:

`Invalid diagram.`

GOOD:

`All tactile checks passed.`

BAD:

`Validation pipeline successful.`

---

# 42. Icons

Use Lucide icons.

Examples:

Upload
FileText
ScanSearch
Table2
ChartColumn
ChartNoAxesCombined
CircleCheck
CircleAlert
TriangleAlert
Download
Eye
Pencil
X
ChevronLeft
ChevronRight
ShieldCheck
Box
Rotate3D
ZoomIn
ZoomOut

Keep icons approximately 16–20px in normal UI.

Do not place an icon on every single piece of text.

---

# 43. Things NOT to build

Do NOT add:

* Login/signup
* User accounts
* Dashboard analytics
* Document history
* Pricing
* Subscription cards
* Fake AI chat panel
* Generic chatbot
* Notifications system
* Social features
* Dark theme
* Admin dashboard
* unnecessary settings
* fake features
* unsupported file types
* persistent document library

Stay faithful to the actual Emboss workflow.

---

# 44. Important product constraints the UI must represent

Emboss currently supports:

* PDF only
* Maximum 3 pages
* Maximum 7 MB
* Text → Braille
* Simple tables → Braille-formatted tables
* Bar charts → tactile graphics
* Single-line line graphs → tactile graphics

Unsupported content should be explicitly surfaced.

Individual region failures should not necessarily destroy the entire document workflow.

Nothing should be exported until all regions have been reviewed.

Rejected regions should be excluded from export.

AI-generated tactile interpretations must be reviewed by a person before export.

---

# 45. Final visual quality bar

The final frontend should feel like:

**a real accessibility product that could comfortably be demonstrated to a teacher, accessibility expert, university professor, publisher, or hackathon judge without explanation.**

A user should be able to open the application and understand what to do within roughly **five seconds**.

The visual hierarchy should make the workflow obvious before they read detailed instructions.

Prioritize:

1. clarity
2. accessibility
3. trust
4. usability
5. visual polish

in that exact order.

Do not chase novelty at the expense of usability.

---

# 46. Implementation instructions

Before writing code:

1. Inspect the existing project structure.
2. Inspect existing routes and components.
3. Inspect the API/types/contracts already present.
4. Reuse existing working logic.
5. Identify the minimum frontend changes necessary.
6. Then implement the new design systematically.

Do not blindly replace existing functionality.

Do not rewrite backend logic.

Do not modify API contracts unless absolutely necessary.

Do not introduce mock functionality where real functionality already exists.

Do not create fake results just to make the UI look complete.

Use real application state whenever available.

---

# 47. Code quality expectations

Write production-quality frontend code.

Keep components:

* focused
* reusable
* readable
* typed
* reasonably small

Avoid:

* giant 800-line page components
* excessive abstraction
* excessive comments
* duplicated Tailwind strings where reusable components make sense
* magic constants
* unnecessary libraries

Use Tailwind CSS cleanly.

Use shadcn's existing design tokens and CSS variables wherever possible.

Do not fight the component system with tons of arbitrary custom CSS.

---

# 48. Final instruction

Treat this as both a **frontend engineering task and a UX design task**.

Do not merely rearrange boxes.

Think carefully about:

* what information matters at each point
* what action the user needs to take
* what could confuse a non-technical teacher
* how errors should be communicated
* how to make comparison/review effortless
* how to make deterministic validation feel trustworthy
* how to keep the product visually calm

The result should be **extremely clean, cohesive, accessible, and immediately understandable**.

Again:

**NO GRADIENTS.**

**LIGHT THEME.**

**USE SHADCN/UI CONSISTENTLY.**

**KEEP IT SIMPLE.**

**MAKE THE REVIEW EXPERIENCE THE STAR OF THE PRODUCT.**

Before declaring the task complete, inspect every major screen at desktop and mobile sizes and fix spacing, overflow, hierarchy, loading states, empty states, errors, and inconsistent component styling.

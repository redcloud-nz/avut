# Structured Documents — exploratory design

**Project:** avut
**Date:** 2026-09-10 00:00
**Source:** brainstorm session (cloud)
**Status:** Exploration. Nothing is committed to; no code, no schema, no issue filed.

A record of a design conversation about a `structured-documents` module and an
AI-assisted briefing training tool built on top of it. Written so the reasoning —
including the parts that were rejected and why — survives to whoever picks this up.

## Idea

A generic **`structured-documents`** org module: documents built from a
data-defined template of named, ordered, individually addressable parts (GSMEACQ
briefings, IAPs, training plans are all just templates). On top of it, an
**AI-assisted briefing trainer** — the model generates the echelon-above briefing,
the trainee writes theirs one level down, and an LLM coach grades it against a
per-org, human-ratified "doctrine block". GSMEACQ ships as seed data, not an enum.

---

## Goal

Two things, in dependency order:

1. **A storage abstraction for structured documents** — documents with a defined
   skeleton of named, ordered parts, where the parts are individually addressable
   rather than being paragraphs inside one blob.
2. **A briefing training tool** built on that abstraction, using an LLM to generate
   practice scenarios and give feedback.

The motivating format is **GSMEACQ**, the standard operational briefing structure:

| Key | Label                      | Notes                                                               |
| --- | -------------------------- | ------------------------------------------------------------------- |
| `G` | Ground                     | Terrain, area, access, boundaries                                   |
| `S` | Situation                  | What has happened; subject/incident picture; weather; hazards       |
| `M` | Mission                    | Single clear statement of the task                                  |
| `E` | Execution                  | Concept of Operations, Groupings & Tasks, Coordinating Instructions |
| `A` | Administration & Logistics | Resources, transport, food/water, medical, timings                  |
| `C` | Command & Communications   | Who leads what; comms plan, channels, schedules, callsigns          |
| `Q` | Questions                  | Confirmation, back-brief, questions from the team                   |

> **Sourcing caveat.** NZSAR's GSMEAC pages
> ([land](https://www.nzsar.govt.nz/training-resources/start/sar-response-management/gsmeac-briefing-land),
> [marine](https://www.nzsar.govt.nz/training-resources/start/sar-response-management/gsmeac-briefing-marine))
> are blocked by the research session's network egress. The table above is
> assembled from search summaries plus the standard SMEAC / five-paragraph-order
> sub-headings. **Verify against NZSAR before this becomes seed data.**

---

## Decisions taken

| Decision            | Choice                                                    |
| ------------------- | --------------------------------------------------------- |
| Module name         | `structured-documents` (not `briefings`)                  |
| Template definition | **Data**, not code — admins author their own templates    |
| Scope               | Generic — GSMEACQ, IAPs, training plans are all templates |
| Home                | New org-scoped module                                     |
| Deliverable         | A GitHub enhancement request (drafted, **not filed**)     |

GSMEACQ becomes **seed data**, not a hardcoded enum. `type = 'GSMEACQ'` is a
foreign key to a template record, not a string literal.

---

## Data model (sketch)

Four models. Names are parallel by design — `…TemplatePart` defines, `…Part` instantiates.

```prisma
model StructuredDocumentTemplate {
  id             String   @id
  organizationId String
  key            String   // "GSMEACQ" — stable machine identifier
  name           String
  description    String
  version        Int      @default(1)
  published      Boolean  @default(false)
  // + tags, properties, status, timestamps

  parts     StructuredDocumentTemplatePart[]
  documents StructuredDocument[]

  @@unique([organizationId, key, version])
  @@map("structured_document_templates")
}

model StructuredDocumentTemplatePart {
  id           String  @id
  templateId   String
  parentPartId String? // self-relation — carries Execution's sub-headings

  key         String          // "G", "S", "M", …
  label       String          // "Ground"
  description String          // author-facing prompt — ALSO the AI prompt scaffold
  sequence    Int             @default(0)
  required    Boolean         @default(true)
  repeatable  Boolean         @default(false)
  contentType PartContentType @default(Prose)
  properties  Json            @default("{}")

  @@unique([templateId, parentPartId, key])
  @@map("structured_document_template_parts")
}

model StructuredDocument {
  id             String @id
  organizationId String
  templateId     String
  templateKey    String  // denormalised — survives template churn, cheap filtering
  authorId       String

  parentDocumentId String?  // the echelon-above briefing this was written against
  origin           DocumentOrigin @default(Human) // Human | AiGenerated | Reference

  title          String
  documentStatus String @default("Draft")
  // + tags, properties, status, timestamps

  parts StructuredDocumentPart[]

  @@index([organizationId, templateKey])
  @@map("structured_documents")
}

model StructuredDocumentPart {
  id           String  @id
  documentId   String
  templatePartId String?
  parentPartId String?

  partKey     String // denormalised — readable if its template part is edited/removed
  sequence    Int    @default(0)
  content     String @default("")   // Prose lives here
  contentData Json   @default("{}") // Fields/Table live here
  properties  Json   @default("{}")

  @@map("structured_document_parts")
}
```

Plus grading and provenance (see _AI layer_ below): per-document and **per-part**
grades, prompt/doctrine versions, and a generation record.

### Why parts as rows, not one JSON blob

This is the load-bearing decision. Four things depend on it:

- **Addressability** — feedback, rubric scores and review comments hang off a
  specific part ("the Mission of document X"), not a paragraph offset in a blob.
- **Completeness checks** — "which required parts are empty?" is a join, not a parse.
- **Comparison** — diffing a trainee's Mission against a reference answer's Mission
  needs both to be first-class rows.
- **Corpus queries** — "every Mission statement written this year" becomes possible.

With content as `Json` on the document, every one of those becomes application-side parsing.

### Why the part tree self-references

**Execution is the existence proof.** Every other GSMEACQ part is flat; Execution
is two levels deep (Concept of Operations / Groupings & Tasks / Coordinating
Instructions). Without a parent self-relation you only need an ordered list.

Follows the existing `FormInstanceItem.parentItemId` precedent.

---

## The `contentType` discriminator

A tagged union on the **template part**, declaring what the corresponding document
part holds. Four consumers branch on it:

| Consumer   | Uses it to decide                                              |
| ---------- | -------------------------------------------------------------- |
| Editor     | Which widget to render                                         |
| Storage    | Whether the answer lands in `content` or `contentData`         |
| Validation | What "complete" means                                          |
| AI layer   | How to serialise into a prompt, and what needs no model at all |

**Values:**

- **`Prose`** — free markdown. The content _is_ the answer; quality is a judgement call.
- **`Group`** — holds no content, only children. Execution. Without this the editor
  renders a textarea under "Execution" and authors split content unpredictably
  between the parent box and its sub-headings — which wrecks per-part grading,
  because "Coordinating Instructions are thin" is wrong when half of them were
  typed into the box above.
- **`Fields`** _(later)_ — a fixed set of typed named fields. IAP header block.
- **`Table`** _(later)_ — repeating typed rows. IAP comms plan; training plan sessions.
- **`Reference`** _(later)_ — points at a real AVUT record (`Person`, `Team`).
  An IAP resource assignment should reference actual personnel, not retyped names.
  This is what makes the engine worth building _inside AVUT_ rather than in a Google Doc.

### It also partitions model work from code work

- A `Prose` part needs an LLM — "is this Mission clear and traceable to the parent's tasking?"
- A `Table` part mostly doesn't — "row 3 has no frequency" is a `for` loop.
  Deterministic, instant, free, 100% reliable.

Without the discriminator everything is prose, everything goes to the model,
including checks code does perfectly. Worse on cost, latency _and_ correctness.

### Why it goes in on day one

Not because of migration cost — an enum column with a `Prose` default backfills
trivially, and Postgres takes new enum values cheaply.

**Because of code shape.** Without it, v1 writes `part.content` in every read path,
a textarea in every editor, string concat in every prompt builder, and
`content !== ""` in every validator. Those assumptions spread across router,
editor, renderer, export and prompt-builder. Retrofitting a union into code that
assumed a scalar is the expensive part.

Having the column from the start forces v1 to be written as an exhaustive switch
with one meaningful arm. The second arm is then purely additive.

**Recommendation:** ship the enum with `Prose` and `Group` only. Add the rest when
a real IAP forces it.

### The line to hold

`properties` carrying a field schema starts a mini schema language. Keep it anaemic:
a small closed set of types and nothing else.

Explicit non-goals: **no conditional visibility, no computed fields, no cross-field
validation rules, no per-field permissions.** Any one of those commits you to
building and maintaining a form builder.

---

## The AI layer

### Flow 1 — write a briefing

No AI. Structured editor over the template. Ship first; it is the substrate
everything else grades.

### Flow 2 — practice against the echelon above

The AI produces the **echelon-above** briefing; the user writes theirs at their level;
the AI gives feedback.

This is the strongest idea in the design, and stronger than it first appears:
**it makes the task well-posed.** "Write a GSMEACQ" is unconstrained and
ungradeable — feedback collapses into generic prose coaching. "Here is your IC's
GSMEACQ, write your team's" anchors both the model and any human grader:

- the child's Mission must trace to a line in the parent's Groupings & Tasks
- boundaries must sit inside the parent's Ground
- comms must be consistent with the parent's Command & Communications

Those are checkable. This is one-up-one-down, and it is the difference between
feedback that works and plausible mush.

**Schema consequence:** the parent briefing is itself a `StructuredDocument` →
`parentDocumentId` + an `origin` discriminator (`Human` / `AiGenerated` / `Reference`).

> Don't overload `parentDocumentId` for document _composition_ (an IAP is a set of
> documents for an operational period). Derivation and containment are different relations.

### Routing — Vercel AI Gateway

Sensible: repo has **zero** AI dependencies today, and `@vercel/edge-config` is
already present. Gateway gives one key across providers, unified spend,
per-project observability, priority-list failover, and `@ai-sdk/gateway` drops
into the AI SDK.

**Verify in a spike before committing:** does provider-specific **prompt caching
pass through the gateway cleanly?** The system prompt + rubric + org context is a
stable prefix reused on every grading call, and cached reads are ~10% the cost of
fresh input. If the abstraction strips `cache_control`, the biggest cost lever is gone.

Also: the gateway reports spend per _Vercel project_. **Per-organisation
attribution must be recorded by us.**

### Cost is not the constraint

A GSMEACQ is short. Per graded briefing on the most expensive model
(Opus 5, $5/$25 per MTok): ~2K tokens rubric + org context, ~1K briefing,
~800 output ≈ **3.5¢**, under 1.5¢ once the prefix caches. Cheaper models exist
but barely matter at this volume.

Note: minimum cacheable prefix is 512–4096 tokens depending on model; a too-short
prefix silently won't cache. Keep the stable block meaty.

**The real constraints are graded-data volume and eval discipline.**

### Prompt optimisation — the sequencing that matters

The plan was: humans grade AI- and human-written briefings → AI reads the graded
corpus → AI generates prompts. This works (it is DSPy's `MIPROv2` / `GEPA` line of
work) but has a trap.

**You cannot optimise a prompt without an eval.** The graded corpus's highest-value
uses are, in order:

1. **An eval set** — held-out graded briefings to score candidate prompts against.
   Without it, "AI writes prompt → AI grades output → AI rewrites prompt" is
   unfalsifiable and will converge on something that scores well and teaches badly.
2. **Few-shot examples** — usually the biggest single quality jump, cheaper and
   more predictable than instruction optimisation.
3. **The rubric itself** — human grades reveal what this org actually cares about.

Steps 1–3 give most of the value. Automated instruction optimisation is step 4 and
may never be worth it.

### Critique beats scoring — and it changes the volume maths

A 1–5 rating is ~2 bits. _"You keep putting hazards under Situation — our teams read
Ground first off the vehicle, so hazards go in Ground"_ is an extractable rule.

This is GEPA's finding: reflective natural-language feedback outperforms
scalar-reward optimisation at a fraction of the rollouts. **The "hundreds of graded
examples" concern applies to numeric grades, not written critique.** Ten to twenty
critiques from a genuinely expert briefer can move a prompt. Per-org is viable.

### Optimise the org doctrine block, not the prompt

The highest-value output of the critique loop is not a better prompt — it is an
explicit, human-readable **org doctrine block**:

> In this org, hazards belong in Ground, not Situation. The RV is named in
> Admin & Logistics, not Command. Every Coordinating Instructions section states a
> bail-out trigger. Boundaries use grid references, not place names.

Keep the base prompt shared, stable and cached; let the loop learn _that block_ per org:

- an admin can read it and argue with it; a training committee can ratify it
- it survives model and prompt changes
- it stays small
- it slots into the cache layout cleanly: shared prompt → org doctrine → the briefing

For a SAR org this matters more than usual — doctrine is contested and must be
auditable. _"The AI marked me down because of an opaque optimised prompt"_ is a bad
conversation. _"Because our doctrine block says hazards go in Ground, ratified by
the training officer in March"_ is a fine one.

### Two artefacts get critiqued — keep them apart

| Critique target                      | Tunes               | Question being asked                                               |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| The generated echelon-above briefing | the **generator**   | Is this realistic for our terrain, resourcing, comms?              |
| The feedback on a trainee's briefing | the **coach/judge** | Was that mark fair? Did it miss something? Too harsh for a novice? |

Conflating them is the most likely practical mistake, and it fails quietly —
critiques about scenario realism leak into the grading prompt and distort marks.

### Guardrails

- **Never auto-apply.** Batch N critiques, run one consolidation pass proposing a
  new doctrine version as a **diff** with a stated rationale, require admin approval.
  Silently drifting prompts in a safety-adjacent training tool are bad news.
- **Keep ~10–15 frozen (briefing → acceptable feedback) pairs** as a _regression_
  set — much smaller than a training set. Without it, round N+1 fixes this month's
  reviewer's complaint and quietly breaks what last month's reviewer liked.
- **Budget the doctrine block's size.** Otherwise thirty rounds accrete
  contradictory special-cases encoding one grumpy person's preferences on one Tuesday.
- **Record who wrote each critique.** An experienced briefer and a keen new member
  both arrive as text; you'll want to weight or discount later.

### Provenance chain

```
doctrine/prompt version → generation (model, version, tokens, cost)
                        → critique (author, target, text)
                        → proposed next version (derivedFrom, rationale, approvedBy, approvedAt)
```

Every AI output traceable to the doctrine version that produced it; every doctrine
version to the critiques that justified it.

---

## Relationship to `FormInstance`

An earlier characterisation — "a generic form engine that got stuck at one
consumer" — **was wrong on the facts.** Corrected after reading the code.

### What it actually is

The form _definition_ isn't data at all: `src/forms/i3-issue-items/schema.ts` is a
Zod schema in code, and there is no form-definition table anywhere.
`FormInstance` is a **draft-state store plus submission record for hardcoded forms**:

- **Auto-save** — `src/lib/collections/form-instances.ts` wires a TanStack DB
  collection (`syncMode: "on-demand"`, optimistic `onInsert`/`onUpdate`) flushing
  to `forms.saveFormInstanceData`.
- **Submission record** — `formData` persists; `i3.submitIssueItemsForm`
  (`i3-router.ts:243`) saves the instance then runs `I3IssueItemsFormProcessor`.
- `FormInstanceItem` + `collectionKey` + self-nesting handles the repeating
  sub-collection (items being issued).
- `FormProcessingPipeline` (`src/server/form-processor.ts`) is the best-built thing
  in the area — typed accumulating stage outputs, conditional stages, per-stage
  timing and error capture — and flips the instance to `Processed` on a clean run.

**No half-built form builder was built. One was deliberately not built**, and what
exists instead is sound.

### The boundary

The distinction is **purpose**, not data shape:

|                     | `FormInstance`                     | `StructuredDocument`                |
| ------------------- | ---------------------------------- | ----------------------------------- |
| Definition lives in | code (Zod)                         | data (template)                     |
| Point of the thing  | capture → **trigger side effects** | capture → **be read**               |
| Lifecycle           | draft → submitted → inert          | draft → final → revised, long-lived |
| Read later by       | audit / debug                      | humans, and the AI coach            |

**A form is an input to a process; a document is the artefact.** A GSMEACQ isn't
submitted to make something happen — it's written to be read, briefed from, and graded.

### The rule to write down

> Structured-document templates define things humans author and read. They never
> grow submission-side-effect processing. The moment a template needs "on submit,
> create equipment in D4H and email the QM", that's a form — hardcoded Zod schema,
> processor pipeline, `FormInstance` side.

Separate by purpose, not by data shape — the shapes will converge, the purposes won't.

### Two things to reuse rather than rebuild

1. **The autosave collection pattern.** Structured-documents needs part-level
   autosave; this is a working implementation. Factor the common bits when adding
   the second consumer.
2. **`FormProcessingPipeline`.** The AI flows _are_ staged pipelines — resolve
   template → assemble prompt → call gateway → parse → validate → persist → record
   cost. Conditional stages and per-stage error capture are exactly right. It is
   `server-only` and takes a `formInstanceId` purely for logging, so generalising
   it to any instance id is a small change to a genuinely reusable asset.

---

## Findings in existing code

Discovered while reading `FormInstance`. Not part of this design; worth their own issues.

1. **`I3IssuedItem` is an unused table.** Nothing writes it — the only references
   are `system-admin-router.ts` counting rows and a label in the admin UI. The
   durable record of "who got what gear" lives in D4H, an email to
   `delivered+i3-notify@resend.dev`, and the `FormInstance.formData` blob. Decide:
   wire it up, or drop it.

2. **Submission retry is not idempotent.** `CreateEquipmentInD4H` loops
   `POST /v3/{context}/{contextId}/equipment` per item. If item 4 of 5 throws, the
   pipeline returns early, status stays `Draft`, the draft stays in the user's list —
   and resubmitting re-creates items 1–3 in D4H. Real duplicate-equipment risk on a
   flaky network. Needs per-item idempotency or a D4H-side dedupe key.

3. **Dead filter in the collection.** `form-instances.ts:21` builds `queryParams`
   with a `formStatus` key and passes it to `listDraftFormInstances`, whose input
   schema is `z.object({ formKey: z.string() })`. Zod strips unknown keys, so it is
   silently ignored. Harmless today (the procedure hardcodes `formStatus: "Draft"`),
   but misleading to anyone trying to list processed instances.

---

## Open questions

1. **Versioning.** This recurred four times — document templates, prompts, doctrine
   blocks, and admin edits to a template with 200 live documents against it.
   **Settle on one versioning approach and apply it consistently** rather than
   solving it three ways. Note `src/lib/diff.ts` was reworked in
   `2026-09-09-change-diff-rework` and may be relevant.
2. **Template ownership.** GSMEACQ and ICS-derived IAPs are standards no single org
   should re-key. Org-scoped and seeded per org? System-level with org override? Or
   reuse the `SkillPackage` authored/`published`/subscribed pattern — which has now
   come up three times and may deserve to be a shared primitive.
3. **Author identity.** `User` (as `Note.authorId`) or `Person` (as `SkillCheck`)?
   Operational briefings and assessment both lean `Person`; authoring leans `User`.
4. **Composite documents.** An IAP is a set of documents over an operational period,
   assembled by multiple contributors. Needs a containment relation distinct from
   `parentDocumentId`.
5. **Admin-authored templates are untrusted input.** Part-key uniqueness, tree depth,
   cycle prevention in the self-relation, max parts per template — all now need
   validation a hardcoded GSMEACQ never did.
6. **Permissions split.** Creating a document is a member activity; defining a
   template is an admin one. Two subjects, and probably a `document-template-author`
   role mirroring `skill-package-author`.
7. **Verify the GSMEACQ part list against NZSAR** before seeding (see caveat above).

---

## To re-check before implementing

`master` moved during this conversation (`00e6dbc` → `50ad0fc`). Three changes bear
on the above:

- **Module gating is now two layers.** `src/lib/module-flags.ts` +
  `src/server/module-flags.ts`: a module needs its Vercel flag on for the
  environment **and** the per-org `settings.modules.<id>.enabled` opt-in. `i3` and
  `notes` are flagged so far. A new module must satisfy both.
- **The audit log was rewritten.** `OrganizationLogEntry` → `LogEntry` / `LogBatch` /
  `LogEntryObject`, with `src/server/log-entry.ts` and a closed `Operations`
  vocabulary in `src/lib/operations.ts`. Never write `prisma.logEntry.create` by
  hand. See `docs/superpowers/specs/2026-09-08-unified-audit-log-design.md`.
- **`src/lib/diff.ts` reworked** — see open question 1.

---

## Suggested delivery order

1. Schema + migration + branded IDs + Zod schemas.
2. `structured-documents-router.ts` with router tests.
3. GSMEACQ seeded as the first template (after NZSAR verification).
4. Minimal authoring UI: part-by-part editor driven by the template, with each
   part's `description` shown as the author prompt.
5. _(Separate)_ the AI generator + coach.
6. _(Separate, maybe never)_ automated doctrine optimisation.

A drafted GitHub enhancement request covering steps 1–4 exists but has **not** been
filed, pending the decisions above.

# AI-Assisted Development Workflow

This document defines how AI-assisted development must work in this project. It applies to every task — from a one-line fix to a full feature build. There are no exceptions.

---

## The Single Non-Negotiable Rule

**No code is written until a plan has been proposed and explicitly approved.**

This means:
- The AI reads the request, asks clarifying questions if needed, and produces a written plan
- The plan is presented to the developer for review
- The developer approves, rejects, or revises the plan
- Only after receiving clear approval does the AI write any code, create any file, or make any edit

"I'll go ahead and..." is not permitted. "Here's the plan — does this look right?" is the required posture.

---

## Why This Workflow Exists

Unplanned AI code generation creates predictable problems:

- **Scope creep.** The AI solves a slightly different problem than the one asked for and the developer only notices after reviewing a large diff.
- **Architecture drift.** Code is generated that conflicts with existing patterns in `docs/ui.md`, `docs/auth.md`, or the project's service layer without the conflict being flagged first.
- **Wasted review time.** The developer has to reverse-engineer intent from generated code rather than approving intent upfront.
- **Silent assumptions.** The AI makes a technology or design choice the developer would have vetoed if asked first.

A plan surfaces all of these issues before a single line of code exists. The cost of revising a plan is near zero. The cost of revising generated code is not.

---

## The Workflow — Step by Step

### Step 1 — Read before anything else

Before forming a plan the AI must read:

1. All files in `/docs` that are relevant to the request (see `CLAUDE.md` for the lookup table)
2. Every existing file that the implementation will touch or depend on
3. Any adjacent files needed to understand current patterns — e.g. an existing route if adding a new one, an existing service function if adding another

The AI must not rely on assumptions about what a file contains. If it is relevant, it is read. This step is never skipped, even for small changes.

---

### Step 2 — Ask clarifying questions (if needed)

If the request is ambiguous, incomplete, or could be interpreted in more than one way, the AI asks targeted questions before producing a plan. Questions should be specific and minimal — only what is genuinely needed to produce a correct plan.

Examples of when to ask:

| Situation | Question to ask |
|---|---|
| The request mentions a feature not described in any `/docs` file | "This feature isn't covered by the current UI or auth spec. Should I follow the existing HeroUI patterns or is there a different approach in mind?" |
| The request could touch auth but it's unclear | "Should this route be protected? And should the data be scoped to the signed-in user?" |
| Two approaches have meaningfully different trade-offs | "This could be a server component with a direct DB call, or a client component hitting an API route. The server component is simpler but won't update without a full page load — which fits better?" |
| The scope is unclear | "Does this include the mobile layout, or just the desktop view for now?" |

The AI does not ask about things that are already specified in `/docs`. If the answer is in the documentation, the AI uses it.

---

### Step 3 — Produce a written plan

The plan is the core deliverable of this step. It must be complete enough that the developer can evaluate it without needing to mentally simulate the code. A plan that requires imagination to fill in gaps is not ready.

#### Required plan sections

**1. Summary**
One or two sentences describing what will be built and why.

**2. Docs consulted**
An explicit list of the `/docs` files read and any constraints they impose on this implementation.

**3. Files to create**
A table listing every new file, its path, and its responsibility.

| File | Responsibility |
|---|---|
| `app/(app)/expenses/page.tsx` | Server component — fetches expenses, renders `ExpensesView` |
| `lib/services/expenseService.ts` | Adds `deleteExpense(id, userId)` |

**4. Files to modify**
A table listing every existing file that will change and exactly what will change in it. Be specific — "add a `deleteExpense` export" is acceptable; "update the service file" is not.

| File | Change |
|---|---|
| `app/api/expenses/route.ts` | Add `DELETE` handler; reads `id` from query param, `userId` from session |
| `types/models.ts` | No changes needed |

**5. Architecture decisions**
A short description of every non-trivial decision made in the plan, with the reasoning. This is where the AI flags trade-offs and explains choices that could reasonably have gone a different way.

Examples:
- "The delete is handled in a server action rather than an API route because there is no need for a reusable endpoint — only this page will trigger it."
- "The category filter uses a multi-select `Select` rather than a `Chip` group because the `Select` is already in the HeroUI inventory in `docs/ui.md` and the `Chip` group would require custom interaction logic."

**6. Auth & data ownership**
Explicitly state how the implementation satisfies the rules in `docs/auth.md`. If the feature does not touch auth or user-scoped data, state that explicitly.

Examples:
- "Session is read via `requireSession()`. `user_id` on the new expense is sourced from `session.user.id`. The delete query includes `.eq('user_id', session.user.id)`."
- "This is a UI-only change to a static layout. No user-scoped data is accessed."

**7. Out of scope**
An explicit list of things the plan does not include. This prevents the developer from assuming something is covered when it is not, and prevents the AI from gold-plating.

Examples:
- "Optimistic UI updates — the list will refetch after delete."
- "Bulk delete — only single-row delete is in scope."
- "Mobile layout — will be addressed in a follow-up."

---

### Step 4 — Wait for approval

After presenting the plan, the AI stops and waits.

It does not:
- Begin writing code "while waiting"
- Generate partial files as "a starting point"
- Produce pseudocode that is "almost code"
- Offer to "get started on the easy parts"

It waits for one of three responses:

| Response | What it means | What the AI does next |
|---|---|---|
| **Approved** / "looks good" / "go ahead" / "yes" | Plan is accepted as written | Proceed to Step 5 |
| **Approved with changes** / "do X instead of Y" | Plan is accepted with stated modifications | Confirm the revised plan in a single sentence, then proceed to Step 5 |
| **Rejected** / "no" / "let's try a different approach" | Plan is not accepted | Return to Step 2 or Step 3 with the new direction |

If the developer's response is ambiguous — e.g. "that seems fine but I'm not sure about the server action part" — the AI treats this as a revision request and resolves the uncertainty before proceeding.

---

### Step 5 — Implement

With an approved plan, the AI implements exactly what was described. It does not:

- Add features, helpers, or abstractions not listed in the plan
- Refactor or "clean up" files it happens to open
- Change naming conventions from what the plan described
- Add comments, docstrings, or type annotations to code it did not write
- Make "while I'm here" improvements

If during implementation the AI discovers that the plan was wrong — a file doesn't exist, an API works differently than expected, a type conflict makes the approach unworkable — it **stops**, describes the problem, proposes a revised approach, and waits for approval before continuing. It does not silently adapt.

---

### Step 6 — Report back

After implementation is complete, the AI gives a brief summary:

- Which files were created or modified
- Any deviation from the approved plan (there should be none, but if there was, it must be stated explicitly)
- Any follow-up work that is now obviously needed but was out of scope

This summary is factual and brief. It is not a sales pitch for the code that was written.

---

## Plan Format — Quick Reference

Use this template for every plan.

```
## Plan: [feature name]

**Summary**
[1–2 sentences]

**Docs consulted**
- docs/ui.md — [relevant constraint]
- docs/auth.md — [relevant constraint]

**Files to create**
| File | Responsibility |
|---|---|
| path/to/file.tsx | ... |

**Files to modify**
| File | Change |
|---|---|
| path/to/file.ts | ... |

**Architecture decisions**
- [Decision and reasoning]
- [Decision and reasoning]

**Auth & data ownership**
[How docs/auth.md rules are satisfied, or why they don't apply]

**Out of scope**
- [Item]
- [Item]

---
Waiting for approval before writing any code.
```

---

## Scope Boundaries

Plans must not exceed the scope of the request. The following are common ways scope creeps in and must be actively avoided.

| Creep pattern | Example | Correct behaviour |
|---|---|---|
| Fixing adjacent issues | "While I'm in the service file, I'll fix the error handling in the other functions" | Only touch what the plan lists |
| Future-proofing | "I'll add a `limit` param now in case pagination is needed later" | Build only what is needed now |
| Unsolicited refactors | "The existing route handler is a bit verbose so I'll clean it up" | Leave it as-is unless the plan says otherwise |
| Expanding the feature | "I'll also add the edit flow since it's similar to the add flow" | Stop at what was asked |

If the AI notices a genuine bug or problem in code it reads, it flags it in the plan's **Out of scope** section. The developer decides whether to address it now or later. The AI does not fix it silently.

---

## Handling Conflicts with `/docs`

If a request conflicts with a specification in `/docs`, the AI must flag it before forming a plan.

The flag must include:
1. What was requested
2. Which doc it conflicts with and why
3. Two options: follow the doc as written, or update the doc first

The AI does not silently resolve the conflict in favour of either side. It does not implement the request while "noting" the conflict. It stops and surfaces it.

Example:

> "This request asks for a custom-styled progress bar. `docs/ui.md` specifies that no custom CSS or custom UI primitives are used — all components must be from the HeroUI inventory, and HeroUI does not include a Progress Bar component. Two options:
> 1. Represent the same data using a HeroUI component that exists — e.g. a `Chip` with a percentage value or a `Table` row.
> 2. Update `docs/ui.md` to add a justified exception for this component first.
>
> Which would you prefer before I plan the implementation?"

---

## What Does Not Require a Plan

Small, unambiguous, fully self-contained changes do not require a full plan. The AI may proceed directly if all of the following are true:

- The change touches **one file only**
- The change is **ten lines or fewer**
- The intent is completely unambiguous (a typo fix, a label rename, a missing `null` check)
- The change does not touch any auth logic, data access, or routing

Even in these cases, the AI describes what it is about to do in a single sentence and waits for a nod before editing. It does not silently make the change.

---

## Summary of Obligations

| Obligation | When |
|---|---|
| Read all relevant `/docs` files | Before every plan |
| Read all files that will be touched | Before every plan |
| Ask clarifying questions | When the request is ambiguous |
| Produce a written plan | Before every non-trivial implementation |
| Wait for explicit approval | After every plan, without exception |
| Implement only what the plan describes | During Step 5 |
| Stop and re-plan if assumptions break | During Step 5, if needed |
| Report back after implementation | After Step 5 |
| Flag `/docs` conflicts before planning | Whenever a conflict exists |

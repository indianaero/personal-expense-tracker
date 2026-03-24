# UI Design Specification

**Stack:** HeroUI · Next.js App Router · TypeScript
**Rule:** No custom CSS, no custom UI primitives. Every visual element is a HeroUI component or a HeroUI layout utility. Tailwind spacing/layout classes are permitted only where HeroUI does not provide a direct prop.

---

## 1. Design Principles

| Principle | Application |
|---|---|
| **Clarity** | One primary action per screen. Dense data is broken into digestible cards. |
| **Consistency** | All interactive elements use the same HeroUI variants and sizes throughout. |
| **Responsiveness** | Mobile-first. Layouts reflow at `sm` (640 px) and `lg` (1024 px) breakpoints. |
| **Accessibility** | HeroUI is built on React Aria. All focusable elements have visible focus rings, ARIA labels, and keyboard navigation out of the box. |
| **Feedback** | Every async action shows a loading state (`Spinner` or skeleton). Errors surface in a `Callout` or inline field error, never silently. |

---

## 2. Theme & Tokens

HeroUI's `HeroUIProvider` wraps the root layout. The `defaultTheme` is set to `"system"` so the app automatically respects the OS preference.

```tsx
// app/layout.tsx
<HeroUIProvider defaultTheme="system">
  {children}
</HeroUIProvider>
```

### Semantic colour roles

| Role | HeroUI semantic token | Usage |
|---|---|---|
| Primary | `primary` | CTAs, active nav items, links |
| Success | `success` | Income badges, positive deltas |
| Danger | `danger` | Delete actions, over-budget alerts |
| Warning | `warning` | Approaching-budget indicators |
| Default | `default` | Secondary actions, neutral chips |
| Content background | `content1` / `content2` | Card surfaces, alternating table rows |

No hex values or arbitrary colours are used anywhere.

---

## 3. Global Layout

### Shell — all authenticated pages

```
┌─────────────────────────────────────────────────┐
│  Navbar (sticky, blurred backdrop)              │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Sidebar     │   <Outlet />                     │
│  (lg+)       │   scrollable page content        │
│              │                                  │
└──────────────┴──────────────────────────────────┘
│  BottomNavigation (mobile, sm and below)        │
└─────────────────────────────────────────────────┘
```

#### Navbar

**Component:** `Navbar` with `isBordered={false}` and `isBlurred`

| Slot | Content |
|---|---|
| `NavbarBrand` | App wordmark as a `Link` back to `/dashboard` |
| `NavbarContent` (end) | `ThemeSwitch` toggle · `Avatar` (user photo + dropdown menu) |
| `NavbarMenuToggle` | Visible only on mobile; opens the slide-in `NavbarMenu` |
| `NavbarMenu` | Full-width drawer with `NavbarMenuItem` links matching the sidebar |

#### Sidebar (lg+)

**Component:** `Listbox` with `selectionMode="single"`, each route is a `ListboxItem` with an icon in the `startContent` slot.

Navigation items:

| Icon | Label | Route |
|---|---|---|
| `LayoutDashboard` | Dashboard | `/dashboard` |
| `Receipt` | Expenses | `/expenses` |
| `Tag` | Categories | `/categories` |
| `BarChart2` | Reports | `/reports` |
| `Settings` | Settings | `/settings` |

The active item uses `color="primary"` via controlled `selectedKeys`. The sidebar is a fixed `w-56` column at `lg`, collapses to the `NavbarMenu` drawer at smaller sizes.

#### Bottom Navigation (sm and below)

**Component:** `Tabs` with `variant="light"` and `fullWidth`, positioned fixed at the bottom. Shows the top 4 routes as icon-only tabs with an `aria-label`. The active tab is highlighted with `color="primary"`.

---

## 4. Pages

### 4.1 Dashboard `/dashboard`

The primary at-a-glance view. Three zones stacked vertically.

#### Zone 1 — Summary stat cards

**Component:** A responsive grid of four `Card` components (`CardBody` only, no footer).

| Card | Value | Sub-label | Indicator |
|---|---|---|---|
| Total Spent (month) | Currency formatted total | "March 2026" | `Chip` color=`default` |
| Remaining Budget | Amount left | "of $X budget" | `Chip` color=`success` or `warning` |
| Largest Category | Category name | Spend amount | `Chip` color=`primary` |
| Expense Count | Integer | "transactions" | `Chip` color=`default` |

Grid: 1 column on mobile → 2 columns at `sm` → 4 columns at `lg`. Each card uses `shadow="sm"` and `radius="lg"`.

#### Zone 2 — Monthly spending breakdown

**Component:** `Card` with a `CardHeader` ("Spending by Category") and `CardBody` containing a `Table`.

Table config:
- `removeWrapper` — eliminates the outer scroll container so the card controls overflow
- `selectionMode="none"`
- `aria-label="Category spending breakdown"`
- Columns: Category · Amount · % of total · Transactions
- Each row has a `Chip` in the Category column for colour coding (`variant="flat"`, colour mapped per category)
- Amount column right-aligned via `align="end"` on `TableColumn`
- `Pagination` component beneath the table, `size="sm"`, `showControls`

Loading state: replace `TableBody` rows with four `Skeleton` rows of equal height.

#### Zone 3 — Recent expenses

**Component:** `Card` with `CardHeader` ("Recent Expenses") + a "View all" `Button` (`variant="light"`, `size="sm"`) in the header end slot, and `CardBody` containing a `Listbox`.

Each `ListboxItem`:
- `startContent` — `Avatar` with category initial, `size="sm"`, `radius="sm"`, colour matched to category
- Primary text — expense `description`
- `endContent` — formatted `amount` in a `Chip` (`variant="flat"`, `color="default"`)
- `description` slot — date string, e.g. "Mar 18"

---

### 4.2 Expenses `/expenses`

Full expense log with filtering, sorting, and add/edit/delete.

#### Toolbar

Horizontal `flex` row of HeroUI controls:

| Control | Component | Purpose |
|---|---|---|
| Search | `Input` `type="search"`, `startContent` search icon, `isClearable`, `size="sm"` | Filter by description |
| Month picker | `Select` `size="sm"` | Filter by month/year |
| Category filter | `Select` `size="sm"`, `selectionMode="multiple"` | Multi-select categories |
| Add Expense | `Button` `color="primary"` `size="sm"` `startContent` plus icon | Opens add modal |

On mobile the filters collapse behind a `Button` (`variant="bordered"`, "Filters") that opens a `Drawer` containing the same controls stacked vertically.

#### Expense table

**Component:** `Table`

Config: `sortDescriptor` controlled · `selectionMode="multiple"` · `topContent` = toolbar · `bottomContent` = pagination · `aria-label="Expenses"` · `isStriped`

Columns:

| Column key | Label | Sortable | Notes |
|---|---|---|---|
| `date` | Date | Yes | Formatted "MMM D" |
| `description` | Description | No | Primary text |
| `category` | Category | Yes | `Chip` `variant="flat"` |
| `amount` | Amount | Yes | Right-aligned, bold |
| `recurring` | — | No | `Chip` `color="secondary"` `variant="dot"` "Recurring" shown only when `true` |
| `actions` | — | No | `Dropdown` with Edit and Delete items |

Row actions `Dropdown`:
- `DropdownTrigger` — `Button` `isIconOnly` `variant="light"` with a `MoreVertical` icon
- `DropdownMenu` `aria-label="Expense actions"`
  - `DropdownItem` "Edit" — opens edit modal
  - `DropdownItem` "Delete" `color="danger"` `className="text-danger"` — opens confirmation modal

Bulk delete: when rows are selected a `Button` `color="danger"` `variant="flat"` appears in the top toolbar.

Loading state: `loadingContent={<Spinner />}` and `isLoading` prop on `Table`.

---

### 4.3 Add / Edit Expense — Modal

**Component:** `Modal` `size="md"` `scrollBehavior="inside"` `isDismissable`

```
ModalContent
 ├─ ModalHeader    "Add Expense" | "Edit Expense"
 ├─ ModalBody
 │   ├─ Input          label="Description"   isRequired
 │   ├─ NumberInput    label="Amount"        startContent="$"   isRequired  min=0
 │   ├─ Select         label="Category"      isRequired
 │   ├─ DatePicker     label="Date"          isRequired  granularity="day"
 │   ├─ Textarea       label="Notes"         maxRows={3}
 │   └─ Switch         "Recurring expense"
 └─ ModalFooter
     ├─ Button  variant="light"   onPress={onClose}  "Cancel"
     └─ Button  color="primary"   type="submit"      isLoading={saving}  "Save"
```

All fields use `variant="bordered"` and `labelPlacement="outside"` for maximum legibility. Inline validation errors appear via the `errorMessage` prop — no custom error UI.

---

### 4.4 Delete Confirmation — Modal

**Component:** `Modal` `size="sm"` `isDismissable={false}`

```
ModalContent
 ├─ ModalHeader  "Delete Expense"
 ├─ ModalBody    <p> confirmation copy </p>
 └─ ModalFooter
     ├─ Button  variant="light"  "Cancel"
     └─ Button  color="danger"   isLoading={deleting}  "Delete"
```

---

### 4.5 Categories `/categories`

#### Category grid

**Component:** Responsive grid of `Card` components.

Grid: 1 column mobile → 2 at `sm` → 3 at `md`. Each card:

```
Card  shadow="sm"  isPressable (opens edit modal)
 ├─ CardBody
 │   ├─ Avatar   initials, color per category, size="md", radius="sm"
 │   ├─ p        category name  (font-semibold)
 │   └─ Chip     "Default" | expense count   variant="flat"  size="sm"
 └─ CardFooter  (archived only)
     └─ Chip  color="default"  variant="flat"  "Archived"
```

Active vs archived categories are split into two sections using `Tabs` (`variant="underlined"`, `color="primary"`) at the top of the page — "Active" and "Archived".

#### Add Category button

Floating `Button` `color="primary"` `radius="full"` `isIconOnly` fixed at `bottom-20 right-4` (above bottom nav on mobile), `bottom-6 right-6` on desktop. Plus icon inside.

#### Add / Edit Category — Modal

**Component:** `Modal` `size="sm"`

```
ModalContent
 ├─ ModalHeader  "New Category" | "Edit Category"
 ├─ ModalBody
 │   ├─ Input    label="Name"   isRequired   variant="bordered"
 │   └─ Switch   "Set as default"
 └─ ModalFooter
     ├─ Button  variant="light"  "Cancel"
     └─ Button  color="primary"  isLoading={saving}  "Save"
```

Edit modal adds an additional `Button` `color="danger"` `variant="light"` "Archive" aligned to the start of `ModalFooter`.

---

### 4.6 Reports `/reports`

#### Period selector

**Component:** `ButtonGroup` with three `Button` items: "3M" · "6M" · "12M". Active period button uses `color="primary"`, inactive uses `variant="bordered"`.

#### Report cards

Two `Card` components side-by-side at `md+`, stacked on mobile:

1. **Top Categories** — `Table` with columns: Category · Total · % · Trend (`Chip` color=`success`/`danger` with arrow icon)
2. **Month-over-Month** — `Table` with columns: Month · Total · vs Prior (`Chip`)

#### Summary row

Three `Card` components in a 3-column grid at `sm+`:

- Average monthly spend
- Highest single expense
- Most frequent category

Each card uses `CardBody` only with a large `p` for the primary value and a muted `small` label below it.

---

### 4.7 Settings `/settings`

**Layout:** Single-column, max-width `lg`, centered. Sections divided by `Divider`.

#### Profile section

```
Card  shadow="sm"
 ├─ CardHeader  "Profile"
 └─ CardBody
     ├─ User     (HeroUI User component)  name · email · avatar
     ├─ Divider
     ├─ Input    label="Display Name"   variant="bordered"   defaultValue
     ├─ Input    label="Email"          variant="bordered"   type="email"
     └─ Button   color="primary"  size="sm"  "Save Changes"  isLoading
```

#### Preferences section

```
Card  shadow="sm"
 ├─ CardHeader  "Preferences"
 └─ CardBody
     ├─ Select   label="Currency"   variant="bordered"
     ├─ Select   label="Theme"      variant="bordered"   (Light / Dark / System)
     └─ NumberInput  label="Monthly Budget"  startContent="$"  variant="bordered"
```

#### Danger zone section

```
Card  shadow="sm"  className="border border-danger-200"
 ├─ CardHeader  "Danger Zone"  (text-danger)
 └─ CardBody
     └─ Button  color="danger"  variant="bordered"  "Delete Account"
```

---

## 5. Empty States

Every list or table that can be empty renders a centred `Card` with:

- `CardBody` containing a HeroUI `Image` (illustration) or large icon
- A heading `p` and a supporting `p` in muted colour
- A `Button` `color="primary"` as the primary recovery action

Examples:

| Page | Message | Action |
|---|---|---|
| Expenses — no results | "No expenses yet" | "Add your first expense" |
| Expenses — filtered, no match | "No expenses match your filters" | "Clear filters" (Button variant="light") |
| Categories | "No categories" | "Create a category" |
| Reports | "Add expenses to see reports" | "Go to Expenses" |

---

## 6. Notifications & Feedback

| Trigger | Component | Config |
|---|---|---|
| Expense saved | `addToast` (HeroUI Toast) | `color="success"` · "Expense saved" · `timeout=3000` |
| Expense deleted | `addToast` | `color="danger"` · "Expense deleted" |
| Network / server error | `addToast` | `color="danger"` · error message from API · `timeout=6000` |
| Form validation error | `Input` / `Select` `errorMessage` prop | Inline, no toast |
| Async button loading | `Button` `isLoading` prop | Spinner replaces label in-place |
| Data fetching | `Skeleton` inside each `Card` | Matches the shape of the loaded content |

---

## 7. Responsive Behaviour Summary

| Breakpoint | Layout change |
|---|---|
| `< sm` (< 640 px) | Single column · Bottom nav replaces sidebar · Toolbar filters in Drawer |
| `sm` (640 px) | 2-col stat cards · Inline toolbar filters |
| `md` (768 px) | 3-col category grid · Side-by-side report cards |
| `lg` (1024 px) | Sidebar visible · 4-col stat cards · Full expense table |

---

## 8. Accessibility Checklist

All of the following are satisfied by HeroUI's React Aria foundation with no additional implementation required beyond correct prop usage.

- [ ] All interactive components have an `aria-label` when no visible label is present (`isIconOnly` buttons, icon-only tabs)
- [ ] `Table` always has `aria-label`
- [ ] `Modal` traps focus; Escape key closes it
- [ ] `Select` and `DatePicker` are keyboard-navigable
- [ ] Colour is never the sole means of conveying information (chips include text labels, not just colours)
- [ ] Focus rings are visible in both themes (HeroUI default)
- [ ] Motion respects `prefers-reduced-motion` (HeroUI default)
- [ ] Minimum touch target size 44 × 44 px on all interactive elements (use `size="md"` or larger)
- [ ] Sufficient colour contrast in both light and dark themes (HeroUI semantic tokens are WCAG AA compliant)

---

## 9. HeroUI Component Inventory

Complete list of HeroUI components used across the app.

| Component | Used in |
|---|---|
| `Avatar` | Navbar, Sidebar user item, Recent expenses list, Category cards, Settings |
| `Button` / `ButtonGroup` | All CTAs, toolbar actions, report period selector |
| `Card` / `CardBody` / `CardHeader` / `CardFooter` | All surface containers |
| `Chip` | Category labels, status badges, recurring indicator |
| `DatePicker` | Add / Edit Expense modal |
| `Divider` | Settings page section separators |
| `Drawer` | Mobile filter panel |
| `Dropdown` / `DropdownTrigger` / `DropdownMenu` / `DropdownItem` | Row actions, user avatar menu |
| `Input` | Search, text fields |
| `Listbox` / `ListboxItem` | Sidebar nav, Recent expenses |
| `Modal` / `ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter` | Add/Edit Expense, Add/Edit Category, Delete confirm |
| `Navbar` / `NavbarBrand` / `NavbarContent` / `NavbarItem` / `NavbarMenu` / `NavbarMenuItem` / `NavbarMenuToggle` | App shell |
| `NumberInput` | Amount field, Budget setting |
| `Pagination` | Expense table, Dashboard breakdown table |
| `Select` / `SelectItem` | Category filter, Month filter, Currency, Theme |
| `Skeleton` | All loading states |
| `Spinner` | Table loading, Button loading |
| `Switch` | Recurring toggle, Default category toggle |
| `Table` / `TableHeader` / `TableColumn` / `TableBody` / `TableRow` / `TableCell` | Expense table, Report tables, Dashboard breakdown |
| `Tabs` / `Tab` | Bottom nav (mobile), Categories active/archived |
| `Textarea` | Notes field |
| `Tooltip` | Icon-only button labels |
| `User` | Settings profile section |
| `addToast` / `ToastProvider` | All success / error notifications |

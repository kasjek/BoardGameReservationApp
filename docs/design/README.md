# Design

UI/UX design artifacts for BoardGameReservationApp (owned by the `designer` agent).

- **Source of truth:** **Figma** (per `ADR-014`). The Figma project holds the high-fidelity screens, the mobile-first component library, and the interactive prototypes.
- **This folder:** an in-repo, build-ready mirror of the design intent so Developer can implement directly and reviewers can read designs beside the code. Each screen links to the user stories / requirements it serves.

## Contents

- `priority0-screens.md` — first drafts for the Priority‑0 flows (accounts, browse/create tables, reserve/cancel seats, venue confirmation).

## Design principles (from docs/Vision.md, NFR-6, ADR-012)

- **Mobile-first:** phone viewport is the default; enhance upward to tablet/desktop.
- **Clear over clever:** table status and seat/waitlist state obvious at a glance.
- **Fast to book:** minimal taps and typing from interest to a reserved seat.
- **Privacy:** public profile shows avatar, username, rating, late-cancellation count, and games joined — never email or other contact details. Friend search is by login only.
- **i18n:** English + German from the start; keep layouts flexible for longer strings.

## Figma hand-off

The Figma file is created/maintained in the owner's Figma workspace. When the Figma
link is available, add it at the top of `priority0-screens.md` and keep the frames in
sync with these specs.

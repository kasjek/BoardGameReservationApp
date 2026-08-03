# Priority‑0 HTML mockups

Self-contained, mobile-first HTML mockups of the Priority‑0 screens — a simple,
tool-free alternative to Figma for reviewing the design in a browser.

## View

Open `index.html` directly in any browser, or serve it:

```bash
cd docs/design/prototype
python3 -m http.server 8090
# then open http://127.0.0.1:8090/index.html
```

No build step, no dependencies, no network (all CSS is inline).

## Screens

1. Sign up / Log in
2. Browse & filter tables
3. Table detail (reserve / waitlist)
4. Create a table (host)
5. My profile (privacy-limited)
6. Venue admin (confirm / reject requests)

These mirror `docs/design/priority0-screens.md` and map to the DRF API. They are a
visual reference for building the Next.js mobile-first frontend; if Figma is connected
later, these can seed the high-fidelity frames.

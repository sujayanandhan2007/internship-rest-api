# Accessibility report
**Verified:** axe-core 2026 scan in jsdom on the loaded page with the dialog open: 0 violations (colour-contrast and region rules disabled because jsdom cannot compute them).
**Verified by code inspection (not by manual testing):** `lang`, skip link, landmarks (header/nav/main/footer), labelled inputs, `aria-invalid` + `aria-describedby` errors, `role=status` live regions, native `<dialog>` (focus trap, Esc), focus returned to the trigger on close, 44px minimum controls, `:focus-visible` outline, reduced-motion support.
**NOT VERIFIED:** manual keyboard walkthrough in a real browser, screen-reader testing, real colour-contrast measurement, zoom/reflow at 200–400%. WCAG 2.2 AA conformance is therefore **not claimed**.

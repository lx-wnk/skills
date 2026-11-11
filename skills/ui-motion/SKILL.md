---
name: ui-motion
license: MIT
description: >-
  Rules for UI animation and micro-interactions — easing, durations, stagger, press feedback, popover and dropdown entrances and exits, crossfades, reveals, and `prefers-reduced-motion`. Use this skill whenever you write or review CSS transitions, keyframes, Web Animations API, or Motion / Framer Motion code, or the user says "animate this", "add a transition", "make it feel smoother", "micro-interaction", "easing", "motion design", "animation feels off", "reduced motion", or German "animiere das", "füge eine Transition hinzu", "Animation einbauen", "soll sich flüssiger anfühlen", "Mikrointeraktion", "Animation wirkt komisch", "Bewegung reduzieren". Frontend motion only — not for layout, styling, or accessibility audits in general.


user-invocable: true
argument-hint: "[component or interaction to animate]"
allowed-tools: "Read Edit"
---

# UI Motion

Apply a fixed set of motion rules when you build or review UI animation.

## Scope

- Covers: transitions, keyframes, Web Animations API, Motion / Framer Motion, and the motion part of a UI review.
- Does not cover: layout, visual styling, or a full accessibility audit.

**Status of the values.** Every number below (durations, scales, distances, percentages) is an unverified heuristic. The source is a screenshot of a short video, not checked against a primary source. Treat each value as a starting point. Tune it in the browser, and do not cite it as a standard.

## Examples

```bash
/ui-motion dropdown menu in the header
/ui-motion review the toast enter/exit animation
```

## Workflow

1. Identify each animated element and its trigger (hover, press, open, route change, data load).
2. Apply rule 0 first, then the matching rules below.
3. When you review, name the rule number for each finding.

## Rules

### 0. Respect `prefers-reduced-motion`

- Under `@media (prefers-reduced-motion: reduce)`, remove movement, scale, and parallax. Keep opacity fades or make the change instant.
- In Motion / Framer Motion, use `useReducedMotion()` or `MotionConfig reducedMotion="user"`.
- Never put information only in a motion effect.

### Easing

1. Use ease-out for entrances.
2. Use ease-in-out for elements that move from one position to another on screen.
3. No bounce or spring overshoot on everyday UI.

### Timing (heuristic values)

4. Dropdowns: about 150–250 ms.
5. Stagger list rows by about 30 ms.
6. Make exits about 20 % shorter than the matching entrance.
7. Stagger details so that they settle after the container.

### Press and drag feedback

8. Scale a pressed element to about 0.97.
9. Stretch a moving knob (toggle, slider) by about 12 % in the direction of travel.
10. Do not tween while the pointer is held. Follow the pointer directly; animate only on release.
11. Rubber-band past the bounds: resist overscroll, then spring back.

### Popovers and overlays

12. Start popovers at about 0.95 scale.
13. Enter from the trigger: set `transform-origin` to the trigger side.
14. Exit to the trigger.

### Movement and state changes

15. Move objects along arcs, not straight lines.
16. Overlap the old and new states; do not leave an empty frame between them.
17. Use masks (`clip-path`, `mask-image`) for reveals and colour changes.
18. Crossfade icon swaps, with a short blur during the fade.
19. Pulse once to confirm success.

### Library-specific

20. Motion / Framer Motion only: reuse the same `layoutId` to animate an element between two positions or components.

## Principles

- Report a tuned value with the reason, not with a reference to this skill as an authority.

## Related skills

- `/branch-review` — its UI/UX agent reviews the diff; use this skill for the motion details.
- `/component-design` — component structure before you add motion.

# 📊 Analytics

See `persona.md` for how to review and comment.

Review whether the change is measurable - can we tell if it works and gets used?

Check:
- **Event coverage** - meaningful interactions emit tracking: button clicks, input/submit,
  and key state changes. Flag user actions that leave no trace.
- **Measurable outcomes** - every complex or multi-step action has an observable result
  (start → success/failure), so funnels and drop-off can be measured, not guessed.
- **Feature-gate measurability** - when feature gates/flags are used, success is measurable per
  variant: the events and properties needed to compare arms exist and fire for each.
- **Consistent instrumentation** - event names and properties follow the existing taxonomy;
  no duplicate, ambiguous, or silently-dropped events.

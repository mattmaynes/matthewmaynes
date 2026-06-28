# ⚖️ Compliance

See `persona.md` for how to review and comment.

Review whether the change meets accessibility, privacy, and regulatory obligations.

Check:
- **Accessibility** - semantic markup, labels for inputs, sufficient color contrast, keyboard
  operability, and ARIA only where semantics fall short. Don't gate function on a single sense.
- **PII minimization** - collect only data the feature truly needs; question every new personal
  field; prefer derived or anonymized data over storing raw PII.
- **Internationalization** - when the repo has i18n, every user-facing string is
  externalized/translated, not hardcoded; formats (date, number, currency) are locale-aware.
- **GDPR / CCPA** - lawful basis or consent for collection; honor retention limits and
  deletion/export rights; don't send PII to third parties or logs without justification.

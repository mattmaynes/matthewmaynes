# Emails

Static, on-brand HTML emails. No build step - each file is standalone and ready to paste into the
ESP. They share the same look (Harbor palette, harbor-dark header with the headshot avatar, social
icon footer) by construction; if you restyle one, mirror the change in the others.

The folder is organized in two parts:

- **`templates/`** - the reusable starting points:
  - **`welcome-email.html`** - the "thanks for subscribing" welcome. Personalize with
    `[[FIRSTNAME OR "there"]]`; the ESP injects the compliance/unsubscribe footer.
  - **`blog-post-email.html`** - announce a new post. Fill in the placeholders below.
- **`blog/`** - the finished, filled-in announcement email for each published post (one file per
  post, named to match the post slug).

## Announcing a post

Copy `templates/blog-post-email.html` to `blog/<post-slug>.html` and replace every occurrence of
each placeholder:

| Placeholder          | What to put                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `[[POST_URL]]`       | Full post URL (used by the cover image, title, and button).                 |
| `[[POST_IMAGE_URL]]` | **Absolute** cover image URL, e.g. `https://matthewmaynes.com/images/blog/<post>/cover.png`. |
| `[[POST_IMAGE_ALT]]` | Cover alt text.                                                             |
| `[[POST_TITLE]]`     | Post title (appears in the preview line and the heading).                   |
| `[[POST_EXCERPT]]`   | One or two sentence teaser.                                                 |

**Tags:** in the "Tags" row there is one `<span>` pill per tag (default: Engineering, Leadership).
Edit the pill text, and duplicate or delete a `<span>` to add or remove tags. The pills are
inline-block units, so on a narrow (mobile) screen a whole pill wraps to the next line instead of
its text breaking mid-word.

## Notes

- **Images must use absolute `https://matthewmaynes.com/...` URLs** - relative paths do not resolve
  in an inbox. Icons and the headshot are already served from the site; upload each post's cover to
  `public/images/blog/...` (so it deploys) before sending.
- Both files are table-based, inline-styled, Outlook-hardened (MSO ghost tables + VML button),
  mobile-responsive, and carry a `prefers-color-scheme` dark-mode block.
- Gold accents use `#9c6a2c` - the brightest gold that meets WCAG AA on white at normal text size.

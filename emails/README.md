# Emails

Static, on-brand HTML emails. No build step - each file is standalone and ready to paste into the
ESP. They share the same look (Harbor palette, harbor-dark header with the headshot avatar, social
icon footer) by construction; if you restyle one, mirror the change in the others.

The folder is organized in two parts:

- **`templates/`** - the reusable starting points:
  - **`welcome-email.html`** - the "thanks for subscribing" welcome. Personalize with
    `[[FIRSTNAME OR "there"]]`; the ESP injects the compliance/unsubscribe footer.
  - **`blog-post-email.html`** - announce a new post. Fill in the placeholders below.
  - **`contact-notification.html`** - the contact-form notification (spec 0032). NOT pasted into
    an ESP: the site's `/v1/contact` route reads this file, HTML-escapes and injects the sender's
    `[[NAME]]`/`[[EMAIL]]`/`[[MESSAGE]]`/`[[DATE]]`, and sends it via Resend. Edit the markup here;
    keep the four placeholders intact. It is bundled into the standalone runtime by
    `next.config.ts` `outputFileTracingIncludes`.
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

## Publishing to Constant Contact

Once `blog/<post-slug>.html` is filled in, publish it with the
[`ctct`](https://github.com/mattmaynes/ctct-cli) CLI instead of pasting into the dashboard.

**One-time setup** (see the [ctct README](https://github.com/mattmaynes/ctct-cli#quick-start)):

```bash
npm install -g mattmaynes/ctct-cli
ctct init --client-id <your-client-id> --from-name "<Your Name>" --from-email <your-verified-sender>
ctct login                                  # approve in the browser
```

Run `ctct account emails` to see which sender addresses are verified on the account.

**Create the campaign** from the finished HTML file. `--subject` sets both the subject line and the
campaign name; the sender is taken from the config you set above:

```bash
ctct email create --subject "The Post Title" --html-file blog/<post-slug>.html
```

`create` prints a `campaign_id`. Preview it in your own inbox, then schedule or send:

```bash
ctct email test-send <campaign_id> --to <your-address>
ctct email schedule  <campaign_id> --at 2026-08-01T13:00:00Z   # ISO 8601, or:
ctct email send      <campaign_id>                              # send now
```

`schedule`, `send`, `test-send`, and `preview` take the **campaign id** - the CLI resolves the
`primary_email` activity for you.

**Gotchas** (learned the hard way):

- **Campaign names must be unique**, and Constant Contact keeps reserving a name even after you
  delete the campaign. If `create` returns a `409 not unique`, keep `--subject` as the exact title
  but pass a distinct `--name` (e.g. `--name "The Post Title (2026-07-10)"`).
- **The sender must be a verified address** on the account (`ctct account emails`).
- Emails are sent as **custom-code** (`format_type` 5) - Constant Contact auto-injects the required
  unsubscribe + physical-address footer at send time, so the template doesn't include one.

## Notes

- **Images must use absolute `https://matthewmaynes.com/...` URLs** - relative paths do not resolve
  in an inbox. Icons and the headshot are already served from the site; upload each post's cover to
  `public/images/blog/...` (so it deploys) before sending.
- Both files are table-based, inline-styled, Outlook-hardened (MSO ghost tables + VML button),
  mobile-responsive, and carry a `prefers-color-scheme` dark-mode block.
- Gold accents use `#9c6a2c` - the brightest gold that meets WCAG AA on white at normal text size.

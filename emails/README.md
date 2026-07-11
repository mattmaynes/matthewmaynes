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

## Publishing to Constant Contact

Once `blog/<post-slug>.html` is filled in, publish it to Constant Contact with the
[`ctct`](https://github.com/mattmaynes/ctct-cli) CLI instead of pasting into the dashboard.

**One-time setup** (see the [ctct README](https://github.com/mattmaynes/ctct-cli#quick-start)):

```bash
npm install -g mattmaynes/ctct-cli
ctct init --client-id <your-client-id>   # from the Constant Contact developer portal
ctct login                                # approve in the browser
```

**Create the campaign** from a finished email file. The campaign **name** and **subject** are the
post title; the whole HTML file is the body. This shell snippet builds the request body from the
file and pipes it to `ctct` (so you never hand-edit HTML into JSON):

```bash
TITLE="The Post Title Exactly As You Want It in the Subject Line"
node -e '
  const fs = require("fs");
  process.stdout.write(JSON.stringify({
    name: process.env.TITLE,
    email_campaign_activities: [{
      format_type: 5,                          // custom code email
      from_name: "Matthew Maynes",
      from_email: "contact@matthewmaynes.com", // must be a verified sender
      reply_to_email: "contact@matthewmaynes.com",
      subject: process.env.TITLE,
      html_content: fs.readFileSync(process.argv[1], "utf8"),
    }],
  }));
' blog/<post-slug>.html | TITLE="$TITLE" ctct email create --data @-
```

`create` returns a `campaign_id`. Then preview it in your own inbox, and schedule or send:

```bash
ctct email test-send <campaign_id> --to contact@matthewmaynes.com
ctct email schedule  <campaign_id> --at 2026-08-01T13:00:00Z   # ISO 8601, or:
ctct email send      <campaign_id>                              # send now
```

`schedule`, `send`, `test-send`, and `preview` take the **campaign id** - the CLI resolves the
`primary_email` activity for you.

**Gotchas** (learned the hard way):

- **Names must be unique**, and Constant Contact keeps reserving a name even after you delete the
  campaign. If `create` returns a `409 not unique`, keep the `subject` as the exact title but add a
  suffix to `name` (e.g. `"$TITLE (2026-07-10)"`).
- **`from_email` must be a verified sender** on the account. Check with `ctct account emails`.
- **`format_type: 5`** (custom code) - Constant Contact auto-injects the required unsubscribe +
  physical-address footer at send time, so the template doesn't include one.

## Notes

- **Images must use absolute `https://matthewmaynes.com/...` URLs** - relative paths do not resolve
  in an inbox. Icons and the headshot are already served from the site; upload each post's cover to
  `public/images/blog/...` (so it deploys) before sending.
- Both files are table-based, inline-styled, Outlook-hardened (MSO ghost tables + VML button),
  mobile-responsive, and carry a `prefers-color-scheme` dark-mode block.
- Gold accents use `#9c6a2c` - the brightest gold that meets WCAG AA on white at normal text size.

# Homegrown Holiday Bottle Drive

The public bottle drive page for Homegrown Arts & Media Collective, plus the donor sign-up app behind it. Every refund funds mental health supports for independent artists in Alberta.

It's a standalone static site: plain HTML, CSS and JS with no build step. A Google Sheet stores the sign-ups, and a small Apps Script attached to that Sheet sends the emails from Gmail.

| File | What it is |
| --- | --- |
| `index.html` | The landing page and booking form, built from the approved mockup. |
| `my-pickup.html` | My pickup: donors look up their sign-up with code + email to skip a week, edit details, change email preferences or stop pickups. |
| `css/hg.css` | The mockup's styles and animations (unchanged), plus additions for the form, the confirmation screen and My pickup. |
| `js/config.js` | The Apps Script URL and the header/footer links. You only edit this once. |
| `js/site.js` | Shared code: loads the Settings, fills placeholders, works out pickup dates, motion toggle, Share button. |
| `js/book.js` / `js/my-pickup.js` | The booking form and the My pickup page. |
| `apps-script/` | The backend that lives inside the Google Sheet. |
| `CLAUDE.md` | The original build brief. |

## Preview

Open `index.html` in a browser. While `appsScriptUrl` in `js/config.js` is blank, the site runs in **preview mode**: the form shows a sample confirmation and My pickup shows sample data. Nothing is saved and no email is sent, and both screens say so.

## Going live (about 20 minutes)

1. **Create the Sheet.** Make a new Google Sheet in the Homegrown account that should own sign-ups and send the emails. Call it something like *Bottle Drive 2026*.
2. **Add the script.** In the Sheet, open **Extensions → Apps Script**. Replace `Code.gs` with `apps-script/Code.gs` from this repo. Then open **Project Settings**, tick *Show "appsscript.json"*, and replace that file with `apps-script/appsscript.json`. Save.
3. **Create the tabs.** Reload the Sheet. A **Bottle drive** menu appears. Choose **Set up tabs** and approve the permissions. This creates *Signups*, *Pickups*, *Newsletter* and *Settings*.
4. **Fill in Settings.** At minimum, set `bags_out_time`, `cutoff_day`/`cutoff_time`, `contact_email` and `site_url`. Then use **Bottle drive → Send a test confirmation email to me** to check the email.
5. **Deploy.** In Apps Script, go to **Deploy → New deployment → Web app**. Set *Execute as* to **Me** and *Who has access* to **Anyone**. Copy the web app URL.
6. **Connect the site.** Paste that URL into `appsScriptUrl` in `js/config.js`, and set the header and footer links there.
7. **Publish.** Upload the whole folder (`index.html`, `my-pickup.html`, `assets/`, `css/`, `js/`) to the web host, for example as `/bottle-drive/` on Homegrown's domain. All paths are relative, so any folder works. You don't need to upload `apps-script/`.

When you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version**. That keeps the same URL.

## Updating placeholders (no code changes)

Everything shown on the page as `[BRACKETS]` is a row in the Sheet's **Settings** tab, and each row has a note saying what it does. The site picks up edits within about a minute.

- Leave a value **blank** and the page keeps showing the `[PLACEHOLDER]`.
- Enter a single **`-`** to hide a placeholder that turned out to need no extra text (for example `prep_rules` if there are no prep rules).
- `raised`, `households` and `businesses`: update these after each depot run. The 20-block progress bar fills from `raised` ÷ `goal`.
- `skip_dates`: Thursdays with no pickup, such as `2026-12-24, 2026-12-31`. Pickup schedules and first-pickup dates adjust automatically.
- `partners`: one venue per line, `Name | logo URL | website`. The logo grid stays hidden until 3 venues are listed.
- `zones`: the "Area of the city" menu options.

## How a sign-up works

1. The donor fills in the form. It checks every required field and both consents, and won't submit until the pickup-emails consent is ticked.
2. The script checks everything again and creates a code like `HG-7KQ4`. Codes never use the look-alike characters 0/O or 1/I/L.
3. A row is added to **Signups** with status `registered`. Each consent is stored in its own column with its own timestamp, and newsletter opt-ins are also added to the **Newsletter** tab.
4. The confirmation email goes out (code, first Thursday, "bags out by [TIME], marked Homegrown"), and the status changes to `confirmed`.
5. The donor sees the confirmation screen, which links to My pickup.

**First pickup:** this is the first Thursday, from Thu Dec 10, 2026, that is still before the weekly sign-up cutoff and isn't in `skip_dates`. Until a cutoff is set, sign-ups close at the end of the Wednesday before each Thursday. That's a stand-in, not a confirmed rule.

**Pickup team:** for now the team works straight in the Sheet. Filter Signups by city and zone, and log each Thursday in **Pickups** (`pickup_date`, `code`, `outcome` = collected / bags_not_out / skipped / counted, `bags_collected`). Donors see those rows under "Past pickups". A dedicated driver view behind a login, and the automatic thank-you and rebook emails, are the next phase.

**After the campaign:** **Bottle drive → Delete personal data** blanks every name, email, address and driver note in Signups. It keeps codes, zones and bag counts for totals. Newsletter opt-ins are kept because those donors consented separately.

**Email limits:** Apps Script can send about 100 emails a day from a free Gmail account, or 1,500 a day from Google Workspace. If the limit is hit, the sign-up is still saved, the status stays `registered`, and the donor is told to keep their code.

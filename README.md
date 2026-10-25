# Sendero del Vino v0.2

Responsive static English-language wine-country event site. Original visual design retained.

## What is functional
- Region, category, weekend, next-30-days, search and saved-event filters.
- Google Calendar, official event and directions links.
- Displays only real event records present in `data/events.json`; no fictional events.
- `scripts/update_events.py` fetches official Amador Wine Country public Events Calendar API, checks fields and dates, deduplicates and writes the JSON. On network/API errors it exits nonzero and retains the last successful file.
- GitHub Actions workflow runs daily at 14:00 UTC and commits refreshed JSON, which triggers a Vercel deployment **only when Vercel is linked to that GitHub repository**.

## Important limitations
- **Not yet activated:** `data/events.json` starts empty, since the feed cannot be reached from the development environment. Run the workflow once and confirm it succeeds before claiming live coverage.
- The Amador Events Calendar API endpoint is a candidate, **not verified to return accessible JSON**. It may require adjustments. Workflow failure is visible in GitHub Actions.
- Old Sugar Mill, Grand Island Vineyards/Mansion, Bogle and other Elk Grove/Walnut Grove sources are linked as official calendars but are **not yet automatically imported**. No unsupported events are invented.
- The "Elk Grove & nearby (15 mi)" region is an editorial label; exact 15-mile geofencing is not implemented.
- The site does not run scheduled updates on a direct manual upload to Vercel. For automation: create a GitHub repository, upload the **contents** of this folder including `.github/workflows`, link it to the existing Vercel project under Settings → Git (or import as a new project), and enable Actions. Grant Actions write permissions under GitHub repository Settings → Actions → General → Workflow permissions if needed. Test with Actions → Refresh winery events → Run workflow. Verify the workflow, JSON, and Vercel deployment. GitHub may delay or disable scheduled runs on inactive repositories.
- Some venues may restrict automated access; respect source policies. The app is informational, not an official venue service. Confirm all details with organizers.
- Existing favorites from v0.1 are stored as demo titles and will not match new stable event IDs.

## Deploy
For a one-time manual preview, unzip and upload this folder to Vercel as a static site. This shows an honest empty state until event JSON is populated. For **daily automation**, connect a GitHub repository to Vercel as described above. Do not delete your existing production project before checking the new deployment.

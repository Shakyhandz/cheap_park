# @cheap-park/poller

Daily poller that fetches Göteborg parking data and writes a JSON snapshot
to `apps/web/public/data/`.

## Local development

1. Get an APPID from https://data.goteborg.se/Account/Register.aspx
2. Set the env var: `$env:GBG_APPID = "..."`
3. Run: `npm run poll --workspace @cheap-park/poller`

## CI

The poller runs daily at 04:00 UTC via `.github/workflows/poll-data.yml`.
The workflow needs a repository secret `GBG_APPID` to be configured at:
Settings → Secrets and variables → Actions → New repository secret.

If the API returns fewer than 90% of the previously-recorded parking count,
the run aborts and no commit is made — yesterday's snapshot remains live.

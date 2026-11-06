---
name: wismir-ship
description: Ship a finished change to the WISMIR dashboard / POS / Code.gs. Runs the tests, sends previews, pushes, opens a pull request and merges it right away (no waiting for the owner, even when Code.gs changed), then tells the owner in Indonesian what changed and whether Code.gs must be updated. Use whenever a change in this repo is ready, or when the owner says "merge", "tayangkan", "ship".
---

# Ship a WISMIR change

The owner (Yoga) decided on 2026-11-06: **every finished change is merged immediately**. The owner updates `Code.gs` in Apps Script afterwards, whenever it suits them. So the apps must keep working, without losing data, while Apps Script still runs an older `Code.gs`.

## 1. Before shipping: make `Code.gs` changes safe to install late

Only when `Code.gs` changed:

- **New Sheet columns go at the end** of the tab's header list. Numeric ones also go in `NUM`.
- **Bump the version in both places, to the same number:** `CODE_VERSION` in `Code.gs` and `NEED_CODE` in `dashboard.html`. The dashboard then shows an "Update Code.gs" notice until the owner installs it.
- **The apps must tolerate the old script:**
  - Dashboard: `keepMissing()` already keeps values for columns the old script does not return, and re-sends them until they land. Do not bypass it when loading from the Sheet.
  - POS: when the server leaves out data the new POS expects (for example `data.Store`), fall back to the previous behaviour instead of clearing anything.
  - New server actions: the app must check a field only the new script returns (like `reset:true`) and show "Perbarui Code.gs" otherwise. Remember that an old `Code.gs` treats unknown POST actions as a dashboard save.
- **Cover it in a test.** `tests/compat.js` shows the pattern: route `/exec` to imitate the old script, then unroute to imitate the update.

## 2. Test and preview

1. `bash tests/run_all.sh` must end with `EVERYTHING PASSED`. Never ship on a red run. Fix it, or report the failure to the owner.
2. For visual changes:
   - Run `node tests/make_preview.js <scratchpad-dir>`.
   - Send the preview HTML with `SendUserFile` display `render`.
   - Look at screenshots yourself before sending.
3. Never commit preview files, screenshots or logs. `.gitignore` covers `*.log` and `tests/*.png`.

## 3. Push, PR, merge

1. Commit on the session's `claude/...` branch.
   - If the previous PR from that branch is already merged, first `git fetch origin main && git checkout -B <branch> origin/main`.
   - Then `git push -u origin <branch>`.
2. Open the pull request into `main` (GitHub MCP `create_pull_request`):
   - Title and description in **Indonesian**: Ringkasan, Perubahan, Pengujian (say plainly what was not tested on real devices / the real Sheet), and steps for the owner.
   - End with the attribution lines from the session's system reminder.
3. **Merge it right away** with `merge_pull_request`.
   - Pass `expectedHeadSha` = `git rev-parse HEAD`.
   - If a call times out, check `list_pull_requests` before retrying, so you do not open a duplicate.
4. Update `CLAUDE.md` (owner decisions) and `PANDUAN.md` (owner steps) in the same PR when behaviour or setup changes.

## 4. Tell the owner (Indonesian, plain words)

- What changed and where to find it in the app. Note that it goes live on every device in 1-2 minutes, and installed apps may need closing and reopening once.
- Whether it was tested only in the emulated browser.
- **If `Code.gs` changed**, give these steps as a numbered list:
  1. Open https://github.com/yogaprasetia16/Wismirdashboard/blob/main/Code.gs and click **Copy raw file**.
  2. In Apps Script: delete everything, paste, then **Ctrl+S**.
  3. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Never "New deployment": that changes the URL on every device.

  Also say: until then the dashboard shows "Update Code.gs", and nothing they type is lost.
- If the owner is unhappy with a change, revert it quickly with a new PR that is merged the same way.

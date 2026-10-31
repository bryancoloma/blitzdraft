# blitzDraft — Project Guide for Claude Code

## What this is
An NFL pick'em pool web app for a group of friends (~15 players). Players log in, pick
the winner of each game every week, picks lock at kickoff, scores update automatically,
and there's a leaderboard, season standings, payment tracking, and a weekly-winner trophy.
Real money pool ($5/week buy-in via Venmo, paid outside the app — the app only *tracks* who paid).

Live site: https://bryancoloma.github.io/blitzdraft/  (entry point redirects to web/login.html)
Admin: Bryan (airferrari81@gmail.com), flagged by profiles.is_admin = true.

## Tech stack
- **Frontend:** plain HTML/CSS/JS in the `web/` folder, hosted on GitHub Pages (public repo).
- **Backend-as-a-service:** Supabase (Postgres DB + Auth + Row Level Security). No custom server.
- **Data scripts:** Python (pull_games.py, score_week.py, backup_week.py, restore_week.py),
  run locally and also on a schedule via GitHub Actions.
- **Data source:** ESPN's free unofficial API (site.api.espn.com/.../nfl/scoreboard).
- **Automation:** GitHub Actions (.github/workflows/update-scores.yml) runs pull + score
  every 15 min during game-day hours. Free because the repo is public.

## File map
### Python (project root)
- `pull_games.py` — fetches the week's games/scores/winners from ESPN, upserts into the
  `games` table, and writes `current_week` into the `settings` table. Has `SEASON_TYPE`
  (1=preseason, 2=regular, 3=playoffs) and `WEEK` constants near the top.
- `score_week.py` — scores everyone's picks for a week, computes ranks + tiebreakers,
  writes to `scores` table. Auto-detects the week from settings, OR accepts a week number
  as a command-line arg: `python3 score_week.py 4`.
- `backup_week.py` — exports a week's data (games, picks, scores, tiebreakers, payments,
  profiles) to JSON + CSV in `backups/week_N/`. Run `python3 backup_week.py` (current week)
  or `python3 backup_week.py N`.
- `restore_week.py` — restores a week from its JSON backup (upserts, safe to re-run).
  `python3 restore_week.py N`. Note: does NOT restore auth accounts (those live in Supabase
  Auth, not backed up).
- `requirements.txt` — requests, supabase, python-dotenv.
- `.env` — holds SUPABASE_URL and SUPABASE_SECRET_KEY. Gitignored, never commit it.

### Frontend (web/ folder)
- `index.html` / `app.js` — the picks page. Shows games grouped by date, clickable team
  buttons, live scores, kickoff locking, tiebreaker inputs, name editing, payment banner,
  admin link (hidden unless is_admin).
- `group.html` / `group.js` — Group Picks grid (players × games). Hidden-until-kickoff
  reveal, rank ordering, tiebreaker columns, wins column, week-selector dropdown.
- `season.html` / `season.js` — season standings grid (players × weeks), weekly-winner
  trophy per column.
- `login.html` / `login.js` — login + signup + forgot-password trigger.
- `reset.html` / `reset.js` — password reset landing page (Supabase recovery link lands here).
- `admin.html` / `admin.js` — admin-only payment tracker grid (players × weeks 1–22,
  with PO1–PO4 playoff labels). Checkboxes save paid status to the `payments` table.
- `styles.css` — all styling.

## Database tables (Supabase)
- `games` — id (ESPN's), week, season_type, kickoff_utc, team names/abbrs/logos, scores,
  final, winner.
- `picks` — id (auto), user_id, game_id, picked_team (stored as abbreviation e.g. "SEA").
  Unique (user_id, game_id).
- `scores` — id (auto), user_id, week, wins, rank. Unique (user_id, week).
- `profiles` — id (= auth user id), display_name, actual_name (for payouts), is_admin.
- `settings` — key/value. Holds `current_week`.
- `tiebreakers` — id (auto), user_id, week, guess (total pts of last game), most_points_team
  (stored as FULL name e.g. "San Francisco"). Unique (user_id, week).
- `payments` — id (auto), user_id, week, paid (bool). Unique (user_id, week).

RLS is on for all tables. Key policies: players read/write only their own picks/tiebreakers;
picks are hidden from others until each game starts (time-based RLS); payments readable by
all, writable only by admin; scores readable by all.

## Tiebreaker rules (important for payouts)
Weekly winner = most wins. Ties broken by:
1. Closest guess (absolute) to the total points of the week's LAST game.
2. If still tied: who correctly picked the team that scored the most points that week.
3. If STILL tied: split (co-winners — both get rank 1 and both get a trophy).
NOTE: most_points_team is stored as a full name but the top team is computed as an
abbreviation — score_week.py converts name→abbr via the games table to match correctly.
Genuinely-tied players get the SAME rank (co-winner logic in rank_players).

## WEEKLY ROUTINE (every Monday night, after games finish)
Run in the project folder, with internet connected:
1. `python3 pull_games.py`     # pulls final scores/winners for the ending week
2. `python3 score_week.py`     # scores it, sets standings + weekly winner
3. Confirm standings/trophy look right on the live site.
4. `python3 backup_week.py N`  # back up the ending week (N = the week that just finished)
5. Edit `pull_games.py`: change `WEEK = N` to the next week number, save.
6. `python3 pull_games.py`     # loads next week's games, sets current_week
7. `git add . && git commit -m "advance to week N" && git push`   # DON'T skip the push —
   the automation runs GitHub's copy, so it must match the current week.
8. Verify: site shows the new week, week-selector dropdown includes it, and GitHub's
   pull_games.py shows the new WEEK.

Phase transitions: preseason uses SEASON_TYPE=1, regular SEASON_TYPE=2 (week resets to 1),
playoffs SEASON_TYPE=3 (week resets to 1; skip Pro Bowl). Plan is to wipe + fresh-start
between phases / seasons (backup first, then delete, then pull the new phase).

## GOTCHAS we learned the hard way (don't repeat these)
- **commit ≠ push.** Running a script changes data (live instantly, no commit). Editing a
  file (like pull_games.py's WEEK) is code — must `git push` or the automation runs stale
  code. "ahead by X commits" in `git status` = you forgot to push.
- **Hard reload after deploy.** GitHub Pages caches. After a push, wait ~1 min then
  Cmd+Shift+R, or you'll see old code.
- **1000-row Supabase limit.** `.select()` defaults to max 1000 rows. Any query fetching
  ALL picks across the season will truncate once data grows — ALWAYS filter picks by the
  current week's game_ids. This silently corrupted scoring once (people with correct picks
  showing 0 wins).
- **Live scores vs final.** pull_games.py pulls current scores even for in-progress games
  (not just final). Winners only set when final. ESPN lags real life by a few minutes.
- **GitHub Actions cron is flaky.** Scheduled runs can be delayed or pause after long repo
  inactivity. The manual "Run workflow" button (works from the GitHub mobile app too) is the
  reliable fallback during games.
- **Supabase free-tier pauses after ~7 days inactivity** (fine in-season; restore in one
  click, no data loss; must restore within 1 year). No automatic backups on free tier —
  that's why backup_week.py exists.
- **Local venv can break if Python upgrades** (certifi/SSL errors). Fix: rebuild venv
  (`rm -rf venv && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`).
- **Missing profiles.** Early signups (before a bug fix) created auth accounts with no
  profiles row → showed as "undefined"/"Player". Signup and Save-Name now both upsert a
  profile. If someone's missing one, insert it.
- **New tables after Oct 30 2026 need explicit GRANTs** for the Data API (Supabase changed
  this). The error message gives you the exact GRANT to run.

## PLANNED FEATURE: Super Bowl Squares (build into blitzDraft, same login)
A classic 10×10 Super Bowl squares board, only available during Super Bowl week.
Design already decided (from an earlier planning chat):

- **Admin on/off toggle** controls whether the squares page + nav link are visible.
  Nav link hidden when off, AND squares.html checks the flag itself (URL-typing can't bypass).
- **10×10 grid.** One team across the top, one down the side, Super Bowl logo in the corner,
  0–9 number cells. Admin uploads the SB logo + both team logos (Supabase Storage bucket,
  admin-only upload).
- **Numbers assigned randomly** — admin clicks a "Randomize" button AFTER the board fills.
- **Players click open boxes** → their display_name shows as pending → click again to unclaim
  → Save writes to DB. **Locked after save** (no user edit/delete). **Only admin can remove
  a box** (if someone backs out). No limit on boxes per person.
- **Payment:** players pay separately via Venmo (same as the pool). NO email — instead the
  admin page shows a notification panel of new saves (player, # boxes, $ owed) + running
  totals, and the Picks-page Admin link shows a 🔔N badge. "Mark all seen" stores
  squares_settings.admin_seen_at. A Save = one insert, so its rows share created_at —
  grouping by (user_id, created_at) reconstructs each save.
- **Board locks** once numbers are drawn (top_numbers/side_numbers not null) — enforced in
  RLS too. Display name must be real (not blank / the "Player" signup placeholder) to save.

### Squares DB (already designed — may or may not be created yet, check Supabase)
- `squares_settings` — single row (id=1): enabled, sb_logo_url, top_team, top_logo_url,
  side_team, side_logo_url, top_numbers int[], side_numbers int[], price_per_box,
  top_color, side_color (number-bar colors), admin_seen_at, winners jsonb
  ({q1, q1r, ... q4, q4r} — quarter winners/reverse, typed by admin on squares.html).
- Logos live in the public Storage bucket `squares` (admin-only upload).
- SQL is in `sql/`: squares_setup.sql, squares_storage.sql, squares_colors_notify.sql.
- `squares` — one row per claimed box: row_num (0–9), col_num (0–9), user_id, display_name.
  Unique (row_num, col_num) prevents double-booking. (Uses row_num/col_num because `row` is
  a reserved SQL word.)
- RLS: everyone reads; users insert only as themselves with their real display_name and only
  while enabled=true; only admin deletes.

### Squares build order
1. Tables + admin on/off toggle + hidden/shown nav link
2. The board: display, click boxes, save
3. Admin logo uploads, team names, number entry + Randomize
4. Admin notification panel + nav badge (replaced the email plan)
Status (Oct 30 2026): steps 1–4 built.
After the game: admin page "Reset Squares" button (type RESET) deletes all boxes + logo files,
clears numbers/teams/colors, turns the board off. Keeps price_per_box. Back up first if you want a record.

## How Bryan works (for Claude Code)
Bryan can read Python/JS but prefers step-by-step guidance with the "why." He builds in small
testable pieces, tests on VS Code Live Server before pushing, then deploys via git push.
Keep changes incremental, explain reasoning, and watch for the gotchas above.
"""
blitzDraft — restore_week.py
Restores a week's data from a JSON backup back into Supabase.
Run:  python3 restore_week.py 1
      (restores backups/week_1/backup_week_1.json)

SAFE: uses upsert, so running it repeatedly does no harm. It rebuilds
whatever was in the backup. Restore order respects table dependencies.
"""

import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def load_backup(week):
    path = os.path.join("backups", f"week_{week}", f"backup_week_{week}.json")
    if not os.path.exists(path):
        print(f"ERROR: no backup found at {path}")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def restore_table(name, rows, conflict=None, drop_id=False):
    """Upsert rows back into a table. conflict = the unique column(s) to match on."""
    if not rows:
        print(f"  {name}: nothing to restore")
        return
    # some tables auto-generate their `id` — remove it so the DB makes a fresh one
    if drop_id:
        rows = [{k: v for k, v in row.items() if k != "id"} for row in rows]
    if conflict:
        supabase.table(name).upsert(rows, on_conflict=conflict).execute()
    else:
        supabase.table(name).upsert(rows).execute()
    print(f"  {name}: restored {len(rows)} rows")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 restore_week.py <week_number>")
        sys.exit(1)

    week = int(sys.argv[1])
    data = load_backup(week)

    print(f"Restoring week {week}...")

    # ORDER MATTERS: parents before children (foreign keys).
    # profiles and games first, then the things that reference them.
    restore_table("profiles", data.get("profiles", []), conflict="id")
    restore_table("games", data.get("games", []), conflict="id")
    restore_table("picks", data.get("picks", []), conflict="user_id,game_id", drop_id=True)
    restore_table("scores", data.get("scores", []), conflict="user_id,week", drop_id=True)
    restore_table("tiebreakers", data.get("tiebreakers", []), conflict="user_id,week", drop_id=True)
    restore_table("payments", data.get("payments", []), conflict="user_id,week", drop_id=True)

    print(f"Done. Week {week} restored.")


if __name__ == "__main__":
    main()
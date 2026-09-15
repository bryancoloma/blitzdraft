"""
blitzDraft — backup_week.py
Exports all data for a given week to JSON (for restore) and CSV (for reading).
Run:  python3 backup_week.py
It reads the current week from settings, or you can pass a week number:
      python3 backup_week.py 3
"""

import os
import sys
import json
import csv
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]   # secret key = sees everything

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_current_week():
    result = supabase.table("settings").select("value").eq("key", "current_week").single().execute()
    return int(result.data["value"])


def fetch_week_data(week):
    """Grab every table's data for this week (plus profiles, which aren't week-specific)."""
    data = {}

    # week-specific tables
    data["games"]       = supabase.table("games").select("*").eq("week", week).execute().data
    data["scores"]      = supabase.table("scores").select("*").eq("week", week).execute().data
    data["tiebreakers"] = supabase.table("tiebreakers").select("*").eq("week", week).execute().data
    data["payments"]    = supabase.table("payments").select("*").eq("week", week).execute().data

    # picks are tied to games, so filter by this week's game ids
    game_ids = [g["id"] for g in data["games"]]
    if game_ids:
        data["picks"] = supabase.table("picks").select("*").in_("game_id", game_ids).execute().data
    else:
        data["picks"] = []

    # profiles are not week-specific, but we save them so names can be restored
    data["profiles"] = supabase.table("profiles").select("*").execute().data

    return data


def save_json(week, data, folder):
    path = os.path.join(folder, f"backup_week_{week}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved {path}")


def save_csvs(week, data, folder):
    for table_name, rows in data.items():
        if not rows:
            continue
        path = os.path.join(folder, f"week{week}_{table_name}.csv")
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        print(f"  Saved {path}")


def main():
    # week from command line arg, or current week from settings
    if len(sys.argv) > 1:
        week = int(sys.argv[1])
    else:
        week = get_current_week()

    # make a backups folder if it doesn't exist
    folder = os.path.join("backups", f"week_{week}")
    os.makedirs(folder, exist_ok=True)

    print(f"Backing up week {week}...")
    data = fetch_week_data(week)

    # print a quick summary
    for table_name, rows in data.items():
        print(f"  {table_name}: {len(rows)} rows")

    save_json(week, data, folder)
    save_csvs(week, data, folder)

    print(f"Done. Backup saved in {folder}/")


if __name__ == "__main__":
    main()
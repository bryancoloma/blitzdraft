"""
Fetches a week of NFL games from ESPN and writes them into Supabase.
"""

import os

import requests
from dotenv import load_dotenv
from supabase import create_client

# --- Config -----------------------------------------------------------------
load_dotenv()  # reads SUPABASE_URL and SUPABASE_SECRET_KEY from your .env file

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

SEASON_YEAR = 2026   # which NFL season to pull
WEEK = 1             # which week
SEASON_TYPE = 2      # 2 = regular season, 3 = playoffs

ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"


# --- 1. Ask ESPN for the week's games ---------------------------------------
def fetch_games():
    params = {"dates": SEASON_YEAR, "seasontype": SEASON_TYPE, "week": WEEK}
    resp = requests.get(ESPN_URL, params=params, timeout=20)
    resp.raise_for_status()
    return resp.json()["events"]


# --- 2. Keep only the fields our table needs --------------------------------
def parse_game(event):
    comp = event["competitions"][0]
    home = next(c for c in comp["competitors"] if c["homeAway"] == "home")
    away = next(c for c in comp["competitors"] if c["homeAway"] == "away")
    final = comp["status"]["type"]["completed"]

    # Scores and winner only exist once the game is over.
    winner = None
    home_score = away_score = None
    if final:
        home_score = int(home["score"])
        away_score = int(away["score"])
        w = next((c for c in comp["competitors"] if c.get("winner")), None)
        winner = w["team"]["abbreviation"] if w else None  # None means a tie

    return {
        "id":          event["id"],            # ESPN's unique game id
        "week":        WEEK,
        "season_type": SEASON_TYPE,
        "kickoff_utc": event["date"],
        "home_team":   home["team"]["displayName"],
        "home_abbr":   home["team"]["abbreviation"],
        "home_logo":   home["team"].get("logo"),
        "away_team":   away["team"]["displayName"],
        "away_abbr":   away["team"]["abbreviation"],
        "away_logo":   away["team"].get("logo"),
        "home_score":  home_score,
        "away_score":  away_score,
        "final":       final,
        "winner":      winner,
    }


# --- 3. Write them into Supabase --------------------------------------------
def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    events = fetch_games()
    rows = [parse_game(e) for e in events]

    # upsert = insert new games, or update existing ones matched on `id`.
    # This is why re-running the script is safe: no duplicate rows, and
    # scores just refresh in place once games are played.
    supabase.table("games").upsert(rows).execute()

    print(f"Wrote {len(rows)} games for {SEASON_YEAR} week {WEEK}:")
    for r in rows:
        print(f"  {r['away_abbr']} @ {r['home_abbr']}   {r['kickoff_utc']}")


if __name__ == "__main__":
    main()
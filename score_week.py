"""
blitzDraft — score_week.py
Scores everyone's picks for a week and saves results to the scores table.
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]   # secret key = sees ALL picks, bypasses RLS

WEEK = 2

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# fetch games and build the winners lookup.
def get_winners():
    """Returns { game_id: winning_abbr } for finished games this week."""
    result = supabase.table("games").select("id, winner, final").eq("week", WEEK).execute()

    winners = {}
    for game in result.data:
        if game["final"] and game["winner"]:
            winners[game["id"]] = game["winner"]
    return winners


# fetch everyone's picks and count wins per player.
def score_everyone(winners):
    """Returns { user_id: win_count } for all players."""
    result = supabase.table("picks").select("user_id, game_id, picked_team").execute()

    tally = {}
    for pick in result.data:
        user = pick["user_id"]
        tally.setdefault(user, 0)   # start them at 0 if this is a new player.

        if winners.get(pick["game_id"]) == pick["picked_team"]:
            tally[user] += 1        # correct pick = 1 point
    return tally


# save the tally and run it.
def main():
    winners = get_winners()
    tally = score_everyone(winners)

    rows = [
        {"user_id": user_id, "week": WEEK, "wins": wins}
        for user_id, wins in tally.items()
    ]

    if rows:
        supabase.table("scores").upsert(rows, on_conflict="user_id,week").execute()

    print(f"Scored week {WEEK} — {len(winners)} finished games")
    for user_id, wins in tally.items():
        print(f"  {user_id}: {wins} wins")


if __name__ == "__main__":
    main()
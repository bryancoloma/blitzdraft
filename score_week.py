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

WEEK = 1

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

def get_tiebreaker_data(week):
    """Returns each player's guesses, plus the actual results to compare against."""
    # everyone's tiebreaker guesses for this week
    tb = supabase.table("tiebreakers").select("user_id, guess, most_points_team").eq("week", week).execute()
    guesses = {row["user_id"]: row for row in tb.data}

    # all finished games this week (for computing actuals)
    games = supabase.table("games").select("*").eq("week", week).eq("final", True).execute()

    return guesses, games.data

def compute_actuals(games):
    """From finished games, get the last game's total points and the highest-scoring team."""
    if not games:
        return None, None

    # last game of the week (latest kickoff) → its total points
    last_game = max(games, key=lambda g: g["kickoff_utc"])
    last_total = None
    if last_game["home_score"] is not None and last_game["away_score"] is not None:
        last_total = last_game["home_score"] + last_game["away_score"]

    # team that scored the most points across all games this week
    top_team = None
    top_score = -1
    for g in games:
        for abbr, score in [(g["home_abbr"], g["home_score"]), (g["away_abbr"], g["away_score"])]:
            if score is not None and score > top_score:
                top_score = score
                top_team = abbr

    return last_total, top_team

def rank_players(tally, guesses, last_total, top_team):
    """Rank players: most wins first, break ties by closest total-points guess, then most-points team."""

    def sort_key(user_id):
        wins = tally[user_id]
        g = guesses.get(user_id, {})

        # tiebreaker 1: how far off their total-points guess was (smaller = better)
        guess = g.get("guess")
        guess_diff = abs(guess - last_total) if (guess is not None and last_total is not None) else 9999

        # tiebreaker 2: did they correctly pick the highest-scoring team? (1 = yes, better)
        got_top_team = 1 if (g.get("most_points_team") and top_team and
                             g["most_points_team"].endswith(top_team)) else 0

        # sort: most wins, then smallest guess_diff, then got_top_team
        return (-wins, guess_diff, -got_top_team)

    ranked = sorted(tally.keys(), key=sort_key)

    # assign rank 1, 2, 3... in that order
    return {user_id: i + 1 for i, user_id in enumerate(ranked)}

# save the tally and run it.
def main():
    winners = get_winners()
    tally = score_everyone(winners)

    # tiebreaker data + actuals
    guesses, finished_games = get_tiebreaker_data(WEEK)
    last_total, top_team = compute_actuals(finished_games)

    # rank everyone (wins, then tiebreakers)
    ranks = rank_players(tally, guesses, last_total, top_team)

    rows = [
        {"user_id": user_id, "week": WEEK, "wins": wins, "rank": ranks[user_id]}
        for user_id, wins in tally.items()
    ]

    if rows:
        supabase.table("scores").upsert(rows, on_conflict="user_id,week").execute()

    print(f"Scored week {WEEK} — {len(winners)} finished games")
    print(f"Last game total: {last_total}, top team: {top_team}")
    for user_id in sorted(tally, key=lambda u: ranks[u]):
        print(f"  Rank {ranks[user_id]}: {tally[user_id]} wins — {user_id}")


if __name__ == "__main__":
    main()
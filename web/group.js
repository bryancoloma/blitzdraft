const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function getCurrentWeek() {
  const { data } = await supabaseClient
    .from("settings")
    .select("value")
    .eq("key", "current_week")
    .single();
  return parseInt(data.value);
}

async function showGroupPicks() {
  const currentWeek = await getCurrentWeek();
  // this week's games
  const { data: games } = await supabaseClient
    .from("games")
    .select("id, away_abbr, home_abbr, kickoff_utc, winner, final")
    .eq("week", currentWeek)
    .order("kickoff_utc");

  // everyone's picks
  const { data: picks } = await supabaseClient
    .from("picks")
    .select("user_id, game_id, picked_team");

  // everyone's names
  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, display_name");

  // everyone's rank this week (computed by the scorer)
  const { data: scores } = await supabaseClient
    .from("scores")
    .select("user_id, rank")
    .eq("week", currentWeek);

  // lookup: rank by user_id
  const rankLookup = {};
  for (const s of scores) {
    rankLookup[s.user_id] = s.rank;
  }

  // sort players by rank (rank 1 = winner on top). Unranked players go last.
  profiles.sort((a, b) => {
    const rankA = rankLookup[a.id] ?? 999;
    const rankB = rankLookup[b.id] ?? 999;
    return rankA - rankB;
  });

  // everyone's tiebreaker guesses (RLS hides others' until last game starts)
  const { data: tiebreakers } = await supabaseClient
    .from("tiebreakers")
    .select("user_id, guess, most_points_team")
    .eq("week", currentWeek);

  const tbLookup = {};
  for (const t of tiebreakers) {
    tbLookup[t.user_id] = t;
  }

  // has the last game of the week started? (controls whether we show the columns)
  const lastGame = games[games.length - 1];
  const lastStarted = new Date() >= new Date(lastGame.kickoff_utc);

// lookup: picks[user_id][game_id] = "SEA"
  const pickLookup = {};
  for (const p of picks) {
    if (!pickLookup[p.user_id]) pickLookup[p.user_id] = {};
    pickLookup[p.user_id][p.game_id] = p.picked_team;
  }

  // winners lookup: { game_id: "SEA" } for finished games
  const winnerLookup = {};
  for (const game of games) {
    if (game.final && game.winner) {
      winnerLookup[game.id] = game.winner;
    }
  }

  // header row: blank corner + each game's matchup
  let html = "<table><tr><th>Player</th>";
  for (const game of games) {
    html += `<th>${game.away_abbr}<br>@${game.home_abbr}</th>`;
  }
    if (lastStarted) {
    html += `<th>Total Pts</th><th>Most Pts Team</th>`;
  }
  html += "</tr>";

  // one row per player
  for (const profile of profiles) {
    html += `<tr><td>${profile.display_name}</td>`;

    for (const game of games) {
      const pick = pickLookup[profile.id]?.[game.id] || "";
      const winner = winnerLookup[game.id];

      let cellClass = "";
      if (pick && winner) {
        cellClass = (pick === winner) ? "correct" : "wrong";
      }

      html += `<td class="${cellClass}">${pick}</td>`;
    }

      if (lastStarted) {
      const tb = tbLookup[profile.id] || {};
      html += `<td>${tb.guess ?? ""}</td><td>${tb.most_points_team ?? ""}</td>`;
    }

    html += "</tr>";
  }

  html += "</table>";
  document.getElementById("board").innerHTML = html;
}

showGroupPicks();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});
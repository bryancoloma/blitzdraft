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
    .select("id, away_abbr, home_abbr, kickoff_utc")
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

// lookup: picks[user_id][game_id] = "SEA"
  const pickLookup = {};
  for (const p of picks) {
    if (!pickLookup[p.user_id]) pickLookup[p.user_id] = {};
    pickLookup[p.user_id][p.game_id] = p.picked_team;
  }

  // header row: blank corner + each game's matchup
  let html = "<table><tr><th>Player</th>";
  for (const game of games) {
    html += `<th>${game.away_abbr}<br>@${game.home_abbr}</th>`;
  }
  html += "</tr>";

  // one row per player
  for (const profile of profiles) {
    html += `<tr><td>${profile.display_name}</td>`;

    for (const game of games) {
      const pick = pickLookup[profile.id]?.[game.id] || "";
      html += `<td>${pick}</td>`;
    }

    html += "</tr>";
  }

  html += "</table>";
  document.getElementById("board").innerHTML = html;
}

showGroupPicks();
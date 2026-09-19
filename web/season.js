const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function showSeason() {
  // get ALL score rows (every week, every player)
  const { data: scores } = await supabaseClient
    .from("scores")
    .select("user_id, week, wins, rank");

  // get all games to determine which weeks are fully finished
  const { data: games } = await supabaseClient
    .from("games")
    .select("week, final");

  // a week is "done" only if it has games AND all of them are final
  const weekDone = {};
  const weekGames = {};
  for (const g of games) {
    if (!weekGames[g.week]) weekGames[g.week] = [];
    weekGames[g.week].push(g.final);
  }
  for (const w in weekGames) {
    weekDone[w] = weekGames[w].every(f => f === true);
  }

  // get names
  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, display_name");

  const nameLookup = {};
  for (const p of profiles) {
    nameLookup[p.id] = p.display_name;
  }

// build: { user_id: { 1: wins, 2: wins, ... } }
  const byPlayer = {};
  for (const row of scores) {
    if (!byPlayer[row.user_id]) byPlayer[row.user_id] = {};
    byPlayer[row.user_id][row.week] = row.wins;
  }

// who won each week? { week: winning_user_id } — rank 1 that week
  const weekWinner = {};
  for (const row of scores) {
    if (row.rank === 1) {
      weekWinner[row.week] = row.user_id;
    }
  }

  const weeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];

  // header row
  let html = "<table><tr><th>Player</th>";
  for (const w of weeks) {
    html += `<th>Wk ${w}</th>`;
  }
  html += "<th>Total</th></tr>";

  // rank players by their season total, highest first
  const rankedPlayers = Object.keys(byPlayer).sort((a, b) => {
    const totalA = Object.values(byPlayer[a]).reduce((sum, w) => sum + w, 0);
    const totalB = Object.values(byPlayer[b]).reduce((sum, w) => sum + w, 0);
    return totalB - totalA;
  });

  for (const userId of rankedPlayers) {
    html += `<tr><td>${nameLookup[userId]}</td>`;

    let total = 0;
    for (const w of weeks) {
      const wins = byPlayer[userId][w] || 0;
      total += wins;
      const trophy = (weekWinner[w] === userId && wins > 0 && weekDone[w]) ? "   🏆" : "";
      html += `<td>${wins}${trophy}</td>`;
    }

    html += `<td>${total}</td></tr>`;
  }

  html += "</table>";
  document.getElementById("board").innerHTML = html;
}

showSeason();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

// auto-refresh every 15 minutes to keep scores current
setInterval(() => {
  location.reload();
}, 15 * 60 * 1000);
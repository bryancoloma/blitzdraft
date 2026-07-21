const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function showSeason() {
  // get ALL score rows (every week, every player)
  const { data: scores } = await supabaseClient
    .from("scores")
    .select("user_id, wins");

  // get names
  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, display_name");

  const nameLookup = {};
  for (const p of profiles) {
    nameLookup[p.id] = p.display_name;
  }

  // SUM wins per player across all weeks
  const totals = {};
  for (const row of scores) {
    totals[row.user_id] = (totals[row.user_id] || 0) + row.wins;
  }

  // turn totals into a sortable list, highest first
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const board = document.getElementById("board");
  for (const [userId, wins] of ranked) {
    const line = document.createElement("div");
    line.textContent = `${nameLookup[userId]} — ${wins} wins`;
    board.appendChild(line);
  }
}

showSeason();
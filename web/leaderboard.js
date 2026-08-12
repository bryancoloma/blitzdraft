// connect to Supabase
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const currentWeek = 2;

async function showLeaderboard() {
  const { data, error } = await supabaseClient
    .from("scores")
    .select("user_id, wins")
    .eq("week", currentWeek)
    .order("wins", { ascending: false });   // descending = highest first

    // get everyone's display names
  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, display_name");

  // build a lookup: { user_id: "Bryan" }
  const nameLookup = {};
  for (const p of profiles) {
    nameLookup[p.id] = p.display_name;
  }

  const board = document.getElementById("board");

  for (const row of data) {
    const line = document.createElement("div");
    const label = row.wins === 1 ? "win" : "wins";
    line.textContent = `${nameLookup[row.user_id]} — ${row.wins} ${label}`;
    board.appendChild(line);
  }
}

showLeaderboard();
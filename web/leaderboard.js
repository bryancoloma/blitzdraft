// connect to Supabase
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const currentWeek = 2;

async function scoreWeek() {
  // 1. get this week's games (we only care about finished ones)
  const { data: games } = await supabaseClient
    .from("games")
    .select("id, winner, final")
    .eq("week", currentWeek);

  // 2. get my picks
  const { data: picks } = await supabaseClient
    .from("picks")
    .select("game_id, picked_team");

  // 3. build a lookup of winners: { game_id: "BUF" }
  const winners = {};
  for (const game of games) {
    if (game.final && game.winner) {
      winners[game.id] = game.winner;
    }
  }

  // 4. count how many picks matched the winner
  let wins = 0;
  for (const pick of picks) {
    if (winners[pick.game_id] === pick.picked_team) {
      wins++;
    }
  }

  console.log("Winners:", winners);
  console.log("My wins:", wins);
}

scoreWeek();
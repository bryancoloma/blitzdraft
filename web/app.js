// Create the connection to Supabase (browser version of create_client)
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Prove the connection object exists
console.log("Supabase connected:", supabaseClient);

async function fetchGames() {
  const { data, error } = await supabaseClient
    .from("games")
    .select("*");

  console.log("Got games:", data);
}

fetchGames();
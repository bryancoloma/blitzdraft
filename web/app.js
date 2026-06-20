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

  const container = document.getElementById("games"); //grabs games div from index.html

for (const game of data) {
  // build the two buttons for this game
  const row = document.createElement("div");
  row.className = "game";

  const awayBtn = document.createElement("button");
  awayBtn.textContent = game.away_team;

  const homeBtn = document.createElement("button");
  homeBtn.textContent = game.home_team;

  awayBtn.addEventListener("click", () => {
    awayBtn.classList.remove("picked", "faded");
    homeBtn.classList.remove("picked", "faded");
    awayBtn.classList.add("picked");
    homeBtn.classList.add("faded");
  });

  homeBtn.addEventListener("click", () => {
    awayBtn.classList.remove("picked", "faded");
    homeBtn.classList.remove("picked", "faded");
    homeBtn.classList.add("picked");
    awayBtn.classList.add("faded");
  });

  // put both buttons in the row, and the row on the page
  row.appendChild(awayBtn);
  row.appendChild(homeBtn);
  container.appendChild(row);
}
}

fetchGames();

someButton.addEventListener("click", () => {
  // code here runs when that button is clicked
});
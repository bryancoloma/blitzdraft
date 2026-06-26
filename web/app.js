// Create the connection to Supabase (browser version of create_client)
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Prove the connection object exists
console.log("Supabase connected:", supabaseClient);

// PROTECT THIS PAGE: if nobody's logged in, send them to login
async function requireLogin() {
  const { data } = await supabaseClient.auth.getUser();
  if (!data.user) {
    window.location.href = "login.html";
  }
}
requireLogin();

async function fetchGames() {
  const currentWeek = 2; // which week to display
  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .eq("week", currentWeek); //rows where the week column equals currentWeek

  const container = document.getElementById("games"); //grabs games div from index.html

let lastDate = ""; // remembers the last date header we printed, so we only print each date once

for (const game of data) {
  const kickOffDate = new Date(game.kickoff_utc);
  console.log(kickOffDate.toLocaleTimeString());   // ← .toLocaleTimeString() makes it readable
  const timeText = kickOffDate.toLocaleTimeString(); // ← readable time to be used in the UI
  const dateText = kickOffDate.toLocaleDateString(); // gets the game's datge as a text.

  //Prints the date header when the date changes
  if (dateText !== lastDate) {       // date changed since last game?
  const dateHeader = document.createElement("h2");
  dateHeader.textContent = dateText;
  container.appendChild(dateHeader);
  lastDate = dateText;             // update the sticky note
}

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
  const timeLabel = document.createElement("span");
  timeLabel.textContent = timeText + "  ";
    row.appendChild(timeLabel);
    row.appendChild(awayBtn);
    row.appendChild(homeBtn);
    container.appendChild(row);
}
}

fetchGames();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});
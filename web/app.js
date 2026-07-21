// Create the connection to Supabase (browser version of create_client)
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Prove the connection object exists
console.log("Supabase connected:", supabaseClient);

const myPicks = {}; // holds picks like { game_id: "SEA" } as the user clicks

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
    .eq("week", currentWeek)//rows where the week column equals currentWeek
    .order("kickoff_utc");

  // get this user's already-saved picks
  const { data: savedPicks } = await supabaseClient
    .from("picks")
    .select("game_id, picked_team");

  console.log("Saved picks from DB:", savedPicks);

  // reshape into { game_id: "TEAM" } for easy lookup
  const savedLookup = {};
  for (const pick of savedPicks) {
    savedLookup[pick.game_id] = pick.picked_team;
  }

  const container = document.getElementById("games"); //grabs games div from index.html

let lastDate = ""; // remembers the last date header we printed, so we only print each date once

for (const game of data) {
  const kickOffDate = new Date(game.kickoff_utc);
  // locked if we're within 5 minutes of kickoff
  const lockTime = new Date(kickOffDate.getTime() - 5 * 60 * 1000);
  const isLocked = new Date() > lockTime;
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

  if (isLocked) {
      awayBtn.disabled = true;
      homeBtn.disabled = true;
    }

  // if this game was already picked, highlight it and load it into myPicks
    const savedTeam = savedLookup[game.id];
    if (savedTeam === game.away_abbr) {
      awayBtn.classList.add("picked");
      homeBtn.classList.add("faded");
      myPicks[game.id] = game.away_abbr;
    } else if (savedTeam === game.home_abbr) {
      homeBtn.classList.add("picked");
      awayBtn.classList.add("faded");
      myPicks[game.id] = game.home_abbr;
    }

  awayBtn.addEventListener("click", () => {
    awayBtn.classList.remove("picked", "faded");
    homeBtn.classList.remove("picked", "faded");
    awayBtn.classList.add("picked");
    homeBtn.classList.add("faded");
    myPicks[game.id] = game.away_abbr;
    console.log(myPicks);
  });

  homeBtn.addEventListener("click", () => {
    awayBtn.classList.remove("picked", "faded");
    homeBtn.classList.remove("picked", "faded");
    homeBtn.classList.add("picked");
    awayBtn.classList.add("faded");
    myPicks[game.id] = game.home_abbr;
    console.log(myPicks);
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

document.getElementById("saveBtn").addEventListener("click", async () => {
  // 1. who is logged in?
  const { data: userData } = await supabaseClient.auth.getUser();
  const userId = userData.user.id;

  // 2. turn myPicks into rows for the table
  const rows = Object.entries(myPicks).map(([gameId, team]) => ({
    user_id: userId,
    game_id: gameId,
    picked_team: team,
  }));

  // 3. save them (upsert = insert or update, no duplicates)
  const { error } = await supabaseClient
    .from("picks")
    .upsert(rows, { onConflict: "user_id, game_id" });

  if (error) {
    console.log("Save error:", error);
  } else {
    console.log("Picks saved!", rows);
  }
});
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let me = null;          // { id, display_name, is_admin }
let settings = null;    // the single squares_settings row
let claimed = {};       // claimed["row-col"] = { user_id, display_name } (saved in DB)
const pending = new Set(); // "row-col" keys the user clicked but hasn't saved yet

// signup saves "Player" as a placeholder, so that doesn't count as a real name
function hasRealName() {
  const name = (me?.display_name || "").trim();
  return name !== "" && name !== "Player";
}

// once the admin draws the numbers, nobody can pick new boxes
function numbersDrawn() {
  return !!(settings?.top_numbers || settings?.side_numbers);
}

// players can only select boxes while the board is on AND numbers aren't drawn yet
function canPick() {
  return settings?.enabled && !numbersDrawn();
}

async function loadSquares() {
  // 1. must be logged in
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) { window.location.href = "login.html"; return; }

  const { data: profile } = await supabaseClient
    .from("profiles").select("id, display_name, is_admin").eq("id", userData.user.id).maybeSingle();
  me = profile;

  // 2. the page checks the on/off flag itself, so typing the URL can't bypass it
  const { data: s } = await supabaseClient
    .from("squares_settings").select("*").eq("id", 1).maybeSingle();
  settings = s;

  const status = document.getElementById("squaresStatus");
  if (!settings?.enabled) {
    if (!me?.is_admin) {
      status.textContent = "Super Bowl Squares isn't open right now. Check back Super Bowl week!";
      return;
    }
    // admin can still preview the board while it's off (but can't claim — RLS blocks it)
    status.textContent = "Admin preview — the board is OFF, players can't see it.";
  }

  if (numbersDrawn()) {
    status.textContent = "The numbers have been drawn — the board is locked. Good luck!";
  }

  document.getElementById("squaresActions").style.display = "flex";
  document.getElementById("venmoNote").style.display = "block";

  await loadClaimed();
  drawBoard();
  drawWinners();
}

// get every claimed box from the DB (max 100 rows, so no 1000-row worry here)
async function loadClaimed() {
  const { data: rows, error } = await supabaseClient
    .from("squares").select("row_num, col_num, user_id, display_name");
  if (error) console.log("Squares load error:", error);

  claimed = {};
  for (const r of rows || []) {
    claimed[`${r.row_num}-${r.col_num}`] = r;
  }
}

function drawBoard() {
  const board = document.getElementById("squaresBoard");
  board.innerHTML = "";

  const table = document.createElement("table");
  table.id = "squaresTable";

  // fixed column widths (set in styles.css): side team | side numbers | 10 boxes.
  // Without these, the browser sizes columns from the colspan'd logo row and the number bars come out uneven.
  const cols = document.createElement("colgroup");
  for (const cls of ["sq-col-team", "sq-col-num", ...Array(10).fill("sq-col-box")]) {
    const col = document.createElement("col");
    col.className = cls;
    cols.appendChild(col);
  }
  table.appendChild(cols);

  // top row: big Super Bowl logo in the corner, then the top team's logo + name over the boxes
  const teamRow = document.createElement("tr");
  const sbCell = document.createElement("th");
  sbCell.colSpan = 2; // covers the side-team column + side-number column
  sbCell.className = "sq-sb";
  if (settings?.sb_logo_url) addLogo(sbCell, settings.sb_logo_url);
  teamRow.appendChild(sbCell);

  const topTeam = document.createElement("th");
  topTeam.colSpan = 10;
  topTeam.className = "sq-team sq-top-team";
  addLogo(topTeam, settings?.top_logo_url);
  const topName = document.createElement("span");
  topName.textContent = settings?.top_team || "Top Team";
  topTeam.appendChild(topName);
  teamRow.appendChild(topTeam);
  table.appendChild(teamRow);

  // number header row: side team (runs down the left) + empty corner + 10 top numbers
  const headRow = document.createElement("tr");
  const sideTeam = document.createElement("th");
  sideTeam.rowSpan = 11;
  sideTeam.className = "sq-team sq-side-team";
  // logo + name turned sideways together, reading bottom-to-top (logo at the bottom)
  const sideName = document.createElement("span");
  sideName.className = "sq-vertical";
  addLogo(sideName, settings?.side_logo_url);
  sideName.append(settings?.side_team || "Side Team");
  sideTeam.appendChild(sideName);
  headRow.appendChild(sideTeam);

  const corner = document.createElement("th");
  corner.className = "sq-corner";
  headRow.appendChild(corner);

  for (let c = 0; c < 10; c++) {
    const th = document.createElement("th");
    th.className = "sq-num";
    th.textContent = settings?.top_numbers ? settings.top_numbers[c] : "?";
    if (settings?.top_color) th.style.backgroundColor = settings.top_color;
    headRow.appendChild(th);
  }
  table.appendChild(headRow);

  // 10 rows: side number + 10 boxes
  for (let r = 0; r < 10; r++) {
    const tr = document.createElement("tr");

    const sideNum = document.createElement("th");
    sideNum.className = "sq-num";
    sideNum.textContent = settings?.side_numbers ? settings.side_numbers[r] : "?";
    if (settings?.side_color) sideNum.style.backgroundColor = settings.side_color;
    tr.appendChild(sideNum);

    for (let c = 0; c < 10; c++) {
      const key = `${r}-${c}`;
      const td = document.createElement("td");
      td.className = "sq-box";

      if (claimed[key]) {
        td.textContent = claimed[key].display_name; // textContent = safe even if a name has < > in it
        td.classList.add(claimed[key].user_id === me?.id ? "sq-mine" : "sq-taken");
        if (me?.is_admin) {
          td.title = "Admin: click to remove this box";
          td.addEventListener("click", () => removeBox(r, c));
        }
      } else if (pending.has(key)) {
        td.textContent = me.display_name;
        td.classList.add("sq-pending");
        td.addEventListener("click", () => togglePending(key));
      } else if (canPick()) {
        td.classList.add("sq-open");
        td.addEventListener("click", () => togglePending(key));
      } else {
        td.classList.add("sq-closed"); // numbers drawn (or board off): open box, not clickable
      }

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  board.appendChild(table);
  updateSummary();
}

// Quarter winners panel beside the board. Everyone sees it; only the admin gets input boxes.
const WINNER_ROWS = [
  ["q1", "1st Quarter Winner"], ["q1r", "1st Quarter Reverse"],
  ["q2", "2nd Quarter Winner"], ["q2r", "2nd Quarter Reverse"],
  ["q3", "3rd Quarter Winner"], ["q3r", "3rd Quarter Reverse"],
  ["q4", "4th Quarter Winner"], ["q4r", "4th Quarter Reverse"],
];

function drawWinners() {
  const panel = document.getElementById("squaresWinners");
  panel.innerHTML = "";
  const winners = settings?.winners || {};

  const title = document.createElement("h3");
  title.textContent = "Winners";
  panel.appendChild(title);

  for (const [key, label] of WINNER_ROWS) {
    const row = document.createElement("div");
    row.className = "sq-win-row" + (key.endsWith("r") ? " sq-win-reverse" : "");

    const lbl = document.createElement("span");
    lbl.className = "sq-win-label";
    lbl.textContent = label + ":";
    row.appendChild(lbl);

    let value;
    if (me?.is_admin) {
      value = document.createElement("input");
      value.type = "text";
      value.value = winners[key] || "";
      value.dataset.key = key;
    } else {
      value = document.createElement("span");
      value.textContent = winners[key] || ""; // textContent = names can't inject HTML
    }
    value.classList.add("sq-win-value");
    row.appendChild(value);
    panel.appendChild(row);
  }

  if (me?.is_admin) {
    const btn = document.createElement("button");
    btn.textContent = "Save Winners";
    btn.addEventListener("click", saveWinners);
    panel.appendChild(btn);
  }
}

// admin only — RLS on squares_settings blocks anyone else's update
async function saveWinners() {
  const winners = {};
  document.querySelectorAll("#squaresWinners input[data-key]").forEach((input) => {
    if (input.value.trim()) winners[input.dataset.key] = input.value.trim();
  });

  const { error } = await supabaseClient
    .from("squares_settings").update({ winners }).eq("id", 1);
  if (error) {
    console.log("Save winners error:", error);
    alert("Could not save winners — did you run the latest SQL?");
  } else {
    settings.winners = winners;
    alert("Winners saved.");
  }
}

// put a logo image inside a header cell (skipped if the admin hasn't uploaded one)
function addLogo(cell, url) {
  if (!url) return;
  const img = document.createElement("img");
  img.src = url;
  img.className = "sq-logo";
  img.alt = "";
  cell.appendChild(img);
}

// click an open box → pending; click again → back to open
function togglePending(key) {
  if (!canPick()) return;
  if (pending.has(key)) pending.delete(key);
  else pending.add(key);
  drawBoard();
}

function updateSummary() {
  const myCount = Object.values(claimed).filter((b) => b.user_id === me?.id).length;
  const price = Number(settings?.price_per_box || 0);

  let text = `You have ${myCount} saved box${myCount === 1 ? "" : "es"}`;
  if (price) text += ` ($${myCount * price} owed)`;
  if (pending.size) {
    text += ` — ${pending.size} pending, not saved yet`;
    if (price) text += ` (+$${pending.size * price})`;
  }
  text += `. ${100 - Object.keys(claimed).length} boxes open.`;
  document.getElementById("squaresSummary").textContent = text;

  document.getElementById("saveSquaresBtn").style.display = pending.size ? "inline-block" : "none";
  document.getElementById("venmoBtn").textContent =
    price && myCount ? `Pay $${myCount * price} on Venmo` : "Pay on Venmo";
}

document.getElementById("saveSquaresBtn").addEventListener("click", async () => {
  if (!hasRealName()) {
    alert("Set your display name on the Picks page before saving boxes (it's what shows on the board).");
    return;
  }

  const count = pending.size;
  if (!confirm(`Save ${count} box${count === 1 ? "" : "es"}? Once saved, only the admin can remove them.`)) return;

  const rows = [...pending].map((key) => {
    const [r, c] = key.split("-").map(Number);
    return { row_num: r, col_num: c, user_id: me.id, display_name: me.display_name };
  });

  // one insert = all-or-nothing: if ANY box got taken meanwhile, none are saved
  const { error } = await supabaseClient.from("squares").insert(rows);

  if (error) {
    console.log("Squares save error:", error);
    if (error.code === "23505") {
      alert("Someone grabbed one of those boxes before you saved. The board has been refreshed — pick again.");
    } else {
      alert("Could not save your boxes — the board may be closed or the numbers already drawn.");
    }
  } else {
    alert(`Saved ${count} box${count === 1 ? "" : "es"}! Bryan will send you a Venmo request.`);
  }

  pending.clear();
  await loadClaimed();
  drawBoard();
});

// admin only: free up a box if someone backs out
async function removeBox(r, c) {
  const box = claimed[`${r}-${c}`];
  if (!confirm(`Remove ${box.display_name}'s box?`)) return;

  const { error } = await supabaseClient
    .from("squares").delete().eq("row_num", r).eq("col_num", c);
  if (error) {
    console.log("Squares delete error:", error);
    alert("Could not remove box.");
  }
  await loadClaimed();
  drawBoard();
}

loadSquares();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

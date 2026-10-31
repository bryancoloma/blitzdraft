const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// how many weeks to show across the top
const WEEKS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

// custom labels for playoff weeks (19-22 → PO1-PO4)
const WEEK_LABELS = {
  19: "PO1", 20: "PO2", 21: "PO3", 22: "PO4"
};
async function loadAdmin() {
  // 1. must be logged in
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) { window.location.href = "login.html"; return; }

  // 2. must be admin
  const { data: me } = await supabaseClient
    .from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();

  if (!me?.is_admin) {
    document.getElementById("adminBoard").innerHTML = "<p>Access denied.</p>";
    return;
  }

  loadSquaresAdmin();

  document.getElementById("adminWeek").textContent = "Payment Tracker";

  // 3. all players
  const { data: profiles } = await supabaseClient
    .from("profiles").select("id, display_name, actual_name");

  // 4. ALL payment records (every week)
  const { data: payments } = await supabaseClient
    .from("payments").select("user_id, week, paid");

  // lookup: paidLookup[user_id][week] = true/false
  const paidLookup = {};
  for (const p of payments) {
    if (!paidLookup[p.user_id]) paidLookup[p.user_id] = {};
    paidLookup[p.user_id][p.week] = p.paid;
  }

  // 5. build the grid
  let html = "<table><tr><th>Player</th>";
  for (const w of WEEKS) {
    html += `<th>${WEEK_LABELS[w] || "Wk " + w}</th>`;
  }
  html += "</tr>";

  for (const profile of profiles) {
    const name = profile.actual_name
      ? `${profile.display_name} (${profile.actual_name})`
      : profile.display_name;
    html += `<tr><td>${name}</td>`;

    for (const w of WEEKS) {
      const isPaid = paidLookup[profile.id]?.[w] || false;
      html += `<td><input type="checkbox" ${isPaid ? "checked" : ""} data-user="${profile.id}" data-week="${w}"></td>`;
    }

    html += "</tr>";
  }
  html += "</table>";

  document.getElementById("adminBoard").innerHTML = html;

  // 6. wire up each checkbox to save on change
  document.querySelectorAll("#adminBoard input[type=checkbox]").forEach((box) => {
    box.addEventListener("change", async () => {
      const userId = box.dataset.user;
      const week = parseInt(box.dataset.week);
      const paid = box.checked;

      const { error } = await supabaseClient
        .from("payments")
        .upsert({ user_id: userId, week: week, paid: paid }, { onConflict: "user_id, week" });

      if (error) {
        console.log("Payment save error:", error);
        box.checked = !paid; // revert the box if save failed
        alert("Could not save — are you the admin?");
      } else {
        console.log(`Saved: user ${userId}, week ${week}, paid ${paid}`);
      }
    });
  });
}

// Super Bowl Squares controls: notifications, on/off switch, price, teams/logos/colors, numbers
async function loadSquaresAdmin() {
  const box = document.getElementById("squaresAdmin");

  const { data: settings, error } = await supabaseClient
    .from("squares_settings").select("*").eq("id", 1).maybeSingle();

  if (error || !settings) {
    console.log("Squares settings error:", error);
    box.innerHTML = "<p>Squares settings not found — did you run sql/squares_setup.sql?</p>";
    return;
  }

  box.innerHTML = `
    <h2>Super Bowl Squares</h2>
    <div id="squaresNotify"></div>

    <label><input type="checkbox" id="squaresEnabled" ${settings.enabled ? "checked" : ""}> Squares board is open</label>
    &nbsp;&nbsp;
    <label>Price per box: $<input type="number" id="squaresPrice" min="0" step="1" style="width:60px;" value="${settings.price_per_box}"></label>
    <button id="saveSquaresPrice">Save Price</button>
    <a href="squares.html">View board</a>

    <h3>Teams &amp; Logos</h3>
    <div class="sq-admin-grid">
      <div class="sq-admin-card">
        <strong>Super Bowl logo</strong>
        <span class="sq-admin-sub">(corner)</span>
        ${logoPreview(settings.sb_logo_url)}
        <input type="file" accept="image/*" id="sbLogoFile">
        <button data-upload="sb">Upload</button>
      </div>
      <div class="sq-admin-card">
        <strong>Top team</strong>
        <span class="sq-admin-sub">(across the top)</span>
        ${logoPreview(settings.top_logo_url)}
        <input type="file" accept="image/*" id="topLogoFile">
        <button data-upload="top">Upload</button>
        <input type="text" id="topTeamName" placeholder="Team name">
        <label>Number bar color <input type="color" id="topColor"></label>
      </div>
      <div class="sq-admin-card">
        <strong>Side team</strong>
        <span class="sq-admin-sub">(down the left)</span>
        ${logoPreview(settings.side_logo_url)}
        <input type="file" accept="image/*" id="sideLogoFile">
        <button data-upload="side">Upload</button>
        <input type="text" id="sideTeamName" placeholder="Team name">
        <label>Number bar color <input type="color" id="sideColor"></label>
      </div>
    </div>
    <button id="saveTeamNames">Save Team Names &amp; Colors</button>

    <h3>Numbers</h3>
    <p id="squaresNumbersInfo"></p>
    <button id="randomizeBtn">Randomize Numbers</button>
    <button id="clearNumbersBtn">Clear Numbers</button>

    <h3>After the Game</h3>
    <p>Wipes the board for next year: every claimed box, the numbers, winners, team names, colors and logos,
      and turns the board OFF. Price per box is kept.</p>
    <button id="resetSquaresBtn" class="sq-danger">Reset Squares</button>
  `;

  // set team names with .value (not inside the HTML string) so quotes in a name can't break the page
  document.getElementById("topTeamName").value = settings.top_team || "";
  document.getElementById("sideTeamName").value = settings.side_team || "";
  document.getElementById("topColor").value = settings.top_color || "#1e3a8a";
  document.getElementById("sideColor").value = settings.side_color || "#1e3a8a";
  showNumbersInfo(settings);
  loadSquaresNotifications(settings);

  // the on/off switch saves as soon as you click it (same as payment checkboxes)
  const enabledBox = document.getElementById("squaresEnabled");
  enabledBox.addEventListener("change", async () => {
    const { error } = await supabaseClient
      .from("squares_settings").update({ enabled: enabledBox.checked }).eq("id", 1);
    if (error) {
      console.log("Squares toggle error:", error);
      enabledBox.checked = !enabledBox.checked; // revert if save failed
      alert("Could not save the squares switch.");
    } else {
      // show/hide the nav link on this page right away
      document.getElementById("squaresLink").style.display = enabledBox.checked ? "inline" : "none";
    }
  });

  document.getElementById("saveSquaresPrice").addEventListener("click", async () => {
    const price = parseFloat(document.getElementById("squaresPrice").value) || 0;
    const { error } = await supabaseClient
      .from("squares_settings").update({ price_per_box: price }).eq("id", 1);
    alert(error ? "Could not save price." : `Price saved: $${price} per box`);
  });

  document.getElementById("saveTeamNames").addEventListener("click", async () => {
    const { error } = await supabaseClient.from("squares_settings").update({
      top_team: document.getElementById("topTeamName").value.trim() || null,
      side_team: document.getElementById("sideTeamName").value.trim() || null,
      top_color: document.getElementById("topColor").value,
      side_color: document.getElementById("sideColor").value,
    }).eq("id", 1);
    alert(error ? "Could not save team names/colors." : "Team names & colors saved.");
  });

  // logo uploads: file → Supabase Storage bucket "squares" → save its public URL in settings
  document.querySelectorAll("#squaresAdmin button[data-upload]").forEach((btn) => {
    btn.addEventListener("click", () => uploadLogo(btn.dataset.upload));
  });

  document.getElementById("randomizeBtn").addEventListener("click", randomizeNumbers);
  document.getElementById("clearNumbersBtn").addEventListener("click", clearNumbers);
  document.getElementById("resetSquaresBtn").addEventListener("click", resetSquares);
}

// Notifications: every Save on the board inserts all its boxes in ONE insert, so they share
// the same created_at. Grouping by (player, created_at) turns rows back into "saves".
async function loadSquaresNotifications(settings) {
  const el = document.getElementById("squaresNotify");
  const price = Number(settings.price_per_box || 0);

  const { data: rows, error } = await supabaseClient
    .from("squares").select("user_id, display_name, created_at").order("created_at", { ascending: false }).order("user_id"); // keeps each save's rows together
  if (error) { console.log("Squares notify error:", error); return; }

  const saves = [];   // [{ name, count, at }] newest first
  const totals = {};  // totals[user_id] = { name, count }
  for (const r of rows) {
    const last = saves[saves.length - 1];
    if (last && last.user_id === r.user_id && last.at === r.created_at) last.count++;
    else saves.push({ user_id: r.user_id, name: r.display_name, count: 1, at: r.created_at });

    if (!totals[r.user_id]) totals[r.user_id] = { name: r.display_name, count: 0 };
    totals[r.user_id].count++;
  }

  const seenAt = settings.admin_seen_at ? new Date(settings.admin_seen_at) : null;
  const newSaves = saves.filter((sv) => !seenAt || new Date(sv.at) > seenAt);
  const money = (n) => (price ? ` — $${n * price}` : "");

  // build with DOM + textContent so player names can't inject HTML
  el.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "sq-notify";

  const title = document.createElement("strong");
  title.textContent = newSaves.length
    ? `🔔 ${newSaves.length} new squares save${newSaves.length === 1 ? "" : "s"}`
    : "No new squares saves";
  panel.appendChild(title);

  if (newSaves.length) {
    const list = document.createElement("ul");
    for (const sv of newSaves) {
      const li = document.createElement("li");
      li.textContent = `${sv.name} claimed ${sv.count} box${sv.count === 1 ? "" : "es"}${money(sv.count)} · ${new Date(sv.at).toLocaleString()}`;
      list.appendChild(li);
    }
    panel.appendChild(list);

    const seenBtn = document.createElement("button");
    seenBtn.textContent = "Mark all seen";
    seenBtn.addEventListener("click", async () => {
      // use the newest save's time (not "now") so a save landing this second isn't skipped
      const { error } = await supabaseClient
        .from("squares_settings").update({ admin_seen_at: saves[0].at }).eq("id", 1);
      if (error) alert("Could not mark as seen.");
      else loadSquaresAdmin();
    });
    panel.appendChild(seenBtn);
  }

  // running totals per player = what to charge on Venmo
  const players = Object.values(totals).sort((a, b) => b.count - a.count);
  if (players.length) {
    const sum = document.createElement("p");
    sum.className = "sq-notify-totals";
    sum.textContent = "Totals: " + players.map((p) => `${p.name} ${p.count}${money(p.count)}`).join(" · ");
    panel.appendChild(sum);
  }

  el.appendChild(panel);
}

function logoPreview(url) {
  return url ? `<img src="${url}" class="sq-admin-logo" alt="logo">` : `<div class="sq-admin-logo sq-admin-nologo">no logo yet</div>`;
}

function showNumbersInfo(settings) {
  const el = document.getElementById("squaresNumbersInfo");
  if (settings.top_numbers) {
    el.textContent = `Drawn — top: ${settings.top_numbers.join(" ")} | side: ${settings.side_numbers.join(" ")}. Board is locked for new picks.`;
  } else {
    el.textContent = "Not drawn yet. Players can still pick boxes. Randomize once the board fills up.";
  }
}

// which = "sb", "top", or "side"
async function uploadLogo(which) {
  const fileInput = document.getElementById(`${which}LogoFile`);
  const file = fileInput.files[0];
  if (!file) { alert("Choose an image file first."); return; }

  // timestamp in the filename so a replaced logo never shows the old cached image
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${which}_logo_${Date.now()}.${ext}`;

  const { error: upErr } = await supabaseClient.storage
    .from("squares").upload(path, file, { contentType: file.type });
  if (upErr) {
    console.log("Logo upload error:", upErr);
    alert("Upload failed — did you run sql/squares_storage.sql?");
    return;
  }

  const { data } = supabaseClient.storage.from("squares").getPublicUrl(path);
  const { error } = await supabaseClient
    .from("squares_settings").update({ [`${which}_logo_url`]: data.publicUrl }).eq("id", 1);

  if (error) {
    console.log("Logo URL save error:", error);
    alert("Uploaded, but could not save the logo to settings.");
  } else {
    loadSquaresAdmin(); // redraw so the new preview shows
  }
}

// shuffle 0-9 (Fisher-Yates: every order equally likely)
function shuffledDigits() {
  const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

async function randomizeNumbers() {
  const { count } = await supabaseClient
    .from("squares").select("*", { count: "exact", head: true });

  let msg = "Randomize the numbers? This LOCKS the board — players can't pick new boxes after this.";
  if (count < 100) msg = `Only ${count} of 100 boxes are claimed.\n\n` + msg;
  if (!confirm(msg)) return;

  const { error } = await supabaseClient.from("squares_settings").update({
    top_numbers: shuffledDigits(),
    side_numbers: shuffledDigits(),
  }).eq("id", 1);

  if (error) {
    console.log("Randomize error:", error);
    alert("Could not save numbers.");
  } else {
    loadSquaresAdmin();
  }
}

// undo a draw (re-opens the board for picks) — mainly for testing
async function clearNumbers() {
  if (!confirm("Clear the numbers? This re-opens the board for picks.")) return;
  const { error } = await supabaseClient.from("squares_settings")
    .update({ top_numbers: null, side_numbers: null }).eq("id", 1);
  if (error) alert("Could not clear numbers.");
  else loadSquaresAdmin();
}

loadAdmin();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});
// After the Super Bowl: wipe everything so the board is fresh next year
async function resetSquares() {
  const typed = prompt("This deletes ALL claimed boxes, numbers, winners, team names, colors and logos, and turns the board off.\n\nType RESET to confirm.");
  if (typed !== "RESET") return;

  // 1. every claimed box (delete needs a filter, so match all ids)
  const { error: boxErr } = await supabaseClient.from("squares").delete().gte("id", 0);
  if (boxErr) {
    console.log("Reset boxes error:", boxErr);
    alert("Could not delete the boxes — nothing was reset.");
    return;
  }

  // 2. every uploaded logo file (including old ones that were replaced)
  const { data: files, error: listErr } = await supabaseClient.storage.from("squares").list("", { limit: 1000 });
  if (listErr) console.log("Reset list logos error:", listErr);
  if (files?.length) {
    const { error: rmErr } = await supabaseClient.storage.from("squares").remove(files.map((f) => f.name));
    if (rmErr) console.log("Reset remove logos error:", rmErr);
  }

  // 3. settings back to a blank board (price_per_box kept)
  const { error: setErr } = await supabaseClient.from("squares_settings").update({
    enabled: false,
    sb_logo_url: null, top_logo_url: null, side_logo_url: null,
    top_team: null, side_team: null,
    top_numbers: null, side_numbers: null,
    top_color: "#1e3a8a", side_color: "#1e3a8a",
    admin_seen_at: null,
    winners: {},
  }).eq("id", 1);

  if (setErr) {
    console.log("Reset settings error:", setErr);
    alert("Boxes were deleted, but the settings could not be reset.");
  } else if (listErr) {
    alert("Board reset — but the logo files couldn't be listed for deletion (run the latest sql/squares_storage.sql).");
  } else {
    alert("Squares reset. The board is off and empty.");
  }

  document.getElementById("squaresLink").style.display = "none";
  loadSquaresAdmin();
}

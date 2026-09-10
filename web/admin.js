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

loadAdmin();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});
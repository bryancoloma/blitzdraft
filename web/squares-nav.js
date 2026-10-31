// Shared by every page: shows the "Squares" nav link only when the admin has the board turned on.
// Loaded AFTER the page's own script, so it reuses that page's supabaseClient.
async function showSquaresLink() {
  const link = document.getElementById("squaresLink");
  if (!link) return;

  const { data } = await supabaseClient
    .from("squares_settings")
    .select("enabled")
    .eq("id", 1)
    .maybeSingle();

  if (data?.enabled) {
    link.style.display = "inline";
  }
}

showSquaresLink();

// Admin only: "Admin 🔔3" on the nav when there are squares saves the admin hasn't marked seen
async function showSquaresBadge() {
  const badge = document.getElementById("squaresBadge");
  if (!badge) return;

  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData.user) return;
  const { data: me } = await supabaseClient
    .from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
  if (!me?.is_admin) return;

  const { data: settings } = await supabaseClient
    .from("squares_settings").select("admin_seen_at").eq("id", 1).maybeSingle();
  const { data: rows } = await supabaseClient.from("squares").select("user_id, created_at");

  // one Save = one insert = one shared created_at, so count distinct (player, time) pairs
  const seenAt = settings?.admin_seen_at ? new Date(settings.admin_seen_at) : null;
  const newSaves = new Set();
  for (const r of rows || []) {
    if (!seenAt || new Date(r.created_at) > seenAt) newSaves.add(`${r.user_id}|${r.created_at}`);
  }

  if (newSaves.size) {
    badge.textContent = ` 🔔${newSaves.size}`;
    badge.style.display = "inline";
  }
}

showSquaresBadge();

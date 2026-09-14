const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

document.getElementById("updatePasswordBtn").addEventListener("click", async () => {
  const newPassword = document.getElementById("newPassword").value;

  if (!newPassword || newPassword.length < 6) {
    document.getElementById("resetMsg").textContent = "Password must be at least 6 characters.";
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  if (error) {
    console.log("Update error:", error);
    document.getElementById("resetMsg").textContent = "Could not update. The reset link may have expired — request a new one.";
  } else {
    document.getElementById("resetMsg").textContent = "Password updated! Redirecting to login...";
    setTimeout(() => { window.location.href = "login.html"; }, 2000);
  }
});
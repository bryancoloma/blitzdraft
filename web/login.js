// connect to Supabase
const SUPABASE_URL = "https://lhquczyekypbnlsdelsc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_E4G8S_HtDAdNB294_QomLA_vLlHMuIR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// SIGN UP
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    console.log("Signup error:", error);
  } else {
    // account created — now save their display name to profiles
    const displayName = document.getElementById("displayName").value;

    await supabaseClient.from("profiles").insert({
      id: data.user.id,
      display_name: displayName,
    });

    console.log("Signed up + profile created:", displayName);
    window.location.href = "index.html";   // send them straight to the games
  }
});

// LOG IN
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    console.log("Login error:", error);
  } else {
    console.log("Logged in! Sending to games...");
    window.location.href = "index.html";   // ← redirect to the games page
  }
});
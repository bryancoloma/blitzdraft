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
    // create their profile row with a placeholder name (they set it on the picks page)
    await supabaseClient.from("profiles").insert({
      id: data.user.id,
      display_name: "Player",
    });

    console.log("Signed up + profile created");
    window.location.href = "index.html";
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

// FORGOT PASSWORD — send reset email
document.getElementById("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  if (!email) {
    alert("Enter your email first, then click Forgot password.");
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://bryancoloma.github.io/blitzdraft/web/reset.html"
  });

  if (error) {
    console.log("Reset error:", error);
    alert("Something went wrong. Try again.");
  } else {
    alert("Password reset email sent! Check your inbox (and spam folder).");
  }
});
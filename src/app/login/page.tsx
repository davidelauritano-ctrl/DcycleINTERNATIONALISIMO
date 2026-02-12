"use client";

import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";

const BUILD_ID = "v5-20260212"; // version marker to confirm deploy

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const authError = searchParams.get("error");

  // Check env vars are available at build time
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const envOk = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

  useEffect(() => {
    if (authError === "auth_callback_failed") {
      setError("Authentication failed. Please try again.");
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!envOk) {
      setError("Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.");
      setLoading(false);
      return;
    }

    try {
      // Create client directly — no Proxy, no import indirection
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage("Check your email for a confirmation link.");
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
        } else if (!data.session) {
          setError(
            "Sign-in succeeded but no session was returned. Your email may not be confirmed — check Supabase dashboard."
          );
        } else {
          // Session stored in cookies by createBrowserClient — do a hard navigate
          setMessage("Signed in! Redirecting...");
          window.location.href = redirectTo;
          return; // keep loading state while page navigates
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Login error: ${msg}`);
    }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    if (!envOk) {
      setError("Supabase env vars are missing.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (magicError) {
        setError(magicError.message);
      } else {
        setMessage("Check your email for the magic link.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Magic link error: ${msg}`);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
          <span className="text-primary-foreground font-bold text-lg">D</span>
        </div>
        <h1 className="text-xl font-semibold">Dcycle International</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paid Media Tracker
        </p>
      </div>

      {!envOk && (
        <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg mb-4">
          Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables, then redeploy.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@dcycle.io"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Min. 6 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          Send Magic Link
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </form>

      <p className="text-center text-xs text-muted-foreground/50 mt-6">
        {BUILD_ID}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

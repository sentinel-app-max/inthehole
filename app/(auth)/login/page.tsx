"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from "@/lib/firebase/auth";
import type { AuthError } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      const authErr = err as AuthError;
      console.error("Google auth error:", authErr);
      if (authErr.code === "auth/popup-closed-by-user") {
        setError("");
      } else if (authErr.code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups and try again.");
      } else {
        setError(authErr.message || "Google sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
      router.push("/");
    } catch (err) {
      const authErr = err as AuthError;
      console.error("Email auth error:", authErr);
      if (authErr.code === "auth/wrong-password" || authErr.code === "auth/invalid-credential") {
        setError("Incorrect password. Please try again.");
      } else if (authErr.code === "auth/user-not-found") {
        setError("No account found. Please create one first.");
      } else if (authErr.code === "auth/email-already-in-use") {
        setError("Account already exists. Try signing in instead.");
      } else if (authErr.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (authErr.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else {
        setError(authErr.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 bg-[#0a0a0a] overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/videos/V1.mp4" type="video/mp4" />
      </video>
      {/* Dark overlay */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-[#c9a84c]">
            inthehole
          </h1>
          <p className="mt-2 text-lg font-semibold text-white/80">
            Clean. Score. Perfect.
          </p>
          <p className="mt-1 text-xs text-white/30">
            A free tool by Clean Harry
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-[#e63946]/20 px-4 py-2 text-center text-sm text-[#e63946]">
            {error}
          </p>
        )}

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0a0a0a] shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/30">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmail} className="space-y-3">
          {isSignUp && (
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a84c]/50"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a84c]/50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a84c]/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-bold shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 bg-[#c9a84c] text-[#0a0a0a]"
          >
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm text-white/40">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="font-semibold underline text-[#c9a84c]"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

        {/* Footer */}
        <p className="text-center text-xs text-white/20">
          <a
            href="https://cleanharry.world"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40"
          >
            cleanharry.world
          </a>
        </p>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setWorking(true);
    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const body = await response.json();
        if (!response.ok) {
          setError(body.error ?? "Could not create your account.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(
          mode === "signin"
            ? "Incorrect email or password."
            : "Your account was created, but sign-in did not complete. Please try again."
        );
        return;
      }
      router.push("/products");
      router.refresh();
    } finally {
      setWorking(false);
    }
  };
  if (session?.user)
    return (
      <section className="page">
        <div className="form-card">
          <div className="eyebrow">Account</div>
          <h1>Hi, {session.user.name?.split(" ")[0]}.</h1>
          <p>You&apos;re signed in as {session.user.email}.</p>
          <button className="button" onClick={() => router.push("/orders")}>
            View your orders
          </button>
          <button
            className="link-button"
            style={{ display: "block", margin: "18px auto 0" }}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
      </section>
    );
  return (
    <section className="page">
      <form className="form-card" onSubmit={submit}>
        <div className="eyebrow">Welcome in</div>
        <h1>{mode === "signin" ? "Sign in to FreshCart" : "Create your account"}</h1>
        <p>
          {mode === "signin"
            ? "Use your email and password to see your saved groceries and orders."
            : "Save favorites, track every order, and keep your receipts in one place."}
        </p>
        {mode === "signup" && (
          <label className="field">
            <span>Full name</span>
            <input
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jamie Rivera"
            />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jamie@example.com"
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            required
            minLength={8}
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button" type="submit" disabled={working}>
          {working ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          className="link-button auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
          }}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <p className="form-note">
          Passwords are hashed before they are saved. Your cart, wishlist, and orders are available
          only in your signed-in account.
        </p>
      </form>
    </section>
  );
}

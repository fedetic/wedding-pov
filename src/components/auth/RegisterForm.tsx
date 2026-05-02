"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "/dashboard",
    });

    if (error) {
      setError(error.message ?? "Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-semibold">Create account</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className="border rounded px-3 py-2 text-base font-normal"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="border rounded px-3 py-2 text-base font-normal"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="border rounded px-3 py-2 text-base font-normal"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white rounded px-4 py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-center">
        Already have an account?{" "}
        <a href="/login" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}

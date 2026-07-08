import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Code2, Sparkles, Zap, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — CodeMind" },
      {
        name: "description",
        content:
          "Sign in to CodeMind, the AI pair-programmer that reads, patches, and refactors your files in real time.",
      },
      { property: "og:title", content: "Sign in — CodeMind" },
      {
        property: "og:description",
        content: "Open your AI-powered workspace and start building with CodeMind.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://smart-code-env.lovable.app/auth" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — CodeMind" },
      {
        name: "twitter:description",
        content: "Open your AI-powered workspace and start building with CodeMind.",
      },
    ],
    links: [{ rel: "canonical", href: "https://smart-code-env.lovable.app/auth" }],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error(res.error.message ?? "Sign-in failed");
      setLoading(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="grid w-full max-w-5xl gap-8 md:grid-cols-2"
      >
        {/* Left: brand */}
        <div className="hidden flex-col justify-between md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight">CodeMind</div>
              <div className="text-xs text-muted-foreground">AI pair-programmer for any project</div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              Build, edit, and ship code
              <span className="block bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                with an AI that thinks first.
              </span>
            </h1>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                Reads, patches, and refactors your files in real time.
              </li>
              <li className="flex items-start gap-3">
                <Zap className="mt-0.5 h-4 w-4 text-primary" />
                Live preview, multi-file editing, and one-click rollback.
              </li>
              <li className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-primary" />
                Every change is snapshotted — nothing is ever lost.
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} CodeMind</p>
        </div>

        {/* Right: sign-in card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">CodeMind</h1>
              <p className="text-xs text-muted-foreground">AI-powered code editor</p>
            </div>
          </div>

          <h2 className="mb-1 text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Sign in to continue to your workspace.
          </p>

          <Button
            onClick={signIn}
            disabled={loading}
            className="group relative h-12 w-full gap-3 overflow-hidden text-base font-medium"
            size="lg"
          >
            <GoogleMark />
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Secure</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to our terms of service and privacy policy.
            <br />
            We never read your code without your explicit action.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12S6.7 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.4H12z"
      />
    </svg>
  );
}

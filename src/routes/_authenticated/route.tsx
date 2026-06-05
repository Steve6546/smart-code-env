import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Try to get session which is usually faster/cached
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Check if we have tokens in the URL hash (common in OAuth redirects)
      const hasHashToken = typeof window !== 'undefined' && window.location.hash.includes('access_token=');

      if (hasHashToken) {
        // Wait a tiny bit for Supabase to process the hash and set the session
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) return { user: retrySession.user };
      }

      // Final check with getUser (calls API)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw redirect({ to: "/auth" });
      }
      return { user };
    }

    return { user: session.user };
  },
  component: () => <Outlet />,
});

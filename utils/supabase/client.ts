// utils/supabase/client.ts
// ONE unified client for all browser-side pages.
// Every page must import from HERE — never from /browser or anywhere else.
import { createBrowserClient } from "@supabase/ssr";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Singleton — reuse the same instance so session is shared across pages
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return clientInstance;
}

// Alias so any file that imported createBrowserSupabaseClient still works
export const createBrowserSupabaseClient = createClient;
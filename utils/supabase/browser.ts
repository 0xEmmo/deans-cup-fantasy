/**
 * utils/supabase/browser.ts
 *
 * FIXED: Previously used @supabase/supabase-js directly which stores sessions
 * under different localStorage keys than @supabase/ssr (used in client.ts).
 * This caused the "session doesn't stick" bug — login worked but other pages
 * couldn't read the session because they were looking in the wrong place.
 *
 * Solution: Re-export from client.ts so the entire app shares ONE client
 * instance with ONE session storage location.
 */
export { createClient as createBrowserSupabaseClient } from "./client";
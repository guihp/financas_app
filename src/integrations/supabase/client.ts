import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Get Supabase configuration from environment variables
// Fallback to default values for local development
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYml3Z3V6Ymlvc2FveXJjdmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTgxNzIsImV4cCI6MjA4MzUzNDE3Mn0.g31h4C8ugNXinlYVGXL-GrP1TQxUOX-u-eqxhI_Rkjk";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
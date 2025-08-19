// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tqcjtvpnexjigmsqscfy.supabase.co"; 
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2p0dnBuZXhqaWdtc3FzY2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTExNzUsImV4cCI6MjA3MTE2NzE3NX0.8pToqRUB3e4ZotxE2Lc8Vj9AN87b1sIX5rLLHJO4kek"; // jangan pakai anon key untuk insert
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

// Couche d'accès aux données.
// Deux moteurs avec la même interface :
//   - Supabase (production) ;
//   - Démo locale (navigateur seulement), pour essayer l'app sans compte.

import { createClient } from "@supabase/supabase-js";
import { createDemoBackend } from "./demo.js";

// La clé « publishable » est publique par conception : la sécurité vient
// des règles RLS côté Supabase (voir supabase/migrations/002_v2.sql).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qjnuksrjdymakizznkiy.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_5X7nWxX2nIobh_2eUN69Xw_jmF7U-HX";
const BUCKET = "job-files";

const DEMO_FLAG = "atelier-ops-demo";

export function isDemoRequested() {
  const p = new URLSearchParams(location.search);
  if (p.has("demo")) sessionStorage.setItem(DEMO_FLAG, "1");
  return sessionStorage.getItem(DEMO_FLAG) === "1";
}
export function setDemo(on) {
  if (on) sessionStorage.setItem(DEMO_FLAG, "1");
  else sessionStorage.removeItem(DEMO_FLAG);
}

function createSupabaseBackend() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "atelier-ops-auth" }
  });

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message || "Erreur Supabase");
    return data;
  };

  return {
    mode: "supabase",
    auth: {
      async session() { return check(await sb.auth.getSession()).session; },
      async signIn(email, password) { return check(await sb.auth.signInWithPassword({ email, password })).session; },
      async signOut() { await sb.auth.signOut(); },
      async resetPassword(email) {
        check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }));
      },
      async updatePassword(password) { check(await sb.auth.updateUser({ password })); },
      onChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session)); }
    },
    async list(table, { order = "created_at", ascending = false } = {}) {
      let q = sb.from(table).select("*");
      if (order) q = q.order(order, { ascending });
      return check(await q);
    },
    async get(table, id) {
      return check(await sb.from(table).select("*").eq("id", id).maybeSingle());
    },
    async insert(table, row) {
      return check(await sb.from(table).insert(row).select().single());
    },
    async update(table, id, patch) {
      return check(await sb.from(table).update(patch).eq("id", id).select().single());
    },
    async updateMany(table, ids, patch) {
      if (!ids.length) return [];
      return check(await sb.from(table).update(patch).in("id", ids).select());
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq("id", id));
    },
    files: {
      async upload(path, file) {
        check(await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined }));
        return path;
      },
      async url(path, seconds = 3600) {
        return check(await sb.storage.from(BUCKET).createSignedUrl(path, seconds)).signedUrl;
      },
      async remove(path) { check(await sb.storage.from(BUCKET).remove([path])); }
    }
  };
}

export const api = isDemoRequested() ? createDemoBackend() : createSupabaseBackend();

import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { settingsSchema } from "@/game/settings";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

const upsertSchema = z.object({
  op: z.literal("upsert"),
  code: ID,
  hostPeer: ID,
  hostName: z.string().trim().min(1).max(24),
  title: z.string().trim().min(1).max(40),
  isPublic: z.boolean(),
  settings: settingsSchema,
  players: z.number().int().min(1).max(8),
  status: z.enum(["open", "racing"]),
  names: z.array(z.string().max(24)).max(8),
});

const closeSchema = z.object({
  op: z.literal("close"),
  code: ID,
  hostPeer: ID,
});

const postSchema = z.discriminatedUnion("op", [upsertSchema, closeSchema]);

const globalRef = globalThis as typeof globalThis & {
  __foilLobbySchema__?: Promise<void>;
};

function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__foilLobbySchema__ ??= sql
    .query(
      `CREATE TABLE IF NOT EXISTS foil_lobbies (
         code TEXT PRIMARY KEY,
         host_peer TEXT NOT NULL,
         host_name TEXT NOT NULL,
         title TEXT NOT NULL,
         is_public BOOLEAN NOT NULL DEFAULT false,
         settings JSONB NOT NULL,
         players INTEGER NOT NULL DEFAULT 1,
         status TEXT NOT NULL DEFAULT 'open',
         names TEXT NOT NULL DEFAULT '[]',
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    )
    .then(() => undefined)
    .catch((err) => {
      globalRef.__foilLobbySchema__ = undefined;
      throw err;
    });
  return globalRef.__foilLobbySchema__;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

type LobbyRow = {
  code: string;
  host_name: string;
  title: string;
  is_public: boolean;
  settings: unknown;
  players: number;
  status: string;
  names: string;
};

function present(row: LobbyRow) {
  let names: string[] = [];
  try {
    const parsed = typeof row.names === "string" ? (JSON.parse(row.names) as unknown) : row.names;
    if (Array.isArray(parsed)) names = parsed.filter((n) => typeof n === "string");
  } catch {
    names = [];
  }
  let rawSettings: unknown = row.settings;
  if (typeof rawSettings === "string") {
    try {
      rawSettings = JSON.parse(rawSettings) as unknown;
    } catch {
      rawSettings = null;
    }
  }
  const settings = settingsSchema.safeParse(rawSettings);
  return {
    code: row.code,
    hostName: row.host_name,
    title: row.title,
    players: Number(row.players) || 1,
    status: row.status,
    names,
    settings: settings.success ? settings.data : null,
  };
}

async function handleGet(url: URL): Promise<Response> {
  const sql = await getSql();
  await ensureSchema(sql);
  await sql.query(`DELETE FROM foil_lobbies WHERE updated_at < now() - make_interval(secs => 90)`);
  const code = url.searchParams.get("code");
  if (code) {
    const parsed = ID.safeParse(code);
    if (!parsed.success) return json({ error: "bad code" }, 400);
    const rows = await sql.query<LobbyRow>(
      `SELECT code, host_name, title, is_public, settings, players, status, names
       FROM foil_lobbies
       WHERE code = $1 AND updated_at > now() - make_interval(secs => 25)`,
      [parsed.data],
    );
    const row = rows[0];
    if (!row) return json({ error: "missing" }, 404);
    return json({ lobby: present(row) });
  }
  const rows = await sql.query<LobbyRow>(
    `SELECT code, host_name, title, is_public, settings, players, status, names
     FROM foil_lobbies
     WHERE is_public = true AND status = 'open' AND updated_at > now() - make_interval(secs => 20)
     ORDER BY updated_at DESC
     LIMIT 40`,
  );
  return json({ lobbies: rows.map(present) });
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const sql = await getSql();
  await ensureSchema(sql);
  const msg = parsed.data;
  if (msg.op === "close") {
    await sql.query(`DELETE FROM foil_lobbies WHERE code = $1 AND host_peer = $2`, [msg.code, msg.hostPeer]);
    return json({ ok: true });
  }
  const existing = await sql.query<{ host_peer: string; fresh: boolean | string }>(
    `SELECT host_peer, (updated_at > now() - make_interval(secs => 25)) AS fresh
     FROM foil_lobbies WHERE code = $1`,
    [msg.code],
  );
  const row = existing[0];
  const fresh = row?.fresh === true || row?.fresh === "t" || row?.fresh === "true";
  if (row && row.host_peer !== msg.hostPeer && fresh) return json({ error: "taken" }, 409);
  await sql.query(
    `INSERT INTO foil_lobbies
       (code, host_peer, host_name, title, is_public, settings, players, status, names, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, now())
     ON CONFLICT (code) DO UPDATE SET
       host_peer = EXCLUDED.host_peer,
       host_name = EXCLUDED.host_name,
       title = EXCLUDED.title,
       is_public = EXCLUDED.is_public,
       settings = EXCLUDED.settings,
       players = EXCLUDED.players,
       status = EXCLUDED.status,
       names = EXCLUDED.names,
       updated_at = now()`,
    [
      msg.code,
      msg.hostPeer,
      msg.hostName,
      msg.title,
      msg.isPublic,
      JSON.stringify(msg.settings),
      msg.players,
      msg.status,
      JSON.stringify(msg.names),
    ],
  );
  return json({ ok: true, code: msg.code });
}

export async function handleLobbies(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[lobbies]", error);
    return json({ error: "lobby failed" }, 500);
  }
}

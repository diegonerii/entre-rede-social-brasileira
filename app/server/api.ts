// The hosting gateway owns authentication. This module only accepts verified identity.
export type Identity = { id: string; name: string } | null;
export type ApiContext = { db: D1Database; bucket?: R2Bucket; user: Identity; localPreview?: boolean };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const id = () => crypto.randomUUID();
const now = () => Date.now();
function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string") { if (required) fail(400, "Preencha os campos obrigatórios."); return ""; }
  const v = value.trim();
  if (v.length > max || (required && !v)) fail(400, `Use entre ${required ? 1 : 0} e ${max} caracteres.`);
  return v;
}
const mediaPath = (userId: string) => `/api/media/${encodeURIComponent(userId)}/`;
function ownedMedia(value: unknown, userId: string) {
  const v = text(value, 400);
  if (v && (!v.startsWith(mediaPath(userId)) || v.includes("..") || v.includes("?") || v.includes("#"))) fail(400, "Use um arquivo enviado pela sua conta.");
  return v;
}
export async function handleApi(request: Request, ctx: ApiContext): Promise<Response> {
  try { return await dispatch(request, ctx); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error("API error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível concluir. Tente novamente em instantes." }, 500);
  }
}
async function dispatch(request: Request, { db, bucket, user, localPreview }: ApiContext): Promise<Response> {
  const url = new URL(request.url), path = url.pathname.slice(5).replace(/\/$/, "");
  const q = url.searchParams, method = request.method;
  const one = async <T = Record<string, any>>(sql: string, ...args: any[]) => db.prepare(sql).bind(...args).first<T>();
  const all = async <T = Record<string, any>>(sql: string, ...args: any[]) => (await db.prepare(sql).bind(...args).all<T>()).results;
  const run = (sql: string, ...args: any[]) => db.prepare(sql).bind(...args).run();
  const me = user?.id ?? "";
  const requireUser = () => { if (!user) fail(401, "Entre na sua conta para continuar."); return me; };
  const notBlocked = async (target: string) => {
    if (await one("SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)", me, target, target, me)) fail(403, "Esta interação está indisponível.");
  };
  const existsUser = async (target: string) => { if (!await one("SELECT id FROM users WHERE id=?", target)) fail(404, "Pessoa não encontrada."); await notBlocked(target); };
  const getPost = async (target: string) => { const p = await one("SELECT * FROM posts WHERE id=?", target); if (!p) fail(404, "Publicação não encontrada."); await notBlocked(p!.user_id); return p!; };
  const notify = async (to: string, kind: string, target: string) => {
    if (to === me) return;
    await run("INSERT INTO notifications(id,user_id,actor_id,kind,target_id,created_at) VALUES(?,?,?,?,?,?)", id(), to, me, kind, target, now());
  };

  // Media can be public; private inbox records never share this route.
  if (path.startsWith("media/") && method === "GET") {
    if (!bucket) fail(503, "Armazenamento de arquivos indisponível.");
    const key = path.slice(6);
    if (key.includes("..")) fail(400, "Arquivo inválido.");
    const object = await bucket!.get(key);
    if (!object) fail(404, "Arquivo não encontrado.");
    const headers = new Headers({ "Content-Type": object!.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
    return new Response(object!.body, { headers });
  }
  if (method !== "GET") {
    requireUser();
    if (request.headers.get("origin") !== url.origin) fail(403, "Origem da requisição inválida.");
  }
  if (user) {
    const handleBase = me.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 14) || "user";
    const defaultHandle = `pessoa_${handleBase}_${await shortHash(me)}`;
    await run("INSERT OR IGNORE INTO users(id,handle,name,created_at) VALUES(?,?,?,?)", me, defaultHandle, user.name.slice(0, 60), now());
  }
  if (path === "bootstrap" && method === "GET") {
    const profile = user ? await one("SELECT * FROM users WHERE id=?", me) : null;
    const profileInterests = String(profile?.interests || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const affinitySql = profileInterests.length ? profileInterests.map(() => "CASE WHEN lower(COALESCE(u.interests,'')) LIKE ? OR lower(COALESCE(u.bio,'')) LIKE ? THEN 1 ELSE 0 END").join(" + ") : "0";
    const people = await all(`SELECT u.*, EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=u.id) AS isFollowing,
      (SELECT COUNT(*) FROM follows WHERE following_id=u.id) AS followers,
      (SELECT COUNT(*) FROM follows a JOIN follows b ON a.following_id=b.following_id WHERE a.follower_id=? AND b.follower_id=u.id) +
      (SELECT COUNT(*) FROM memberships a JOIN memberships b ON a.community_id=b.community_id WHERE a.user_id=? AND b.user_id=u.id) AS common,
      ${affinitySql} AS affinity
      FROM users u WHERE u.id!=? AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=u.id) OR (user_id=u.id AND blocked_id=?))
      ORDER BY isFollowing ASC, affinity DESC, common DESC, u.created_at ASC LIMIT 60`,
      me, me, me, ...profileInterests.flatMap(value => [`%${value}%`, `%${value}%`]), me, me, me);
    const groups = await all(`SELECT c.*, (SELECT COUNT(*) FROM memberships WHERE community_id=c.id) AS members,
      EXISTS(SELECT 1 FROM memberships WHERE community_id=c.id AND user_id=?) AS joined FROM communities c ORDER BY members DESC,c.created_at LIMIT 100`, me);
    const joinedGroups = me ? await all(`SELECT c.*, (SELECT COUNT(*) FROM memberships WHERE community_id=c.id) AS members,
      1 AS joined FROM communities c WHERE EXISTS(SELECT 1 FROM memberships WHERE community_id=c.id AND user_id=?) ORDER BY c.created_at DESC`, me) : [];
    const communities = Array.from(new Map([...groups, ...joinedGroups].map(group => [group.id, group])).values());
    const unread = me ? await one("SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read=0", me) : { n: 0 };
    const unreadMessages = me ? await one("SELECT COUNT(*) AS n FROM messages WHERE to_id=? AND read=0 AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=messages.from_id) OR (user_id=messages.from_id AND blocked_id=?))", me, me, me) : { n: 0 };
    return json({ me: profile, users: people, communities, unread: unread?.n, unreadMessages: unreadMessages?.n, localPreview: !!localPreview });
  }
  if (path === "feed" && method === "GET") {
    const viewer = me ? await one<{ interests?: string }>("SELECT interests FROM users WHERE id=?", me) : null;
    const interestTerms = String(viewer?.interests || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8);
    const relevanceArgs: any[] = [];
    let relevance = "0";
    if (me) {
      relevance = "(CASE WHEN p.user_id=? THEN 4 ELSE 0 END + CASE WHEN EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=p.user_id) THEN 6 ELSE 0 END + CASE WHEN EXISTS(SELECT 1 FROM memberships mine JOIN memberships shared ON shared.community_id=mine.community_id WHERE mine.user_id=? AND shared.user_id=? AND shared.community_id=p.community_id) THEN 3 ELSE 0 END";
      relevanceArgs.push(me, me, me, me);
      for (const term of interestTerms) {
        relevance += " + CASE WHEN lower(COALESCE(p.tags,'')) LIKE ? OR lower(COALESCE(p.body,'')) LIKE ? OR lower(COALESCE(p.title,'')) LIKE ? THEN 2 ELSE 0 END";
        relevanceArgs.push(`%${term}%`, `%${term}%`, `%${term}%`);
      }
      relevance += ")";
    }
    const args: any[] = [...relevanceArgs, me, me, me, me, me];
    let where = "NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=p.user_id) OR (user_id=p.user_id AND blocked_id=?))";
    if (q.get("userId")) { where += " AND (p.user_id=? OR EXISTS(SELECT 1 FROM reposts WHERE post_id=p.id AND user_id=?))"; args.push(q.get("userId"), q.get("userId")); }
    else if (q.get("tab") === "following") { where += " AND (p.user_id=? OR EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=p.user_id) OR EXISTS(SELECT 1 FROM reposts r JOIN follows f ON f.following_id=r.user_id WHERE r.post_id=p.id AND f.follower_id=?))"; args.push(me, me, me); }
    else if (q.get("tab") === "communities") { where += " AND EXISTS(SELECT 1 FROM memberships WHERE community_id=p.community_id AND user_id=?)"; args.push(me); }
    if (q.get("communityId")) { where += " AND p.community_id=?"; args.push(q.get("communityId")); }
    if (q.get("saved") === "1") { requireUser(); where += " AND EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?)"; args.push(me); }
    if (q.get("q")) { where += " AND (p.body LIKE ? ESCAPE '\\' OR p.title LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\')"; const term = `%${text(q.get("q"), 100).replace(/[\\%_]/g, "\\$&")}%`; args.push(term, term, term); }
    if (q.get("cursor")) { const cursor = Number(q.get("cursor")); if (!Number.isSafeInteger(cursor) || cursor < 0) fail(400, "Cursor inválido."); where += " AND p.rowid<?"; args.push(cursor); }
    const rows = await all(`SELECT p.*, p.rowid AS cursor,u.name,u.handle,u.avatar,c.name AS community_name,
      ${relevance} AS relevance,
      (SELECT COUNT(*) FROM reactions WHERE post_id=p.id AND value=1) AS likes,
      (SELECT COUNT(*) FROM reactions WHERE post_id=p.id AND value=-1) AS dislikes,
      (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments,
      (SELECT COUNT(*) FROM reposts WHERE post_id=p.id) AS reposts,
      COALESCE((SELECT value FROM reactions WHERE post_id=p.id AND user_id=?),0) AS reaction,
      EXISTS(SELECT 1 FROM reposts WHERE post_id=p.id AND user_id=?) AS reposted,
      EXISTS(SELECT 1 FROM bookmarks WHERE post_id=p.id AND user_id=?) AS saved
      FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN communities c ON c.id=p.community_id WHERE ${where}
      ORDER BY relevance DESC, p.rowid DESC LIMIT 21`, ...args);
    const hasMore = rows.length > 20;
    return json({ posts: rows.slice(0, 20), cursor: hasMore ? rows[19].cursor : null });
  }
  if (path.startsWith("users/") && method === "GET") {
    const target = decodeURIComponent(path.slice(6)); await existsUser(target);
    const profile = await one(`SELECT u.*, (SELECT COUNT(*) FROM follows WHERE following_id=u.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id=u.id) AS following, (SELECT COUNT(*) FROM posts WHERE user_id=u.id) AS postCount,
      EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=u.id) AS isFollowing FROM users u WHERE u.id=?`, me, target);
    const testimonials = await all(`SELECT t.*,u.name,u.handle,u.avatar,u.id AS user_id FROM testimonials t JOIN users u ON u.id=t.from_id
      WHERE t.to_id=? AND (t.status='approved' OR t.to_id=? OR t.from_id=?)
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=t.from_id) OR (user_id=t.from_id AND blocked_id=?)) ORDER BY t.created_at DESC LIMIT 100`, target, me, me, me, me);
    return json({ profile, testimonials });
  }
  if (path.startsWith("communities/") && method === "GET") {
    const target = decodeURIComponent(path.slice("communities/".length));
    const community = await one(`SELECT c.*, (SELECT COUNT(*) FROM memberships WHERE community_id=c.id) AS members,
      EXISTS(SELECT 1 FROM memberships WHERE community_id=c.id AND user_id=?) AS joined FROM communities c WHERE c.id=?`, me, target);
    if (!community) fail(404, "Comunidade não encontrada.");
    return json({ community });
  }
  if (path.startsWith("comments/") && method === "GET") {
    const target = decodeURIComponent(path.slice(9)); await getPost(target);
    const rawCursor = q.get("cursor");
    const cursor = rawCursor === null || rawCursor === "" ? undefined : Number(rawCursor);
    if (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor < 0)) fail(400, "Cursor inválido.");
    const cursorFilter = cursor === undefined ? "" : " AND c.rowid<?";
    const args = cursor === undefined ? [target, me, me] : [target, me, me, cursor];
    const rows = await all(`SELECT c.*, c.rowid AS cursor,u.name,u.handle,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=?
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=c.user_id) OR (user_id=c.user_id AND blocked_id=?))${cursorFilter} ORDER BY c.rowid DESC LIMIT 201`, ...args);
    const hasMore = rows.length > 200;
    const comments = rows.slice(0, 200).reverse();
    return json({ comments, cursor: hasMore ? rows[199].cursor : null });
  }
  if (path === "messages" && method === "GET") {
    requireUser(); const peer = q.get("peer");
    if (peer) {
      await existsUser(peer);
      await run("UPDATE messages SET read=1 WHERE from_id=? AND to_id=?", peer, me);
      const rows = await all("SELECT * FROM (SELECT * FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY created_at DESC LIMIT 200) ORDER BY created_at ASC", me, peer, peer, me);
      return json(rows);
    }
    return json(await all(`SELECT u.*,
      (SELECT body FROM messages WHERE (from_id=? AND to_id=u.id) OR (from_id=u.id AND to_id=?) ORDER BY created_at DESC LIMIT 1) AS lastBody,
      (SELECT MAX(created_at) FROM messages WHERE (from_id=? AND to_id=u.id) OR (from_id=u.id AND to_id=?)) AS lastAt,
      (SELECT COUNT(*) FROM messages WHERE from_id=u.id AND to_id=? AND read=0) AS unread
      FROM users u WHERE u.id!=? AND EXISTS(SELECT 1 FROM messages WHERE (from_id=? AND to_id=u.id) OR (from_id=u.id AND to_id=?))
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=u.id) OR (user_id=u.id AND blocked_id=?)) ORDER BY lastAt DESC LIMIT 100`, me, me, me, me, me, me, me, me, me, me));
  }
  if (path === "notifications" && method === "GET") {
    requireUser(); const rows = await all(`SELECT n.*,u.name,u.avatar,u.handle FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.user_id=?
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=n.actor_id) OR (user_id=n.actor_id AND blocked_id=?)) ORDER BY n.created_at DESC LIMIT 100`, me, me, me);
    await run("UPDATE notifications SET read=1 WHERE user_id=?", me);
    return json(rows);
  }
  if (path === "blocks" && method === "GET") { requireUser(); return json(await all("SELECT u.* FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=?", me)); }

  if (path === "upload" && method === "POST") {
    if (!bucket) fail(503, "Armazenamento de arquivos indisponível.");
    const length = Number(request.headers.get("content-length"));
    if (length > 26 * 1024 * 1024) fail(413, "O arquivo deve ter até 25 MB.");
    const form = await request.formData(); const file = form.get("file");
    if (!file || typeof file === "string" || file.size > 25 * 1024 * 1024 || file.size < 12) fail(400, "Envie uma foto ou vídeo de até 25 MB.");
    const f = file as File; const bytes = new Uint8Array(await f.slice(0, 32).arrayBuffer());
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    let type = "", ext = "";
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { type = "image/jpeg"; ext = "jpg"; }
    if (bytes[0] === 137 && ascii(1, 4) === "PNG") { type = "image/png"; ext = "png"; }
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") { type = "image/webp"; ext = "webp"; }
    if (ascii(4, 8) === "ftyp" && /isom|mp4|avc1|M4V|iso2/.test(ascii(8, 32))) { type = "video/mp4"; ext = "mp4"; }
    if (bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) { type = "video/webm"; ext = "webm"; }
    if (!type || (f.type && f.type !== type)) fail(400, "Formatos aceitos: JPG, PNG, WEBP, MP4 e WEBM.");
    const key = `${encodeURIComponent(me)}/${id()}.${ext}`;
    await bucket!.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: type } });
    return json({ url: `/api/media/${key}`, kind: type.startsWith("image") ? "photo" : "video" }, 201);
  }
  if (method === "GET") fail(404, "Página não encontrada.");
  if (Number(request.headers.get("content-length")) > 20000) fail(413, "Conteúdo muito longo.");
  let b: Record<string, any>;
  try { b = await request.json(); if (!b || typeof b !== "object" || Array.isArray(b)) fail(400, "Conteúdo inválido."); }
  catch { fail(400, "Conteúdo inválido."); }
  const body = b!;
  if (path === "profile" && method === "PATCH") {
    const handle = text(body.handle, 30, true).toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) fail(400, "O nome de usuário precisa de 3 a 30 letras, números ou sublinhado.");
    if (await one("SELECT 1 FROM users WHERE handle=? AND id!=?", handle, me)) fail(409, "Este nome de usuário já está em uso.");
    await run("UPDATE users SET name=?,handle=?,bio=?,location=?,interests=?,avatar=? WHERE id=?", text(body.name, 60, true), handle, text(body.bio, 300), text(body.location, 80), text(body.interests, 160), ownedMedia(body.avatar, me), me);
    return json({ ok: true });
  }
  if (path === "posts" && method === "POST") {
    const kind = text(body.kind, 10, true), media = ownedMedia(body.media, me);
    if (!["text", "photo", "video"].includes(kind)) fail(400, "Tipo de publicação inválido.");
    if (kind !== "text" && !media) fail(400, "Envie o arquivo antes de publicar.");
    if (kind === "photo" && !/\.(jpg|png|webp)$/.test(media)) fail(400, "Escolha uma fotografia.");
    if (kind === "video" && !/\.(mp4|webm)$/.test(media)) fail(400, "Escolha um vídeo.");
    if (media && (!bucket || !await bucket.head(media.slice(11)))) fail(400, "Arquivo não encontrado. Envie novamente.");
    const community = text(body.communityId, 100) || null;
    if (community && !await one("SELECT 1 FROM memberships WHERE user_id=? AND community_id=?", me, community)) fail(403, "Entre na comunidade antes de publicar nela.");
    const postId = id();
    await run("INSERT INTO posts(id,user_id,community_id,kind,title,body,media,tags,created_at) VALUES(?,?,?,?,?,?,?,?,?)", postId, me, community, kind, text(body.title, 120), text(body.body, 10000, kind === "text"), kind === "text" ? "" : media, text(body.tags, 200).split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8).join(","), now());
    return json({ id: postId }, 201);
  }
  if (path.startsWith("posts/") && method === "DELETE") {
    const p = await getPost(path.slice(6)); if (p.user_id !== me) fail(403, "Você só pode apagar suas publicações.");
    await run("DELETE FROM posts WHERE id=?", p.id); return json({ ok: true });
  }
  if (["reactions", "reposts", "bookmarks", "comments", "reports"].includes(path) && method === "POST") {
    const p = await getPost(text(body.postId, 100, true));
    if (path === "reactions") {
      if (![1, -1].includes(body.value)) fail(400, "Reação inválida.");
      // A single atomic UPSERT toggles or replaces the vote, even on concurrent requests.
      await run("INSERT INTO reactions(user_id,post_id,value) VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET value=CASE WHEN reactions.value=excluded.value THEN 0 ELSE excluded.value END", me, p.id, body.value);
      return json({ ok: true });
    }
    if (path === "reposts" || path === "bookmarks") {
      const table = path;
      const old = await one(`SELECT 1 FROM ${table} WHERE user_id=? AND post_id=?`, me, p.id);
      if (old) await run(`DELETE FROM ${table} WHERE user_id=? AND post_id=?`, me, p.id);
      else if (path === "reposts") { await run("INSERT OR IGNORE INTO reposts(user_id,post_id,created_at) VALUES(?,?,?)", me, p.id, now()); await notify(p.user_id, "repost", p.id); }
      else await run("INSERT OR IGNORE INTO bookmarks(user_id,post_id) VALUES(?,?)", me, p.id);
      return json({ active: !old });
    }
    if (path === "reports") {
      await run("INSERT OR IGNORE INTO reports(id,user_id,post_id,reason,created_at) VALUES(?,?,?,?,?)", id(), me, p.id, text(body.reason, 1000, true), now());
      return json({ ok: true });
    }
    const commentId = id(); await run("INSERT INTO comments(id,user_id,post_id,body,created_at) VALUES(?,?,?,?,?)", commentId, me, p.id, text(body.body, 2000, true), now());
    await notify(p.user_id, "comment", p.id); return json({ id: commentId }, 201);
  }
  if (path === "follows" && method === "POST") {
    const target = text(body.userId, 100, true); if (target === me) fail(400, "Você já está na sua própria companhia."); await existsUser(target);
    const old = await one("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?", me, target);
    if (old) await run("DELETE FROM follows WHERE follower_id=? AND following_id=?", me, target);
    else { await run("INSERT OR IGNORE INTO follows(follower_id,following_id) VALUES(?,?)", me, target); await notify(target, "follow", me); }
    return json({ following: !old });
  }
  if (path === "memberships" && method === "POST") {
    const target = text(body.communityId, 100, true); if (!await one("SELECT 1 FROM communities WHERE id=?", target)) fail(404, "Comunidade não encontrada.");
    const old = await one("SELECT 1 FROM memberships WHERE user_id=? AND community_id=?", me, target);
    if (old) await run("DELETE FROM memberships WHERE user_id=? AND community_id=?", me, target);
    else await run("INSERT OR IGNORE INTO memberships(user_id,community_id) VALUES(?,?)", me, target);
    return json({ joined: !old });
  }
  if (path === "communities" && method === "POST") {
    const communityId = id();
    await db.batch([
      db.prepare("INSERT INTO communities(id,name,description,category,color,owner_id,created_at) VALUES(?,?,?,?,?,?,?)").bind(communityId, text(body.name, 70, true), text(body.description, 500, true), text(body.category, 40, true), "#d8dfc6", me, now()),
      db.prepare("INSERT INTO memberships(user_id,community_id) VALUES(?,?)").bind(me, communityId),
    ]); return json({ id: communityId }, 201);
  }
  if (path === "testimonials" && method === "POST") {
    const target = text(body.toId, 100, true); if (target === me) fail(400, "Depoimentos são escritos por outras pessoas."); await existsUser(target);
    if (await one("SELECT 1 FROM testimonials WHERE from_id=? AND to_id=? AND status='pending'", me, target)) fail(409, "Seu depoimento anterior ainda está aguardando aprovação.");
    await run("INSERT INTO testimonials(id,from_id,to_id,body,status,created_at) VALUES(?,?,?,?,?,?)", id(), me, target, text(body.body, 2000, true), "pending", now());
    await notify(target, "testimonial", target); return json({ ok: true }, 201);
  }
  if (path.startsWith("testimonials/") && method === "PATCH") {
    if (!["approved", "rejected"].includes(body.status)) fail(400, "Status inválido.");
    const t = await one("SELECT * FROM testimonials WHERE id=?", path.slice(13));
    if (!t) fail(404, "Depoimento não encontrado."); if (t!.to_id !== me) fail(403, "Só quem recebeu pode aprovar o depoimento.");
    await run("UPDATE testimonials SET status=? WHERE id=?", body.status, t!.id); return json({ ok: true });
  }
  if (path === "messages" && method === "POST") {
    const target = text(body.toId, 100, true); if (target === me) fail(400, "Escolha outra pessoa para conversar."); await existsUser(target);
    const messageId = id(); await run("INSERT INTO messages(id,from_id,to_id,body,created_at) VALUES(?,?,?,?,?)", messageId, me, target, text(body.body, 4000, true), now());
    return json({ id: messageId }, 201);
  }
  if (path === "blocks" && method === "POST") {
    const target = text(body.userId, 100, true); if (target === me) fail(400, "Escolha outra pessoa.");
    if (!await one("SELECT 1 FROM users WHERE id=?", target)) fail(404, "Pessoa não encontrada.");
    if (body.remove) await run("DELETE FROM blocks WHERE user_id=? AND blocked_id=?", me, target);
    else await db.batch([
      db.prepare("INSERT OR IGNORE INTO blocks(user_id,blocked_id) VALUES(?,?)").bind(me, target),
      db.prepare("DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)").bind(me, target, target, me),
    ]);
    return json({ ok: true });
  }
  return fail(405, "Ação indisponível.");
}
async function shortHash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes).slice(0, 4), b => b.toString(16).padStart(2, "0")).join("");
}

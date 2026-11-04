import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleApi } from "../../server/api";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  if (!env.DB) return Response.json({ error: "Banco indisponível. Execute as migrações descritas no README." }, { status: 503 });
  const identity = await getChatGPTUser();
  return handleApi(request, {
    db: env.DB, bucket: env.BUCKET,
    user: identity ? { id: identity.userId, name: identity.fullName || identity.displayName.split("@")[0] } : null,
    localPreview: ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname),
  });
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };

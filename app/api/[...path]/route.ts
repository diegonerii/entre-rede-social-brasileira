import { env } from "cloudflare:workers";
import { getChatGPTUser, verifyChatGPTUser } from "../../chatgpt-auth";
import { handleApi } from "../../server/api";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  if (!env.DB) return Response.json({ error: "Banco indisponível. Execute as migrações descritas no README." }, { status: 503 });
  const localPreview = ["127.0.0.1", "localhost"].includes(new URL(request.url).hostname);
  const identitySecret = (env as unknown as { IDENTITY_SECRET?: string }).IDENTITY_SECRET || process.env.IDENTITY_SECRET;
  const identityFlag = (env as unknown as { IDENTITY_REQUIRE_SIGNATURE?: string }).IDENTITY_REQUIRE_SIGNATURE || process.env.IDENTITY_REQUIRE_SIGNATURE;
  // Sites keeps its verified oai-* identity path. Only an explicitly configured
  // Magalu gateway opts into the additional HMAC check.
  const signatureRequired = !localPreview && identityFlag === "true" && Boolean(identitySecret);
  const rawIdentity = await getChatGPTUser();
  const identity = signatureRequired ? await verifyChatGPTUser(request, rawIdentity, identitySecret, localPreview) : rawIdentity;
  return handleApi(request, {
    db: env.DB, bucket: env.BUCKET,
    user: identity ? { id: identity.userId, name: identity.fullName || identity.displayName.split("@")[0] } : null,
    localPreview,
  });
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };

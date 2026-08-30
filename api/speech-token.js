/**
 * Vercel Serverless Function — mints a short-lived Azure Speech token (10 min).
 *
 * The real subscription key stays in Vercel environment variables:
 *   AZURE_SPEECH_KEY    → Speech service key (F0 free tier: 5 audio-hours/month)
 *   AZURE_SPEECH_REGION → e.g. "eastus"
 * The client bundle NEVER sees the key — it only receives the temporary token.
 * On GitHub Pages (static hosting) this endpoint does not exist and the app
 * gracefully falls back to the free browser engines.
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method-not-allowed" });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return res.status(501).json({ error: "not-configured" });
  }

  try {
    const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    if (!response.ok) {
      return res.status(502).json({ error: "issue-token-failed", status: response.status });
    }
    const token = await response.text();
    return res.status(200).json({ token, region });
  } catch {
    return res.status(502).json({ error: "network-error" });
  }
}

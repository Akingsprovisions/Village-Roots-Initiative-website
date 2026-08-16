// Netlify Edge Function: proxies the live "search the web" agent.
// This is the ONLY place the Anthropic API key is used — it lives in the
// Netlify site's environment variables (Site settings -> Environment
// variables -> ANTHROPIC_API_KEY) and is never sent to the browser.
//
// The frontend calls this at /api/search-programs instead of calling
// api.anthropic.com directly. It's used as a FALLBACK, only when the
// vetted directory (src/directory.json) has no match for a region.
//
// This runs as an Edge Function (Deno runtime) rather than a regular
// Netlify Function because regular Functions are proxied through an
// intermediary with a hard ~30s wall-clock limit that Anthropic's
// web-search agent loop routinely exceeded, even after converting to a
// streaming Response. Edge Functions run on a different path (no such
// proxy) and don't count I/O wait time against their CPU limit, giving
// real headroom (40s response-header timeout) for a slow upstream call.

const CATEGORIES = [
  "Mindfulness",
  "Arts",
  "Sports",
  "Outdoor exploration",
  "Mentorship",
  "Practical life skills",
];

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function jsonResponse(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const region = String(body.region || "").trim();
  const category = CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  const age = Math.max(0, Math.min(18, Number(body.age) || 0));
  const searchSize = 4;

  if (!region) {
    return jsonResponse(400, { error: "Region is required" });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse(500, {
      error: "Server is not configured — ANTHROPIC_API_KEY is missing. Set it in Netlify Site settings > Environment variables.",
    });
  }

  const systemPrompt = `You are the Community Research Agent for Village Roots Youth Initiative, a nonprofit directory connecting families with local youth programs in mindfulness, arts, sports, outdoor exploration, mentorship, and practical life skills.

TASK: Find and verify up to ${searchSize} real, currently active youth programs in ${region} in the interest area of ${category}, suitable for a child age ${age}. Only include programs whose age range plausibly includes age ${age}; if a program's exact age range can't be confirmed, say so rather than guessing. Do not invent, guess, or combine details from different organizations. Every fact must come from something you can point to (a website, listing, or news source).

RULES:
1. Real programs only. No national umbrella orgs without a specific local chapter, address, or contact - a family needs to be able to actually show up.
2. Prioritize programs with current/active schedules (not defunct, not "coming soon" with no date).
3. Do not write long copied descriptions. Summarize each program's purpose in 1-2 sentences, in your own words.
4. If you cannot confirm a field, write "Confirm with provider" rather than guessing. Never fabricate a phone number, address, price, or age range.
5. Flag anything uncertain as "Needs confirmation" in the verificationStatus field rather than presenting it as fully verified.

Search for each program individually rather than relying on general knowledge - confirm the organization currently exists and operates in ${region} before including it.

Today's date is ${todayStr()}.

Respond with ONLY a raw JSON array (no markdown fences, no prose before or after). Each element must have exactly these string keys: orgProgramName, description, category, agesServed, addressServiceArea, schedule, costContact, freeScholarship, accessibilityInfo, contactDetails, registrationLink, verificationStatus (one of "Fully verified", "Basic verified", "Needs confirmation"), lastReviewed (use "${todayStr()}").`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Find up to ${searchSize} verified ${category} programs in ${region} suitable for a ${age} year old. Output the JSON array only.`,
          },
        ],
        tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3 }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse(502, { error: `Anthropic API request failed (${response.status}): ${errText.slice(0, 300)}` });
    }

    const data = await response.json();
    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const cleaned = textBlocks
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1) {
      return jsonResponse(502, { error: "Could not parse a program list from the model's response." });
    }

    const parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));

    return jsonResponse(200, { results: parsed, source: "live" });
  } catch (e) {
    return jsonResponse(500, { error: e.message || "Unexpected server error." });
  }
};

export const config = {
  path: "/api/search-programs",
};

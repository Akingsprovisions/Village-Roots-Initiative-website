import { useState, useRef, useEffect } from "react";
import directoryData from "./directory.json";

const CATEGORIES = [
  "Mindfulness",
  "Arts",
  "Sports",
  "Outdoor exploration",
  "Mentorship",
  "Practical life skills",
];

const STAMP_STYLE = {
  "Fully verified": { ring: "#1E3B2F", fill: "#1E3B2F", text: "#F3EFE4", dash: "0" },
  "Basic verified": { ring: "#B8862E", fill: "none", text: "#B8862E", dash: "0" },
  "Needs confirmation": { ring: "#A8442F", fill: "none", text: "#A8442F", dash: "4 3" },
};

function extractEmail(text) {
  if (!text) return null;
  const match = String(text).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Directory-first matching
//
// The vetted directory (src/directory.json) is the primary source of truth —
// it was built by targeted research and is checked into the site itself, so
// matching against it is instant, free, and requires no network call. Only
// when nothing in the directory matches do we fall back to the live
// web-search agent (Netlify function), which has NOT been phone-verified.
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRegion(input, aliasMap) {
  const lower = input.trim().toLowerCase();
  if (!lower) return null;

  // 1. Exact canonical region name match.
  for (const canonical of Object.keys(aliasMap)) {
    if (canonical.toLowerCase() === lower) return canonical;
  }

  // 2. Alias keyword match, using word boundaries so short state codes
  //    ("fl", "sc", "ga"...) don't false-positive inside unrelated words.
  //    Prefer the longest (most specific) alias that matches.
  let bestMatch = null;
  let bestScore = 0;
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    for (const alias of aliases) {
      const re = new RegExp(`\\b${escapeRegex(alias)}\\b`);
      if (re.test(lower) && alias.length > bestScore) {
        bestScore = alias.length;
        bestMatch = canonical;
      }
    }
  }
  return bestMatch;
}

function searchDirectory({ region, category, age }) {
  const canonicalRegion = matchRegion(region, directoryData.regionAliases || {});
  if (!canonicalRegion) return { canonicalRegion: null, matches: [] };

  const matches = (directoryData.entries || []).filter((e) => {
    if (e.region !== canonicalRegion) return false;
    if (e.category !== category) return false;
    const lo = typeof e.ageMin === "number" ? e.ageMin : 0;
    const hi = typeof e.ageMax === "number" ? e.ageMax : 18;
    return age >= lo && age <= hi;
  });

  return { canonicalRegion, matches };
}

function Stamp({ status }) {
  const s = STAMP_STYLE[status] || STAMP_STYLE["Needs confirmation"];
  const label =
    status === "Fully verified" ? "VERIFIED" : status === "Basic verified" ? "BASIC" : "CONFIRM";
  return (
    <div
      style={{
        width: 74,
        height: 74,
        flexShrink: 0,
        transform: "rotate(-6deg)",
      }}
    >
      <svg viewBox="0 0 100 100" width="74" height="74">
        <circle
          cx="50"
          cy="50"
          r="44"
          fill={s.fill === "none" ? "transparent" : s.fill}
          stroke={s.ring}
          strokeWidth="2.5"
          strokeDasharray={s.dash}
        />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={s.ring}
          strokeWidth="1"
          strokeDasharray={s.dash}
        />
        <text
          x="50"
          y="47"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="10.5"
          fontWeight="700"
          fill={s.text}
          letterSpacing="0.5"
        >
          {label}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="7"
          fill={s.text}
          letterSpacing="1"
        >
          VILLAGE ROOTS
        </text>
      </svg>
    </div>
  );
}

const FIELD_ORDER = [
  ["agesServed", "Ages served"],
  ["addressServiceArea", "Address / service area"],
  ["schedule", "Schedule"],
  ["costContact", "Cost"],
  ["freeScholarship", "Free / scholarship"],
  ["accessibilityInfo", "Accessibility"],
  ["contactDetails", "Contact"],
];

function EntryCard({ entry, index, parentEmail, age, category, searchingFor }) {
  const orgEmail = extractEmail(entry.contactDetails);
  const subject = `Inquiry about ${entry.orgProgramName} — from Village Roots`;
  const whoLine =
    searchingFor === "myself"
      ? `I'm ${age} and found ${entry.orgProgramName} through Village Roots Youth Initiative while looking for ${category.toLowerCase()} programs.`
      : `I found ${entry.orgProgramName} through Village Roots Youth Initiative while looking for ${category.toLowerCase()} programs for my ${age}-year-old.`;
  const body = [
    `Hello,`,
    ``,
    whoLine,
    `Could you share current availability, enrollment steps, and any next steps to get started?`,
    ``,
    `Thank you,`,
    parentEmail ? `Reply to: ${parentEmail}` : "",
  ].join("\n");
  const mailtoHref = orgEmail
    ? `mailto:${orgEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${
        parentEmail ? `&cc=${encodeURIComponent(parentEmail)}` : ""
      }`
    : null;

  return (
    <div
      style={{
        borderTop: "1px solid #D9D0B8",
        padding: "28px 0",
        display: "flex",
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#8A8267",
          minWidth: 34,
          paddingTop: 4,
        }}
      >
        {String(index + 1).padStart(3, "0")}
      </div>
      <Stamp status={entry.verificationStatus} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 20,
              fontWeight: 600,
              color: "#1E3B2F",
              margin: 0,
            }}
          >
            {entry.orgProgramName}
          </h3>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: "#8A8267",
              letterSpacing: "0.5px",
            }}
          >
            REVIEWED {entry.lastReviewed}
          </span>
        </div>
        <p
          style={{
            fontSize: 14.5,
            color: "#3A362B",
            lineHeight: 1.6,
            margin: "8px 0 14px",
          }}
        >
          {entry.description}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "6px 24px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12.5,
          }}
        >
          {FIELD_ORDER.map(([key, label]) => (
            <div key={key} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#8A8267", minWidth: 108 }}>{label}</span>
              <span style={{ color: "#241F16" }}>{entry[key] || "Confirm with provider"}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          {mailtoHref ? (
            <a
              href={mailtoHref}
              style={{
                display: "inline-block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12.5,
                color: "#F3EFE4",
                background: "#1E3B2F",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 3,
              }}
            >
              EMAIL THIS PROGRAM →
            </a>
          ) : (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11.5,
                color: "#8A8267",
              }}
            >
              No email on file — use the contact info above
            </span>
          )}
          {entry.registrationLink && entry.registrationLink !== "Confirm with provider" && (
            <a
              href={entry.registrationLink}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12.5,
                color: "#B8862E",
                textDecoration: "none",
                borderBottom: "1px solid #B8862E",
                paddingBottom: 1,
              }}
            >
              {entry.registrationLink} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const CONTACT_EMAIL = "chefadam@akingsprovisions.com";

function RegionsServed() {
  const [open, setOpen] = useState(false);
  const regions = Object.keys(directoryData.regionAliases || {}).sort();

  const requestSubject = "Request to add my area to Village Roots";
  const requestBody = [
    "Hi Village Roots team,",
    "",
    "My area isn't in your vetted directory yet — could you add coverage for it?",
    "",
    "City / region: ",
    "",
    "Thank you!",
  ].join("\n");
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    requestSubject
  )}&body=${encodeURIComponent(requestBody)}`;

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12.5,
          color: "#1E3B2F",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {open ? "Hide" : "See"} the {regions.length} regions we serve {open ? "▴" : "▾"}
      </button>

      {open && (
        <div
          style={{
            marginTop: 14,
            background: "#FBF9F2",
            border: "1px solid #D9D0B8",
            borderRadius: 4,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "8px 20px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12.5,
              color: "#3A362B",
            }}
          >
            {regions.map((r) => (
              <div key={r}>{r}</div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid #D9D0B8",
              fontSize: 13,
              color: "#5C5842",
            }}
          >
            Don't see your area?{" "}
            <a
              href={mailtoHref}
              style={{ color: "#B8862E", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              Request that we add it →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const LOADING_STEPS = [
  "Contacting local listings and provider sites...",
  "Cross-checking schedules and addresses...",
  "Flagging anything that can't be confirmed...",
  "Compiling the verified registry...",
];

function SourceBanner({ source }) {
  if (source === "directory") {
    return (
      <div
        style={{
          marginTop: 28,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#1E3B2F",
          background: "#E4E9DE",
          border: "1px solid #1E3B2F",
          borderRadius: 3,
          padding: "8px 12px",
          display: "inline-block",
        }}
      >
        ✓ FROM THE VETTED VILLAGE ROOTS DIRECTORY
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 28,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: "#B8862E",
        background: "#FBF3E4",
        border: "1px solid #B8862E",
        borderRadius: 3,
        padding: "8px 12px",
        display: "inline-block",
      }}
    >
      ⚠ LIVE WEB SEARCH RESULTS — not yet phone-verified by Village Roots staff
    </div>
  );
}

export default function ResearchAgent() {
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [age, setAge] = useState(6);
  const [parentEmail, setParentEmail] = useState("");
  const [searchingFor, setSearchingFor] = useState("myself");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [resultSource, setResultSource] = useState(null); // "directory" | "live"
  const [loadingStep, setLoadingStep] = useState(0);
  const stepTimer = useRef(null);

  useEffect(() => {
    return () => clearInterval(stepTimer.current);
  }, []);

  async function runSearch() {
    if (!region.trim()) {
      setError("Enter a city or region first.");
      return;
    }
    setError("");
    setStatus("loading");
    setResults(null);
    setResultSource(null);
    setLoadingStep(0);

    // ---- 1. Directory-first: check the vetted local dataset instantly ----
    const { matches } = searchDirectory({ region, category, age });
    if (matches.length > 0) {
      setResults(matches);
      setResultSource("directory");
      setStatus("done");
      return;
    }

    // ---- 2. Fallback: no local match, ask the live search agent ----
    stepTimer.current = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 3200);

    try {
      const response = await fetch("/api/search-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, category, age }),
      });

      const data = await response.json().catch(() => ({}));

      if (data.error) {
        throw new Error(data.error);
      }
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const parsed = data.results;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("No programs came back. Try a broader region or a different category.");
      }
      setResults(parsed);
      setResultSource("live");
      setStatus("done");
    } catch (e) {
      setError(e.message || "Something went wrong running the search.");
      setStatus("error");
    } finally {
      clearInterval(stepTimer.current);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .vr-input { background: #FBF9F2; border: 1px solid #D9D0B8; color: #241F16; font-family: 'Inter', sans-serif; }
        .vr-input:focus { outline: none; border-color: #1E3B2F; }
        .vr-btn:active { transform: translateY(1px); }
      `}</style>

      <div>
        <RegionsServed />

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "myself", label: "I'm searching for myself" },
            { key: "child", label: "I'm searching for my child" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSearchingFor(opt.key)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                padding: "7px 14px",
                borderRadius: 3,
                border: "1px solid " + (searchingFor === opt.key ? "#1E3B2F" : "#D9D0B8"),
                background: searchingFor === opt.key ? "#1E3B2F" : "transparent",
                color: searchingFor === opt.key ? "#F3EFE4" : "#5C5842",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "#FBF9F2",
            border: "1px solid #D9D0B8",
            borderRadius: 4,
            padding: 24,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 0.7fr",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#8A8267",
                marginBottom: 6,
                letterSpacing: "0.5px",
              }}
            >
              CITY / REGION
            </label>
            <input
              className="vr-input"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Greenville, SC"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 3, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#8A8267",
                marginBottom: 6,
                letterSpacing: "0.5px",
              }}
            >
              INTERESTS
            </label>
            <select
              className="vr-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 3, fontSize: 14, boxSizing: "border-box" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#8A8267",
                marginBottom: 6,
                letterSpacing: "0.5px",
              }}
            >
              {searchingFor === "myself" ? "YOUR AGE" : "CHILD'S AGE"}
            </label>
            <input
              className="vr-input"
              type="number"
              min="0"
              max="18"
              value={age}
              onChange={(e) => setAge(Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 3, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label
              style={{
                display: "block",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#8A8267",
                marginBottom: 6,
                letterSpacing: "0.5px",
              }}
            >
              YOUR EMAIL (so programs can reply)
            </label>
            <input
              className="vr-input"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 3, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <button
              className="vr-btn"
              onClick={runSearch}
              disabled={status === "loading"}
              style={{
                background: "#1E3B2F",
                color: "#F3EFE4",
                border: "none",
                borderRadius: 3,
                padding: "12px 22px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                letterSpacing: "0.5px",
                cursor: status === "loading" ? "default" : "pointer",
                opacity: status === "loading" ? 0.6 : 1,
              }}
            >
              {status === "loading" ? "SEARCHING..." : "RUN SEARCH"}
            </button>
            {error && (
              <span style={{ marginLeft: 14, color: "#A8442F", fontSize: 13 }}>{error}</span>
            )}
          </div>
        </div>

        {status === "loading" && (
          <div
            style={{
              marginTop: 28,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: "#5C5842",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#B8862E",
                display: "inline-block",
              }}
            />
            {LOADING_STEPS[loadingStep]}
          </div>
        )}

        {results && (
          <div style={{ marginTop: 8 }}>
            <SourceBanner source={resultSource} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderBottom: "2px solid #1E3B2F",
                paddingBottom: 10,
                marginTop: 20,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: "#1E3B2F",
                  letterSpacing: "0.5px",
                }}
              >
                {results.length} PROGRAMS — {category.toUpperCase()} — AGE {age} — {region.toUpperCase()}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8267" }}>
                {todayStr()}
              </span>
            </div>
            {results.map((entry, i) => (
              <EntryCard
                entry={entry}
                index={i}
                key={i}
                parentEmail={parentEmail}
                age={age}
                category={category}
                searchingFor={searchingFor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const Groq = require('groq-sdk');
const { db } = require('../db');

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_PROJECT_HITS = 8;

const SYSTEM_PROMPT = `You are ONLY the renewCo. assistant.
You help with the renewCo. Australian carbon credit marketplace: CER projects, ACCUs, claims, listings, buyer enquiries, buyer introductions, emissions tracking, market data, reports, data export, and how to use this website.

About the brand (ALWAYS answer — these are in scope):
- Questions like "what is renewCo", "who are you", "what is this website/app/platform" are ON TOPIC.
- renewCo. builds infrastructure for carbon and environmental markets: "the intelligence layer connecting carbon credits, data, and transactions".
- This platform connects buyers with verified project representatives around Australian CER carbon credit projects and ACCUs, and provides market intelligence.
- The platform was built for renewCo. by IrongateIT ("Powered by IrongateIT"). If asked who built the website, say IrongateIT.
- renewCo. contact: office@renew-co.com.au, 0482 447 397.
- It is not a bank, not the Clean Energy Regulator, and does not process payments or transfer ACCUs.

IN SCOPE (answer these):
- What renewCo. / this marketplace / this assistant is
- How the marketplace works (CER data vs seller listing vs platform verification)
- Finding projects in the provided database context (type, state, method, status, listings)
- Seller flow: claim a CER project → upload proof → admin review → create listing → ACCU evidence → availability
- Buyer flow: browse Marketplace → send enquiry, or submit a Buyer introduction brief to be matched with verified listings (payments/transfers are off-platform)
- Emissions tracking for buyers: record Scope 1, 2 and 3 emissions, log ACCUs retired, see net position vs annual offset goal
- Market page: live register statistics, platform supply, indicative prices, reference price history
- Reports (automated weekly/monthly/quarterly) and data export (CSV/JSON)
- Clarifying marketplace terms (CER, ACCU, KACCU, NKACCU, Scope 1/2/3, claim, listing, verified evidence, ANREU / Unit and Certificate Registry, NGA Factors)
- Role-specific next steps for guest / buyer / seller / admin
- Related Australian carbon platforms / registries / exchanges (high-level comparison — see Related ecosystem below)

OUT OF SCOPE (hard refuse — do not answer the substance):
- Programming, code, algorithms, homework, debugging, unrelated tech support
- General knowledge, news, weather, jokes, recipes, math, writing essays
- Medical, legal, or financial advice; do not tell users whether to buy or sell or predict prices
- Unrelated products with no carbon / CER / ACCU connection

When a message is out of scope, reply with a short refusal like:
"I only help with renewCo. carbon credit projects, listings, emissions tracking and marketplace questions. Try asking how the marketplace works, how to claim a project, or how to find listings."
Do NOT provide partial answers, sample code, or "anyway here's how…" for out-of-scope topics.
If the user mixes topics, ignore the off-topic part and only answer the marketplace part (or refuse if there is none).

Platform facts:
- Official project facts come from public CER register data imported by admins (upload, API, or scheduled pull).
- Sellers claim a project, upload proof; admins review. Then they can list.
- ACCU evidence is reviewed separately from ownership claims.
- Buyers enquire on published listings or request an introduction; payments and ACCU transfers happen outside this platform.
- Emission factors in the emissions tracker are indicative NGA-based defaults; users should check the current National Greenhouse Accounts Factors.
- Always distinguish CER data, seller-provided data, and platform verification. Indicative prices are not offers.

Related ecosystem (answer when asked about similar platforms; keep high-level; do not invent features or prices):
1. Clean Energy Regulator (CER) — Australian government regulator for the ACCU Scheme and public project register data. Not a commercial marketplace.
2. Unit and Certificate Registry (formerly ANREU for ACCUs) — official ledger for holding / transferring / retiring ACCUs.
3. Safeguard Mechanism / SMCs — related compliance market administered by the CER.
4. Exchanges and futures venues (e.g. Xpansiv CBL, ASX) — trade-execution and price discovery venues, not project-claim marketplaces.
5. Brokers and bilateral OTC deals — much of the ACCU market still happens via brokers or direct contracts.
6. Climate Active — Australian carbon-neutral certification that often sources ACCUs; complementary.

How renewCo. differs: it focuses on discovering CER projects, verifying project representatives, publishing listings, buyer introductions, emissions tracking and market intelligence. It does not replace the CER, hold an official registry, or settle transfers or payments.

If asked about a platform not listed above: explain the general Australian ACCU landscape and how renewCo. fits, without inventing detailed claims; suggest checking that organisation's official site.

Safety / accuracy:
- Be concise and plain. Prefer short bullet lists for steps.
- Never invent CER registry facts, holdings, prices, or verification outcomes.
- Use only the project context provided below when talking about specific projects. If none match, say so and suggest Marketplace filters.
- Never claim you can approve claims, verify documents, or access private CER registry accounts.
- Do not ask for passwords, full certificate numbers, or private registry credentials.
- Stay professional; do not swear.`;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content)
    .slice(-MAX_HISTORY);
}

function extractSearchTerms(text) {
  const stop = new Set([
    'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'is', 'are', 'was', 'were',
    'what', 'which', 'where', 'when', 'how', 'who', 'can', 'could', 'would', 'should', 'please',
    'show', 'find', 'list', 'search', 'tell', 'about', 'me', 'my', 'any', 'some', 'with',
    'project', 'projects', 'credit', 'credits', 'carbon', 'accu', 'accus', 'help', 'want',
    'looking', 'need', 'get', 'have', 'this', 'that', 'there',
  ]);
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stop.has(w))
  )].slice(0, 6);
}

function searchProjectsForChat(queryText) {
  const terms = extractSearchTerms(queryText);
  if (!terms.length) {
    return db.prepare(`
      SELECT p.id, p.project_reference, p.name, p.project_type, p.methodology,
             p.project_proponent, p.project_status, p.total_accus_issued, p.total_accus_relinquished,
             (SELECT l.state_or_territory FROM project_locations l WHERE l.project_id = p.id LIMIT 1) AS state,
             (SELECT pl.listing_title FROM project_listings pl
              WHERE pl.project_id = p.id AND pl.listing_status = 'published' LIMIT 1) AS listing_title,
             EXISTS (
               SELECT 1 FROM project_listings pl
               WHERE pl.project_id = p.id AND pl.listing_status = 'published'
             ) AS has_published_listing
      FROM projects p
      ORDER BY has_published_listing DESC, p.name
      LIMIT ?
    `).all(MAX_PROJECT_HITS);
  }

  const clauses = [];
  const params = [];
  for (const term of terms) {
    const like = `%${term}%`;
    clauses.push(`(
      p.name LIKE ? OR p.project_reference LIKE ? OR p.project_proponent LIKE ?
      OR p.methodology LIKE ? OR p.project_type LIKE ? OR p.project_status LIKE ?
      OR EXISTS (
        SELECT 1 FROM project_locations l
        WHERE l.project_id = p.id AND (l.state_or_territory LIKE ? OR l.region LIKE ? OR l.location_name LIKE ?)
      )
      OR EXISTS (
        SELECT 1 FROM project_listings pl
        WHERE pl.project_id = p.id AND pl.listing_status = 'published'
          AND (pl.listing_title LIKE ? OR pl.seller_description LIKE ?)
      )
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like, like);
  }

  return db.prepare(`
    SELECT p.id, p.project_reference, p.name, p.project_type, p.methodology,
           p.project_proponent, p.project_status, p.total_accus_issued, p.total_accus_relinquished,
           (SELECT l.state_or_territory FROM project_locations l WHERE l.project_id = p.id LIMIT 1) AS state,
           (SELECT pl.listing_title FROM project_listings pl
            WHERE pl.project_id = p.id AND pl.listing_status = 'published' LIMIT 1) AS listing_title,
           EXISTS (
             SELECT 1 FROM project_listings pl
             WHERE pl.project_id = p.id AND pl.listing_status = 'published'
           ) AS has_published_listing
    FROM projects p
    WHERE ${clauses.join(' OR ')}
    ORDER BY has_published_listing DESC, p.name
    LIMIT ?
  `).all(...params, MAX_PROJECT_HITS);
}

function formatProjectContext(projects) {
  if (!projects.length) {
    return 'No matching projects found in the local database for this message.';
  }
  return projects.map((p, i) => {
    const listing = p.has_published_listing
      ? `Published listing: ${p.listing_title || 'Yes'}`
      : 'No published listing yet (unclaimed or not listed)';
    return [
      `${i + 1}. ${p.name} (${p.project_reference})`,
      `   Type: ${p.project_type || 'n/a'} | Status: ${p.project_status || 'n/a'} | State: ${p.state || 'n/a'}`,
      `   Proponent: ${p.project_proponent || 'n/a'}`,
      `   Method: ${p.methodology || 'n/a'}`,
      `   ACCUs issued: ${p.total_accus_issued ?? 'n/a'} | Relinquished: ${p.total_accus_relinquished ?? 'n/a'}`,
      `   ${listing}`,
    ].join('\n');
  }).join('\n');
}

function roleHint(user) {
  if (!user?.role) return 'Visitor is a guest (not logged in).';
  return `Visitor is logged in as ${user.role}${user.name ? ` (${user.name})` : ''}.`;
}

const LANGUAGES = {
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  ja: 'Japanese (日本語)',
  vi: 'Vietnamese (Tiếng Việt)',
};

async function chat({ messages, user, language = 'en' }) {
  const client = getGroqClient();
  if (!client) {
    const err = new Error('Chatbot is not configured. Set GROQ_API_KEY in Backend/.env');
    err.status = 503;
    throw err;
  }

  const history = normalizeMessages(messages);
  if (!history.length) {
    const err = new Error('Send at least one user message.');
    err.status = 400;
    throw err;
  }

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const projects = searchProjectsForChat(lastUser?.content || '');
  const languageName = LANGUAGES[language] || LANGUAGES.en;
  const contextBlock = [
    `Reply in ${languageName}. Keep CER project names, Project IDs and acronyms (CER, ACCU, KACCU, NKACCU) in their original form.`,
    roleHint(user),
    '',
    'Project context from this platform database (public fields only):',
    formatProjectContext(projects),
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextBlock },
      ...history,
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    const err = new Error('The assistant returned an empty reply. Try again.');
    err.status = 502;
    throw err;
  }

  return {
    reply,
    model: GROQ_MODEL,
    projects_considered: projects.map((p) => ({
      id: p.id,
      project_reference: p.project_reference,
      name: p.name,
      has_published_listing: Boolean(p.has_published_listing),
    })),
  };
}

module.exports = {
  chat,
  LANGUAGES,
  getGroqClient,
  SYSTEM_PROMPT,
};

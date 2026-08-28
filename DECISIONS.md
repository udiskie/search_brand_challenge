# Decisions

What was decided, what was assumed, and what was deliberately left out of
scope for this exercise — and why.

## Data lake scraper: quick-mode sampling, not exhaustive crawling

**Decision:** The scraper defaults to "quick mode" — a small, prioritized
sample of ~10-15 pages per product (home, up to 2 pricing pages, up to 2
docs pages, up to 2 blog pages, then whatever's left filled in by the
sitemap's own `priority` field) — rather than crawling a site's entire
sitemap. All committed data lake evidence (Linear, Jira, Asana, Monday,
Notion) was generated this way, with `--quick-cap 10`.

**Why:** Real sitemap sizes for these competitors are far larger than what
an AEO/SEO/GEO audit needs to be representative — e.g. atlassian.com's (Jira's)
sitemap lists 28,048 URLs, notion.com's lists 15,801, asana.com's lists
3,415, against only 10 pages actually crawled for each. The pages that
shape a brand's positioning for this kind of audit (home, pricing, docs,
blog) are a small, identifiable subset; crawling everything would mean far
more time/bandwidth spent on pages irrelevant to the audit (individual blog
post archives, per-locale duplicates, unrelated product sub-pages on a
shared corporate domain, etc.).

**What was left out:** `--mode full` exists in the code (`src/scraper/cli.ts`,
`src/scraper/run.ts`) and is covered by unit tests against small synthetic
fixtures, but it was never run against any of the five real competitor
sites in this project. Exhaustively crawling a site's full sitemap (tens of
thousands of pages for some of these competitors) was purposely left out of
scope for this exercise.

## No dedicated data lake environment

**Decision:** The "data lake" is a plain directory (`datalake/`) of JSON and
raw HTML files, committed directly to this git repo — not a dedicated
storage/versioning system (object storage like S3/R2, a data warehouse, or
a git-for-data tool like LakeFS).

**Why:** The data volume for this exercise is small (five products, ~10
pages each), so a real data-lake platform would add operational overhead
(infrastructure to stand up, credentials to manage) without a matching
benefit. Git already provides the versioning/audit trail this project needs
(the brief explicitly asks for real commit history), so adding a second
versioning system on top would just duplicate it. This mirrors the earlier
call to skip LakeFS specifically for the same reason (see the reference
planning chat linked from `WORK_PLAN.md`).

**What was left out:** Independent scaling of storage from the app/repo, a
query engine over the data (every reader loads JSON files directly off
disk), and any access-control layer separate from repo permissions.
Practically, this also means the repo's size grows with every scrape run
(raw HTML committed alongside code), which wouldn't be sustainable at a
larger scale or over a longer time horizon than this exercise.

## No scheduled job to re-run the scraping

**Decision:** There is no recurring/automated job (cron, GitHub Actions
workflow, etc.) that periodically re-runs the scraper, the AEO probe, or
the question generator to keep the data lake fresh. Every run in this
project was triggered manually via the CLIs (`npm run scrape`, `npm run
aeo`, `npm run questions`).

**Why:** Given the timeline for this exercise, the priority was proving the
pipeline works correctly end-to-end against real sites and the real Gemini
API first. Automating a recurring pipeline would additionally require
secrets management for the Gemini API key in a scheduled context,
rate-limit-aware scheduling, and failure monitoring/alerting — all real
work that wasn't warranted before the pipeline itself was validated.

**What was left out:** Any form of scheduled re-scraping or re-auditing.
Practically, this means the committed data lake is a snapshot as of when it
was generated in this session — competitor sites' content, pricing, and
positioning will drift over time, and the committed AEO/report data will
grow stale, unless someone manually re-runs the CLI commands.

## Skipped: inferring AEO personas from scraped content (neutrality tension)

**Decision:** `brand-visibility-audit`'s prompt generator
(`src/aeo/promptGenerator.ts`) keeps its hardcoded, generic `PERSONAS` list
(startup founder, engineering lead, product manager, freelancer, marketing
team) rather than inferring personas from scraped site content. This was
requested and then explicitly deprioritized rather than built.

**Why left out:** This skill's entire value proposition, documented in its
own `SKILL.md`, is generating *neutral, balanced* prompts to fairly
benchmark the audited brand's Share of Voice against named competitors —
it "deliberately avoids leaning on any one brand's own vocabulary." If
personas were inferred from the audited brand's own scraped content (the
obvious, simplest way to do it, and the same approach
`user-question-generator` already uses for its brand-grounded questions),
the persona set would skew toward whichever audience that one brand's
marketing targets, biasing the "neutral" comparison in the audited brand's
favor before a single Gemini call is even made. The technically correct
fix — aggregating detected audience signals across the audited brand *and*
every named competitor's scraped content, so no single company's framing
dominates the persona pool — is a real option, but wasn't specced or built
here; it needs its own design pass (e.g. does it require all competitors to
already be scraped before an AEO run? what if their datalake output is
missing?) rather than being bolted on quickly.

**What was left out:** Any persona inference in `src/aeo/`. Contrast with
`user-question-generator`, where brand-grounded personas/audiences are
exactly the point (see its own `SKILL.md`) and this tension doesn't apply.

## Term clustering: an LLM call, deliberately, for one specific step

**Decision:** `src/clustering/clusterTermsByLlm.ts` (the `--method llm` path
of `term-clustering`, see its own `SKILL.md`) makes one Gemini call per
product to bucket tagcloud terms into semantic themes — the first LLM call
anywhere in this project's pipeline outside the AEO measurement itself
(`src/aeo/`). Every other extractor/scanner/generator (SEO signals, GEO
signals, tagcloud tf-idf, hook/problem scanning, question templates) is
regex/keyword-based and deterministic by explicit design, documented
repeatedly across `WORK_PLAN.md` and this file.

**Why:** The user explicitly asked for this comparison — build the
deterministic hand-curated taxonomy first (`clusterTermsByTaxonomy.ts`),
then the LLM method second, specifically to compare the two side by side.
Run against real data for Linear: the taxonomy method left 33 of the top-50
terms unclustered (a fixed keyword list can't cover everything without
constant re-authoring); the LLM method left only 7, with sensible theme
names it invented itself ("Project & Issue Tracking," "Development &
Code") rather than picking from a fixed list. That's a real, demonstrated
tradeoff, not a hypothetical one — genuine semantic coverage in exchange for
non-determinism and a per-product API cost.

**What was left out:** No validation beyond "does the response parse as the
expected JSON shape and only reference terms that were actually in the
input" (`clusterTermsByLlm.ts` drops any invented term rather than
fabricating it into the output). No caching/reuse of a previous LLM
clustering run if the tagcloud hasn't changed — every `--method llm`
invocation re-spends a Gemini call. No mechanism to detect when the LLM's
theme names drift in wording between runs (e.g. "AI & Automation" vs. "AI &
Automation Tools") in a way that would make repeated re-clustering look
falsely unstable; the dashboard's method-comparison note only compares
theme/unclustered *counts*, not name-level alignment.

## SEO/GEO/AEO composite scores: heuristic weights, not empirically derived

**Decision:** Each dimension is reduced to a single 0-100 score via a
weighted blend of sub-signals. AEO score = `60% × (brand Share of Voice ×
100) + 40% × (sentiment normalized to 0-100)` (`computeAeoScore` in
`src/aeo/reportGenerator.ts`). SEO and GEO scores are unweighted (25/25/25/25)
averages of four sub-scores each, and GEO's E-E-A-T sub-score itself splits
33/33/34 across author/publish-date/updated-date presence. These weights ship
as-is and drive the three `ScoreBadge`s shown on the home page and each
product page's executive summary.

**Why:** The brief doesn't mandate a specific scoring formula — it asks "¿con
qué criterios lo medirías?" and leaves the criteria to the candidate. A
single blended number per dimension is a legible answer to that question, and
it was implemented as ordinary rules-based engineering judgment (documented
in `.claude/skills/brand-visibility-audit/SKILL.md`'s "Metric formulas"
section) rather than derived from any external AEO/SEO/GEO scoring standard,
published study, or calibration against a real outcome (e.g. does a 10-point
AEO increase correlate with more actual AI-referral traffic?). No such ground
truth exists for this project to fit the weights against, so none of these
splits — 60/40, 25/25/25/25, or 33/33/34 — should be read as validated;
they're a starting point, not a finding.

**What was left out:** No sensitivity analysis across alternative weightings,
no A/B of 60/40 against e.g. 50/50, and no attempt to calibrate any of these
splits against outcome data. This is a matter of methodological discussion,
not a settled fact — reporting Share of Voice and sentiment unblended
instead of compressing them into one number is an equally defensible choice.
The raw components (SoV%, sentiment score, avg factual density, avg
extractable structure, etc.) are always shown unblended alongside the
composite in the same report tables specifically so no one has to take the
composite on faith. Reweighting or dropping these composites in favor of raw
criteria was considered and deliberately deferred rather than changed under
deadline pressure this close to submission.

## Índice de esfuerzo de inferencia de User Persona (Persona Inference Effort Index — PIEI)

**Problema que resuelve:** hay dos formas en que un sitio comunica su user
persona: de forma **explícita** (el sitio lo dice directamente: "diseñado
para equipos de ingeniería ágil") o de forma **implícita** (el LLM tiene que
inferirlo combinando señales indirectas — tono del copy, features listadas,
integraciones ofrecidas, casos de uso en el blog — sin que nadie lo declare
en una frase). Cuanto más tenga que inferir el LLM, más riesgo de que la
inferencia sea inconsistente entre corridas o entre distintos modelos, y
menos control tiene la marca sobre cómo la perciben.

El índice propuesto (PIEI) se construye con 4 componentes medibles:

1. **Explicit Mention Rate (EMR)** — ¿el sitio declara el persona/caso de uso
   en texto directo (headings, hero copy, secciones "Para quién es")? Se mide
   con análisis semántico/keyword sobre las páginas clave (home, pricing,
   landing), buscando frases tipo "para [rol]", "ideal para", "diseñado
   para", "built for". Score de cobertura por página.

2. **Reasoning Chain Length (RCL)** — se le pide al LLM: *"¿Para qué tipo de
   usuario/equipo está pensado este producto, basándote solo en este
   contenido?"*, pidiéndole que muestre su razonamiento citando evidencia. Se
   cuenta cuántas piezas de evidencia distintas tuvo que combinar para llegar
   a la conclusión (1 pieza = inferencia mínima; 4-5 piezas combinadas =
   inferencia alta).

3. **Cross-Run Consistency (CRC)** — se corre la misma pregunta de persona N
   veces (temperature alta, mismo mecanismo que las corridas de AEO). Si el
   sitio es explícito, el LLM converge en la misma respuesta casi siempre; si
   tiene que inferir mucho, las respuestas varían más entre corridas. Se mide
   con similitud de embeddings entre respuestas, o de forma más simple, el %
   de corridas donde coincide la persona dominante: `CRC = 1 - (varianza de
   personas mencionadas entre corridas / N)`.

4. **Self-Reported Confidence (SRC)** — se le pide al LLM que puntúe su
   propia certeza de 0 a 1 sobre la inferencia realizada. Es la señal más
   débil de las cuatro (los LLMs no están perfectamente calibrados en
   autoconfianza), por lo que se usa como complemento, no como fuente
   principal.

**Fórmula del índice combinado:**

```
PIEI = 1 - [ (EMR × 0.35) + (CRC × 0.35) + (SRC × 0.15) + (1 - RCL_normalizado × 0.15) ]
```

Un **PIEI cercano a 0** indica que el sitio comunica su persona de forma
explícita y consistente (bajo esfuerzo de inferencia, bajo riesgo). Un
**PIEI cercano a 1** indica que el LLM tiene que inferir mucho, con baja
consistencia entre corridas (alto esfuerzo, alto riesgo de mala
interpretación por parte del motor de IA).

Los pesos (0.35 / 0.35 / 0.15 / 0.15) son un punto de partida razonable
—priorizan lo explícito y la consistencia entre corridas, que son los
componentes más accionables— y quedan documentados como ajustables, no como
una calibración validada empíricamente.

**Integración con el pipeline existente:** el PIEI se calcula sobre el mismo
contenido ya extraído para SEO/GEO (`extracted/structured_signals.json`),
sin requerir un scan nuevo, y reutiliza el mismo mecanismo de llamadas
repetidas a Gemini que ya se usa para AEO, aplicado a una pregunta distinta
("¿para quién es esto?" en vez de "¿qué producto recomendás?"). El resultado
se guarda en `/geo/persona_inference.json` como sub-métrica de GEO.

**Qué se dejó fuera de alcance:** el diseño completo arriba, sin ninguna
implementación (`geo/persona_inference.json`, la pregunta de razonamiento
sobre Gemini, el cálculo de CRC entre corridas) — queda documentado como
trabajo futuro, no como parte del pipeline construido en este ejercicio.

## Nivel de realidad del E-E-A-T medido en este ejercicio

**Cómo se maneja la data:** todas las señales de E-E-A-T se extraen
exclusivamente del **sitio propio vía sitemap crawl** (`/raw/pages/` →
`/extracted/structured_signals.json`). No hay ninguna fuente de datos
externa incorporada al pipeline (backlinks, menciones de terceros, reviews
en directorios como G2/Capterra, redes sociales, prensa).

Esto tiene una consecuencia importante: dos de los cuatro componentes del
framework E-E-A-T son, por definición, señales **externas** al sitio
(reputación otorgada por terceros), mientras que el pipeline solo puede
observar señales **internas** (lo que el sitio dice de sí mismo). El
resultado es una medición parcial, con distinto nivel de fidelidad por
componente:

| Componente | Qué se mide con la data disponible | Nivel de realidad |
|---|---|---|
| **Experience** | Proxy débil: detección de testimonios, casos de uso, capturas en el sitio — sin forma de verificar si son experiencias reales o copy de marketing | Bajo-medio: se mide *si el sitio simula tener experiencia*, no si la tiene |
| **Expertise** | Proxy medio: precisión técnica del copy, presencia de documentación, bio de autor cuando existe | Medio: verificable en el texto mismo, pero autodeclarado, sin credenciales externas que lo confirmen |
| **Authoritativeness** | Prácticamente no medible — requeriría backlinks, menciones externas, presencia en directorios reconocidos | Muy bajo / no medible con este pipeline: es el componente más débil de la implementación |
| **Trustworthiness** | El más verificable con la data disponible: HTTPS, fecha de publicación/actualización visible, página legal/"sobre nosotros", autoría atribuida — señales estructurales fáciles de chequear en el HTML | Medio-alto: es el único componente donde la medición se acerca a algo confiable |

**Conclusión y alcance declarado:** el score de E-E-A-T implementado en este
proyecto es una **aproximación basada exclusivamente en señales on-page del
sitio propio**. No incorpora datos externos, por lo que el componente de
Authoritativeness queda subrepresentado o directamente excluido del score
agregado. Se trata de un **proxy estructural** —mide si el sitio *presenta
las señales* típicamente asociadas a E-E-A-T— y no una medición completa del
constructo tal como lo evalúa Google (que pondera fuertemente señales de
reputación externa).

**Qué se dejó fuera de alcance (explícitamente):** cubrir Authoritativeness
de forma realista requeriría integrar una fuente de datos externa (API de
backlinks tipo Ahrefs/Moz, o scraping de presencia en G2/Capterra), lo cual
se decidió no incorporar en este ejercicio por agregar una dependencia
externa y complejidad adicional fuera del plazo disponible. Queda
documentado como una limitación conocida, no como un olvido.

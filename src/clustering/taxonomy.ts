/**
 * Hand-curated, category-level taxonomy for "project management /
 * productivity SaaS" -- the category shared by all 5 audited products
 * (see WORK_PLAN.md's clustering entry). Same mechanism as
 * ORG_TYPE_KEYWORDS/USER_TYPE_KEYWORDS in
 * questionGenerator/problemAudienceScanner.ts: cheap, deterministic,
 * consistent with the rest of the pipeline, but not truly semantic and
 * needs re-authoring for a different product category.
 *
 * Keywords are single tokens (tagcloud terms come from tokenize(), which
 * only ever produces single words) and are unique across themes so
 * assignment doesn't depend on iteration order.
 */
export const CATEGORY_THEMES: Record<string, string[]> = {
  "AI & Automation": [
    "agent", "agents", "ai", "automate", "automation", "automated",
    "assistant", "workflow", "workflows", "bot", "bots", "worker", "workers",
  ],
  "Collaboration & Teams": [
    "team", "teams", "collaborate", "collaboration", "collaborative",
    "share", "sharing", "sync", "member", "members", "comment", "comments",
    "workspace", "workspaces", "people",
  ],
  "Issue & Project Tracking": [
    "issue", "issues", "project", "projects", "task", "tasks", "ticket",
    "tickets", "backlog", "sprint", "sprints", "roadmap", "triage", "bug",
    "bugs", "milestone", "milestones",
  ],
  "Integrations & Ecosystem": [
    "integration", "integrations", "api", "apps", "marketplace", "plugin",
    "plugins", "connect", "webhook", "webhooks", "zapier", "slack",
    "github", "extension", "extensions",
  ],
  "Speed & Focus": [
    "fast", "faster", "speed", "quick", "focus", "streamline",
    "streamlined", "efficient", "efficiency", "simple", "simplicity",
    "minimal",
  ],
  "Pricing & Plans": [
    "price", "pricing", "plan", "plans", "free", "trial", "subscription",
    "billing", "credit", "credits", "cost", "enterprise", "tier", "tiers",
    "upgrade", "unlimited",
  ],
  "Security & Compliance": [
    "security", "secure", "compliance", "sso", "encryption", "privacy",
    "gdpr", "soc", "audit", "permissions", "access", "authentication",
  ],
  "Docs & Knowledge": [
    "docs", "documentation", "wiki", "notes", "knowledge", "template",
    "templates", "page", "pages", "content", "article", "articles",
  ],
  "Design & UX": [
    "design", "ux", "ui", "interface", "intuitive", "clean", "beautiful",
    "aesthetic",
  ],
};

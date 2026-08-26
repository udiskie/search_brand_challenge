export type CrawlMode = "quick" | "full";

export type PageType = "home" | "pricing" | "blog" | "docs" | "other";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface PageMeta {
  url: string;
  urlHash: string;
  status: number | null;
  headers: Record<string, string>;
  fetchedAt: string;
  error?: string;
}

export interface CrawledPage {
  url: string;
  urlHash: string;
  html: string;
  meta: PageMeta;
}

export interface HeadingEntry {
  tag: string;
  text: string;
}

export interface StructuredSignals {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  headings: HeadingEntry[];
  h1Count: number;
  headingOrderIssues: string[];
  schemaTypes: string[];
  internalLinkCount: number;
  externalLinkCount: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  wordCount: number;
  topKeywordDensity: { term: string; count: number; density: number }[];
}

export interface PageIndexEntry {
  url: string;
  urlHash: string;
  title: string | null;
  pageType: PageType;
}

export interface TagcloudTerm {
  term: string;
  score: number;
  documentFrequency: number;
}

export interface Tagcloud {
  site: TagcloudTerm[];
  byPage: Record<string, { term: string; score: number }[]>;
}

export interface PhraseCloudEntry {
  term: string;
  occurrences: { url: string; snippet: string }[];
}

export interface GeoSignals {
  url: string;
  entityClarity: {
    hasSelfContainedDefinition: boolean;
    definitionSnippet: string | null;
  };
  factualDensity: {
    numberCount: number;
    comparativeStatements: number;
    promotionalAdjectiveCount: number;
    score: number;
  };
  eeat: {
    hasVisibleAuthor: boolean;
    hasPublishDate: boolean;
    hasUpdatedDate: boolean;
    outboundCitationCount: number;
  };
  extractableStructure: {
    listCount: number;
    tableCount: number;
    definitionBlockCount: number;
    score: number;
  };
}

export interface SitemapCoverage {
  totalUrls: number;
  fetchedUrls: number;
  brokenUrls: string[];
  skippedUrls: string[];
}

export interface ScrapeConfig {
  product: string;
  siteUrl: string;
  mode: CrawlMode;
  quickPageCap: number;
  concurrency: number;
  requestDelayMs: number;
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
}

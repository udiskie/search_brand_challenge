import type {
  AeoAuditConfig,
  AttributeAnchor,
  GeneratedPrompt,
  Persona,
  PromptIntent,
  PromptLanguage,
} from "./types";

const PERSONAS: (Persona & { phrase: Record<PromptLanguage, string> })[] = [
  {
    role: "startup founder",
    teamSize: "solo",
    phrase: {
      en: "a startup founder working solo",
      es: "un fundador de startup que trabaja solo",
    },
  },
  {
    role: "engineering lead",
    teamSize: "large team",
    phrase: {
      en: "an engineering lead managing a large team",
      es: "un líder de ingeniería que gestiona un equipo grande",
    },
  },
  {
    role: "product manager",
    teamSize: "large company",
    phrase: {
      en: "a product manager at a large company",
      es: "un product manager en una empresa grande",
    },
  },
  {
    role: "freelancer",
    teamSize: "solo",
    phrase: {
      en: "a freelancer working alone",
      es: "un freelancer que trabaja solo",
    },
  },
  {
    role: "marketing team",
    teamSize: "small team",
    phrase: {
      en: "a small marketing team",
      es: "un equipo de marketing pequeño",
    },
  },
];

const ATTRIBUTE_PHRASES: Record<AttributeAnchor, Record<PromptLanguage, string>> = {
  price: {
    en: "a free or affordable option",
    es: "una opción gratis o económica",
  },
  speed_ux: {
    en: "something fast and simple to use",
    es: "algo rápido y simple de usar",
  },
  integrations: {
    en: "solid integrations with GitHub and Slack",
    es: "buenas integraciones con GitHub y Slack",
  },
  methodology: {
    en: "support for sprints and kanban boards",
    es: "soporte para sprints y tableros kanban",
  },
  none: {
    en: "that fits their workflow",
    es: "que se adapte a su flujo de trabajo",
  },
};

const ATTRIBUTES: AttributeAnchor[] = [
  "price",
  "speed_ux",
  "integrations",
  "methodology",
  "none",
];

const TEMPLATES: Record<
  Exclude<PromptIntent, "direct_comparison" | "final_decision">,
  Record<PromptLanguage, string>
> & {
  direct_comparison: Record<PromptLanguage, string>;
  final_decision: Record<PromptLanguage, string>;
} = {
  discovery: {
    en: "What {category} tools exist for {persona}?",
    es: "¿Qué herramientas de {category} existen para {persona}?",
  },
  recommendation_constraint: {
    en: "What's the best {category} tool for {persona} that needs {attribute}?",
    es: "¿Cuál es la mejor herramienta de {category} para {persona} que necesita {attribute}?",
  },
  troubleshooting_replacement: {
    en: "What are some alternatives to {brandA} that offer {attribute}?",
    es: "¿Qué alternativas a {brandA} ofrecen {attribute}?",
  },
  adversarial_control: {
    en: "How should {persona} organize their team's work?",
    es: "¿Cómo debería organizar el trabajo {persona}?",
  },
  direct_comparison: {
    en: "{brandA} vs {brandB}, which one should I choose?",
    es: "{brandA} vs {brandB}, ¿cuál elijo?",
  },
  final_decision: {
    en: "Between {brandA}, {brandB}, and {brandC}, which one do you recommend?",
    es: "Entre {brandA}, {brandB} y {brandC}, ¿cuál recomiendas?",
  },
};

const INTENT_ORDER: PromptIntent[] = [
  "discovery",
  "direct_comparison",
  "recommendation_constraint",
  "troubleshooting_replacement",
  "final_decision",
];

function render(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/**
 * Generates a set of AEO probe prompts by combining the dimensions
 * (intent × persona × specificity × attribute anchor × language) described
 * in WORK_PLAN.md, plus a reserved quota of adversarial/control prompts
 * that never name the category directly. Deterministic (round-robin
 * cycling, not Math.random()) so runs are reproducible and testable.
 */
export function generatePrompts(config: AeoAuditConfig): GeneratedPrompt[] {
  const { brand, competitors, category, promptCount } = config;
  const adversarialCount = Math.max(2, Math.round(promptCount * 0.15));
  const remaining = Math.max(0, promptCount - adversarialCount);

  const prompts: GeneratedPrompt[] = [];
  let counter = 0;

  for (let i = 0; i < remaining; i++) {
    const intent = INTENT_ORDER[i % INTENT_ORDER.length];
    const persona = PERSONAS[i % PERSONAS.length];
    const attribute = ATTRIBUTES[(i + INTENT_ORDER.indexOf(intent)) % ATTRIBUTES.length];
    const language: PromptLanguage = i % 2 === 0 ? "en" : "es";
    const competitor = competitors.length > 0 ? competitors[i % competitors.length] : "the competition";
    const secondCompetitor =
      competitors.length > 1 ? competitors[(i + 1) % competitors.length] : competitor;

    const values = {
      category,
      persona: persona.phrase[language],
      attribute: ATTRIBUTE_PHRASES[attribute][language],
      brandA: brand,
      brandB: competitor,
      brandC: secondCompetitor,
    };

    let text: string;
    let specificity: GeneratedPrompt["dimensions"]["specificity"];
    let brandsNamed: string[];

    switch (intent) {
      case "direct_comparison":
        text = render(TEMPLATES.direct_comparison[language], values);
        specificity = "specific";
        brandsNamed = [brand, competitor];
        break;
      case "troubleshooting_replacement": {
        // Alternate the anchor brand between a competitor and our own brand,
        // so we also see what the model suggests as an alternative to us.
        const anchor = i % 2 === 0 ? competitor : brand;
        text = render(TEMPLATES.troubleshooting_replacement[language], {
          ...values,
          brandA: anchor,
        });
        specificity = "semi_specific";
        brandsNamed = [anchor];
        break;
      }
      case "final_decision":
        text = render(TEMPLATES.final_decision[language], values);
        specificity = "specific";
        brandsNamed = [brand, competitor, secondCompetitor];
        break;
      case "recommendation_constraint":
        text = render(TEMPLATES.recommendation_constraint[language], values);
        specificity = "generic";
        brandsNamed = [];
        break;
      default:
        text = render(TEMPLATES.discovery[language], values);
        specificity = "generic";
        brandsNamed = [];
    }

    prompts.push({
      id: `${intent}-${counter++}`,
      text,
      dimensions: {
        intent,
        persona: { role: persona.role, teamSize: persona.teamSize },
        specificity,
        attribute,
        language,
        brandsNamed,
      },
    });
  }

  for (let i = 0; i < adversarialCount; i++) {
    const persona = PERSONAS[i % PERSONAS.length];
    const language: PromptLanguage = i % 2 === 0 ? "en" : "es";
    const text = render(TEMPLATES.adversarial_control[language], {
      persona: persona.phrase[language],
    });
    prompts.push({
      id: `adversarial_control-${counter++}`,
      text,
      dimensions: {
        intent: "adversarial_control",
        persona: { role: persona.role, teamSize: persona.teamSize },
        specificity: "generic",
        attribute: "none",
        language,
        brandsNamed: [],
      },
    });
  }

  return prompts;
}

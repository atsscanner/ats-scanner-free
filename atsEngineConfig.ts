/**
 * @file atsEngineConfig.ts
 * @description Fully completed configuration and rule engine for the client-side ATS Scanner.
 * Optimized for local parsing, robust keyword indexing, and multi-platform simulation.
 */

export interface ScoringWeights {
  formatting: number;
  keywordMatch: number;
  sections: number;
  experienceMetrics: number;
  readability: number;
}

export interface ATSProfile {
  name: string;
  strictness: 'High' | 'Medium' | 'Low';
  dislikesTables: boolean;
  dislikesColumns: boolean;
  requiresLinkedIn: boolean;
  weights: ScoringWeights;
  description: string;
}

export interface ATSConfig {
  version: string;
  minPassingScore: number;
  supportedFileTypes: string[];
  profiles: Record<string, ATSProfile>;
  sectionKeywords: Record<string, string[]>;
  formattingFlags: {
    maxRecommendedPages: number;
    forbiddenCharactersRegex: RegExp;
    metricIndicatorsRegex: RegExp;
  };
}

export const ATS_SCANNER_CONFIG: ATSConfig = {
  version: "2.1.0",
  minPassingScore: 75,
  supportedFileTypes: ["pdf", "docx", "txt"],
  
  profiles: {
    workday: {
      name: "Workday",
      strictness: "High",
      dislikesTables: true,
      dislikesColumns: true,
      requiresLinkedIn: false,
      description: "XML-based parser. Highly sensitive to multi-column text interleaving and complex table grids.",
      weights: {
        formatting: 0.35,
        keywordMatch: 0.30,
        sections: 0.15,
        experienceMetrics: 0.10,
        readability: 0.10
      }
    },
    taleo: {
      name: "Oracle Taleo",
      strictness: "High",
      dislikesTables: true,
      dislikesColumns: true,
      requiresLinkedIn: false,
      description: "One of the oldest and strictest enterprise parsers. Prefers simple, plain, linear single-column layouts.",
      weights: {
        formatting: 0.40,
        keywordMatch: 0.35,
        sections: 0.15,
        experienceMetrics: 0.05,
        readability: 0.05
      }
    },
    greenhouse: {
      name: "Greenhouse",
      strictness: "Medium",
      dislikesTables: false,
      dislikesColumns: false,
      requiresLinkedIn: true,
      description: "Modern, semantic parser. Handles columns gracefully and crawls social metadata URLs such as LinkedIn.",
      weights: {
        formatting: 0.15,
        keywordMatch: 0.40,
        sections: 0.20,
        experienceMetrics: 0.15,
        readability: 0.10
      }
    },
    lever: {
      name: "Lever",
      strictness: "Medium",
      dislikesTables: false,
      dislikesColumns: false,
      requiresLinkedIn: true,
      description: "Highly streamlined, modern candidate pipeline layout. Emphasizes clean text flows and skill extractions.",
      weights: {
        formatting: 0.20,
        keywordMatch: 0.35,
        sections: 0.20,
        experienceMetrics: 0.15,
        readability: 0.10
      }
    },
    successfactors: {
      name: "SAP SuccessFactors",
      strictness: "High",
      dislikesTables: true,
      dislikesColumns: true,
      requiresLinkedIn: false,
      description: "Strict corporate ecosystem parser. Prone to dropping information housed inside structural headers or footers.",
      weights: {
        formatting: 0.30,
        keywordMatch: 0.30,
        sections: 0.20,
        experienceMetrics: 0.10,
        readability: 0.10
      }
    }
  },

  sectionKeywords: {
    contact: [
      "contact", "information", "email", "phone", "address", 
      "linkedin", "github", "portfolio", "homepage"
    ],
    summary: [
      "summary", "professional summary", "objective", 
      "profile", "career overview", "about me"
    ],
    experience: [
      "experience", "work experience", "professional experience", 
      "employment history", "work history", "history", "career history"
    ],
    education: [
      "education", "academic background", "academic history", 
      "degrees", "university", "college", "qualifications"
    ],
    skills: [
      "skills", "technical skills", "core competencies", 
      "areas of expertise", "technologies", "proficiencies", "languages"
    ],
    projects: [
      "projects", "personal projects", "key projects", 
      "academic projects", "open source"
    ],
    certifications: [
      "certifications", "licenses", "certificates", 
      "courses", "awards", "honors"
    ]
  },

  formattingFlags: {
    maxRecommendedPages: 2,
    // Catch common problematic characters or legacy symbol graphics that crash older parsers
    forbiddenCharactersRegex: /[\u2022\u25C6\u25A0\u2713\u203A]/g, 
    // Captures metrics: e.g., $10k, +45%, 1.2M, 5,000+, "reduced costs by 20"
    metricIndicatorsRegex: /(\b\d+%\b|\$\d+|\b\d+\s*(?:million|billion|k|m)\b|\+\d+|\b\d{2,}\s*%\s*|\b(?:increased|decreased|reduced|saved|grew|managed)\b.*\b\d+\b)/i
  }
};

/**
 * Utility function to clean and map sections based on the configuration arrays
 */
export function identifySection(headerText: string): string | null {
  const normalized = headerText.trim().toLowerCase();
  
  for (const [section, keywords] of Object.entries(ATS_SCANNER_CONFIG.sectionKeywords)) {
    if (keywords.some(keyword => normalized.includes(keyword) || keyword.includes(normalized))) {
      return section;
    }
  }
  return null;
}

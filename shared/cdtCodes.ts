export interface CDTCode {
  code: string;
  category: CDTCodeCategory;
  name: string;
  description: string;
  defaultFee: number;
  requiresTooth?: boolean;
  requiresSurface?: boolean;
}

export type CDTCodeCategory =
  | "Diagnostic"
  | "Preventive"
  | "Restorative"
  | "Endodontics"
  | "Periodontics"
  | "Prosthodontics"
  | "Implant Services"
  | "Oral Surgery"
  | "Orthodontics"
  | "Adjunctive / General";

export const CDT_CATEGORIES: CDTCodeCategory[] = [
  "Diagnostic",
  "Preventive",
  "Restorative",
  "Endodontics",
  "Periodontics",
  "Prosthodontics",
  "Implant Services",
  "Oral Surgery",
  "Orthodontics",
  "Adjunctive / General",
];

export const CDT_CODES: CDTCode[] = [
  // 1. Diagnostic (D0100 - D0999)
  {
    code: "D0120",
    category: "Diagnostic",
    name: "Periodic Oral Evaluation - Established Patient",
    description: "Routine checkup examination for established patients to assess oral health status.",
    defaultFee: 55,
    requiresTooth: false,
  },
  {
    code: "D0140",
    category: "Diagnostic",
    name: "Limited Oral Evaluation - Problem Focused",
    description: "Emergency or specific problem evaluation focused on a particular symptom or area.",
    defaultFee: 75,
    requiresTooth: true,
  },
  {
    code: "D0150",
    category: "Diagnostic",
    name: "Comprehensive Oral Evaluation - New / Established",
    description: "Thorough initial examination including periodontal screening, charting, and medical review.",
    defaultFee: 95,
    requiresTooth: false,
  },
  {
    code: "D0210",
    category: "Diagnostic",
    name: "Intraoral - Complete Series of Radiographs (FMX)",
    description: "Full mouth series of periapical and bitewing radiographic images.",
    defaultFee: 140,
    requiresTooth: false,
  },
  {
    code: "D0220",
    category: "Diagnostic",
    name: "Intraoral - Periapical First Image",
    description: "Single diagnostic radiograph showing crown and root of targeted tooth.",
    defaultFee: 35,
    requiresTooth: true,
  },
  {
    code: "D0272",
    category: "Diagnostic",
    name: "Bitewings - Two Radiographic Images",
    description: "Two bitewing radiographs to check interproximal decay.",
    defaultFee: 50,
    requiresTooth: false,
  },
  {
    code: "D0274",
    category: "Diagnostic",
    name: "Bitewings - Four Radiographic Images",
    description: "Four bitewing radiographs for full posterior interproximal assessment.",
    defaultFee: 70,
    requiresTooth: false,
  },
  {
    code: "D0330",
    category: "Diagnostic",
    name: "Panoramic Radiographic Image",
    description: "Full jaw extraoral panoramic scan showing all teeth, roots, and surrounding jaw bone.",
    defaultFee: 110,
    requiresTooth: false,
  },

  // 2. Preventive (D1000 - D1999)
  {
    code: "D1110",
    category: "Preventive",
    name: "Prophylaxis - Adult Dental Cleaning",
    description: "Removal of plaque, calculus, and stains from tooth structures in normal periodontal health.",
    defaultFee: 95,
    requiresTooth: false,
  },
  {
    code: "D1120",
    category: "Preventive",
    name: "Prophylaxis - Child Dental Cleaning",
    description: "Dental cleaning and polishing for pediatric patients up to age 13.",
    defaultFee: 70,
    requiresTooth: false,
  },
  {
    code: "D1206",
    category: "Preventive",
    name: "Topical Application of Fluoride Varnish",
    description: "Professional application of high-potency topical fluoride to prevent demineralization.",
    defaultFee: 45,
    requiresTooth: false,
  },
  {
    code: "D1351",
    category: "Preventive",
    name: "Dental Sealant - Per Tooth",
    description: "Preventive resin barrier placed on occlusal pit and fissures of premolars or molars.",
    defaultFee: 55,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D1354",
    category: "Preventive",
    name: "Interim Caries Arresting Medicament (SDF)",
    description: "Silver diamine fluoride application to arrest active tooth decay.",
    defaultFee: 40,
    requiresTooth: true,
  },

  // 3. Restorative (D2000 - D2999)
  {
    code: "D2140",
    category: "Restorative",
    name: "Amalgam - 1 Surface, Primary / Permanent",
    description: "Single-surface silver amalgam filling.",
    defaultFee: 130,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2150",
    category: "Restorative",
    name: "Amalgam - 2 Surfaces, Primary / Permanent",
    description: "Two-surface silver amalgam filling (e.g. MO, DO).",
    defaultFee: 165,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2330",
    category: "Restorative",
    name: "Resin Composite - 1 Surface, Anterior",
    description: "Tooth-colored composite restoration on anterior incisor or canine.",
    defaultFee: 160,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2331",
    category: "Restorative",
    name: "Resin Composite - 2 Surfaces, Anterior",
    description: "Two-surface tooth-colored restoration on anterior tooth.",
    defaultFee: 195,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2332",
    category: "Restorative",
    name: "Resin Composite - 3 Surfaces, Anterior",
    description: "Three-surface tooth-colored composite restoration on anterior tooth.",
    defaultFee: 230,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2391",
    category: "Restorative",
    name: "Resin Composite - 1 Surface, Posterior",
    description: "Tooth-colored composite filling on premolar or molar (1 surface, e.g. Occlusal).",
    defaultFee: 175,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2392",
    category: "Restorative",
    name: "Resin Composite - 2 Surfaces, Posterior",
    description: "Tooth-colored composite filling on premolar or molar (2 surfaces, e.g. MO or DO).",
    defaultFee: 220,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2393",
    category: "Restorative",
    name: "Resin Composite - 3 Surfaces, Posterior",
    description: "Tooth-colored composite filling on premolar or molar (3 surfaces, e.g. MOD).",
    defaultFee: 270,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2394",
    category: "Restorative",
    name: "Resin Composite - 4+ Surfaces, Posterior",
    description: "Extensive tooth-colored composite filling covering four or more surfaces.",
    defaultFee: 320,
    requiresTooth: true,
    requiresSurface: true,
  },
  {
    code: "D2740",
    category: "Restorative",
    name: "Crown - Porcelain / Ceramic",
    description: "Full coverage all-ceramic tooth restoration (Zirconia / E.max).",
    defaultFee: 950,
    requiresTooth: true,
  },
  {
    code: "D2750",
    category: "Restorative",
    name: "Crown - Porcelain Fused to High Noble Metal (PFM)",
    description: "Full coverage aesthetic crown with metal coping foundation.",
    defaultFee: 1050,
    requiresTooth: true,
  },
  {
    code: "D2950",
    category: "Restorative",
    name: "Core Buildup, Including Any Pins",
    description: "Structural buildup of anatomical crown prior to crown preparation.",
    defaultFee: 240,
    requiresTooth: true,
  },
  {
    code: "D2962",
    category: "Restorative",
    name: "Labial Veneer (Porcelain Laminate)",
    description: "Custom cosmetic porcelain facing bonded to facial surface of anterior tooth.",
    defaultFee: 850,
    requiresTooth: true,
  },

  // 4. Endodontics (D3000 - D3999)
  {
    code: "D3310",
    category: "Endodontics",
    name: "Root Canal Therapy - Anterior Tooth",
    description: "Complete pulpectomy and obturation of anterior tooth (incisor or canine).",
    defaultFee: 750,
    requiresTooth: true,
  },
  {
    code: "D3320",
    category: "Endodontics",
    name: "Root Canal Therapy - Premolar Tooth",
    description: "Complete pulpectomy and obturation of bicuspid/premolar tooth.",
    defaultFee: 850,
    requiresTooth: true,
  },
  {
    code: "D3330",
    category: "Endodontics",
    name: "Root Canal Therapy - Molar Tooth",
    description: "Complete pulpectomy and obturation of multi-rooted molar tooth.",
    defaultFee: 1050,
    requiresTooth: true,
  },
  {
    code: "D3346",
    category: "Endodontics",
    name: "Retreatment of Previous Root Canal - Anterior",
    description: "Removal of existing root canal filling, disinfection, and re-obturation.",
    defaultFee: 850,
    requiresTooth: true,
  },
  {
    code: "D3348",
    category: "Endodontics",
    name: "Retreatment of Previous Root Canal - Molar",
    description: "Revision and retreatment of complex molar root canal therapy.",
    defaultFee: 1150,
    requiresTooth: true,
  },
  {
    code: "D3410",
    category: "Endodontics",
    name: "Apicoectomy - Anterior",
    description: "Surgical removal of root tip and retro-filling seal.",
    defaultFee: 600,
    requiresTooth: true,
  },

  // 5. Periodontics (D4000 - D4999)
  {
    code: "D4341",
    category: "Periodontics",
    name: "Periodontal Scaling & Root Planing - 4+ Teeth / Quad",
    description: "Deep ultrasonic and hand scaling below gumline for active periodontal pocketing.",
    defaultFee: 240,
    requiresTooth: false,
  },
  {
    code: "D4342",
    category: "Periodontics",
    name: "Periodontal Scaling & Root Planing - 1 to 3 Teeth / Quad",
    description: "Localized deep cleaning and root instrumentation.",
    defaultFee: 150,
    requiresTooth: false,
  },
  {
    code: "D4346",
    category: "Periodontics",
    name: "Scaling in Presence of Generalized Gingival Inflammation",
    description: "Full mouth therapeutic scaling for moderate-to-severe gingivitis.",
    defaultFee: 130,
    requiresTooth: false,
  },
  {
    code: "D4910",
    category: "Periodontics",
    name: "Periodontal Maintenance",
    description: "Continuing therapy following active periodontal treatment (every 3-4 months).",
    defaultFee: 145,
    requiresTooth: false,
  },

  // 6. Prosthodontics (D5000 - D5899 & D6200 - D6799)
  {
    code: "D5110",
    category: "Prosthodontics",
    name: "Complete Denture - Maxillary (Upper)",
    description: "Full upper arch custom removable dental prosthesis.",
    defaultFee: 1400,
    requiresTooth: false,
  },
  {
    code: "D5120",
    category: "Prosthodontics",
    name: "Complete Denture - Mandibular (Lower)",
    description: "Full lower arch custom removable dental prosthesis.",
    defaultFee: 1400,
    requiresTooth: false,
  },
  {
    code: "D5213",
    category: "Prosthodontics",
    name: "Maxillary Partial Denture - Cast Metal Framework",
    description: "Upper removable partial denture with precision cast framework and resin base.",
    defaultFee: 1650,
    requiresTooth: false,
  },
  {
    code: "D5214",
    category: "Prosthodontics",
    name: "Mandibular Partial Denture - Cast Metal Framework",
    description: "Lower removable partial denture with precision cast framework and resin base.",
    defaultFee: 1650,
    requiresTooth: false,
  },
  {
    code: "D6240",
    category: "Prosthodontics",
    name: "Pontic - Porcelain Fused to High Noble Metal",
    description: "Artificial replacement tooth suspended between retainer crowns on a bridge.",
    defaultFee: 950,
    requiresTooth: true,
  },
  {
    code: "D6750",
    category: "Prosthodontics",
    name: "Retainer Crown - Porcelain Fused to Metal",
    description: "Abutment crown anchor for fixed dental bridge.",
    defaultFee: 950,
    requiresTooth: true,
  },

  // 7. Implant Services (D6000 - D6199)
  {
    code: "D6010",
    category: "Implant Services",
    name: "Surgical Placement of Endosteal Implant Body",
    description: "Titanium dental implant fixture surgically placed into alveolar bone.",
    defaultFee: 1850,
    requiresTooth: true,
  },
  {
    code: "D6056",
    category: "Implant Services",
    name: "Prefabricated Custom Abutment",
    description: "Connector post secured to implant fixture to support prosthetic crown.",
    defaultFee: 550,
    requiresTooth: true,
  },
  {
    code: "D6058",
    category: "Implant Services",
    name: "Abutment Supported Porcelain / Ceramic Crown",
    description: "Custom aesthetic implant crown mounted atop abutment.",
    defaultFee: 1200,
    requiresTooth: true,
  },

  // 8. Oral Surgery (D7000 - D7999)
  {
    code: "D7140",
    category: "Oral Surgery",
    name: "Extraction - Erupted Tooth / Exposed Root",
    description: "Simple routine extraction of erupted permanent or primary tooth.",
    defaultFee: 160,
    requiresTooth: true,
  },
  {
    code: "D7210",
    category: "Oral Surgery",
    name: "Surgical Extraction - Bone Removal / Sectioning",
    description: "Surgical tooth removal requiring flap reflection, bone relief, or tooth sectioning.",
    defaultFee: 275,
    requiresTooth: true,
  },
  {
    code: "D7220",
    category: "Oral Surgery",
    name: "Removal of Impacted Tooth - Soft Tissue",
    description: "Extraction of wisdom tooth or impacted tooth under mucosal tissue.",
    defaultFee: 320,
    requiresTooth: true,
  },
  {
    code: "D7230",
    category: "Oral Surgery",
    name: "Removal of Impacted Tooth - Partially Bony",
    description: "Surgical extraction of wisdom tooth partially encased in jawbone.",
    defaultFee: 410,
    requiresTooth: true,
  },
  {
    code: "D7240",
    category: "Oral Surgery",
    name: "Removal of Impacted Tooth - Completely Bony",
    description: "Complex surgical extraction of fully impacted wisdom tooth within alveolar bone.",
    defaultFee: 510,
    requiresTooth: true,
  },
  {
    code: "D7960",
    category: "Oral Surgery",
    name: "Frenulectomy / Frenectomy",
    description: "Surgical excision of labial or lingual frenum band (tongue-tie / lip-tie).",
    defaultFee: 350,
    requiresTooth: false,
  },

  // 9. Orthodontics (D8000 - D8999)
  {
    code: "D8080",
    category: "Orthodontics",
    name: "Comprehensive Orthodontic Treatment - Adolescent",
    description: "Full arch bracket and archwire or aligner therapy for teenage patients.",
    defaultFee: 4500,
    requiresTooth: false,
  },
  {
    code: "D8090",
    category: "Orthodontics",
    name: "Comprehensive Orthodontic Treatment - Adult",
    description: "Full arch orthodontic or clear aligner realignment for adult dentition.",
    defaultFee: 5200,
    requiresTooth: false,
  },
  {
    code: "D8680",
    category: "Orthodontics",
    name: "Orthodontic Retention (Clear Retainers)",
    description: "Fabrication and delivery of custom Hawley or Essix retention appliances.",
    defaultFee: 450,
    requiresTooth: false,
  },

  // 10. Adjunctive / General Services (D9000 - D9999)
  {
    code: "D9110",
    category: "Adjunctive / General",
    name: "Palliative Emergency Treatment of Dental Pain",
    description: "Minor emergency intervention to relieve acute discomfort, pain, or bleeding.",
    defaultFee: 110,
    requiresTooth: true,
  },
  {
    code: "D9230",
    category: "Adjunctive / General",
    name: "Nitrous Oxide Inhalation (Laughing Gas)",
    description: "Inhalation conscious sedation for anxiety relief during procedures.",
    defaultFee: 90,
    requiresTooth: false,
  },
  {
    code: "D9944",
    category: "Adjunctive / General",
    name: "Occlusal Guard - Hard Appliance, Full Arch",
    description: "Custom laboratory fabricated nightguard for bruxism and TMJ protection.",
    defaultFee: 550,
    requiresTooth: false,
  },
  {
    code: "D9972",
    category: "Adjunctive / General",
    name: "In-Office Teeth Whitening - Per Arch",
    description: "Professional high-concentration laser or LED light-activated dental bleaching.",
    defaultFee: 350,
    requiresTooth: false,
  },
];

/** Search helper for CDT codes by query string across code, name, category, and description */
export function searchCDTCodes(query: string, category?: CDTCodeCategory | "All"): CDTCode[] {
  const q = query.trim().toLowerCase();
  return CDT_CODES.filter(item => {
    if (category && category !== "All" && item.category !== category) {
      return false;
    }
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });
}

/** Lookup a single CDT code */
export function getCDTCode(code: string): CDTCode | undefined {
  const normalized = code.trim().toUpperCase();
  return CDT_CODES.find(c => c.code.toUpperCase() === normalized);
}

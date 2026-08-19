/**
 * Dental Notation Systems:
 *  - FDI (ISO 3950) — Two-digit quadrant system (e.g., 18..11, 21..28, 48..41, 31..38)
 *  - Universal (ADA) — Sequential 1..32 numbering (e.g., 1..16 upper, 17..32 lower)
 *  - Palmer — Quadrant bracket notation (e.g., 8┘..1┘, └1..└8, ┌1..┌8, 1┐..8┐)
 */

export type NotationSystem = "fdi" | "universal" | "palmer";

/** Map FDI number to Universal (1..32) number */
export function fdiToUniversal(fdi: number): number {
  const quad = Math.floor(fdi / 10);
  const tooth = fdi % 10;

  if (quad === 1) {
    // 18 -> 1, 17 -> 2, ..., 11 -> 8
    return 9 - tooth;
  }
  if (quad === 2) {
    // 21 -> 9, 22 -> 10, ..., 28 -> 16
    return 8 + tooth;
  }
  if (quad === 3) {
    // 38 -> 17, 37 -> 18, ..., 31 -> 24
    return 25 - tooth;
  }
  if (quad === 4) {
    // 41 -> 25, 42 -> 26, ..., 48 -> 32
    return 24 + tooth;
  }
  return fdi;
}

/** Map FDI number to Palmer notation string */
export function fdiToPalmer(fdi: number): string {
  const quad = Math.floor(fdi / 10);
  const tooth = fdi % 10;

  switch (quad) {
    case 1: // Upper Right
      return `${tooth}┘`;
    case 2: // Upper Left
      return `└${tooth}`;
    case 3: // Lower Left
      return `┌${tooth}`;
    case 4: // Lower Right
      return `${tooth}┐`;
    default:
      return String(tooth);
  }
}

/** Format tooth number into the active notation system */
export function formatToothNumber(fdi: number | string, system: NotationSystem = "fdi"): string {
  const num = Number(fdi);
  if (Number.isNaN(num)) return String(fdi);

  switch (system) {
    case "universal":
      return String(fdiToUniversal(num));
    case "palmer":
      return fdiToPalmer(num);
    case "fdi":
    default:
      return String(num);
  }
}

/** Get full anatomical tooth name from FDI number */
export function getToothAnatomicalName(fdi: number | string): string {
  const num = Number(fdi);
  const quad = Math.floor(num / 10);
  const tooth = num % 10;

  const quadNames: Record<number, string> = {
    1: "Maxillary Right (Upper Right)",
    2: "Maxillary Left (Upper Left)",
    3: "Mandibular Left (Lower Left)",
    4: "Mandibular Right (Lower Right)",
  };

  const toothNames: Record<number, string> = {
    1: "Central Incisor",
    2: "Lateral Incisor",
    3: "Canine (Cuspid)",
    4: "First Premolar (Bicuspid)",
    5: "Second Premolar (Bicuspid)",
    6: "First Molar (6-year molar)",
    7: "Second Molar (12-year molar)",
    8: "Third Molar (Wisdom tooth)",
  };

  const qName = quadNames[quad] || `Quadrant ${quad}`;
  const tName = toothNames[tooth] || `Tooth ${tooth}`;
  return `${qName} ${tName}`;
}

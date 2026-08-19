import { useMemo } from "react";
import { ANATOMY, type AnatomyTemplate } from "@/lib/toothAnatomy";

/**
 * ToothGlyph — anatomical tooth illustration adapted from the
 * "measured" artwork of React Advanced Odontogram
 * (ZoliQua/React-Odontogram-Modul, MIT, SVG v2.5.0 by Zoltan Dul).
 *
 * Style: realistic cross-section-like tooth — off-white enamel crown with
 * visible pink pulp chamber tapering into the root canal, a curved CEJ with a
 * pink gingival (gum) band, and a pale cream bone base. Molars show their
 * characteristic multi-root anatomy.
 *
 * Orientation (FDI notation), same as the reference odontogram:
 *   upper right (1x)  — crown up, roots down, no mirror
 *   upper left  (2x)  — crown up, roots down, mirrored horizontally
 *   lower left  (3x)  — rotated 180 (roots up), no mirror
 *   lower right (4x)  — rotated 180, mirrored horizontally
 */

/** Template numbers for which a dedicated measured artwork exists. */
const TEMPLATES: Record<number, AnatomyTemplate> = {
  1: 11, 2: 11, // central & lateral incisors use the incisor template
  3: 13, // canine
  4: 14, 5: 15, // premolars
  6: 16, 7: 17, 8: 17, // upper molars
};
const LOWER_MOLAR = 46 as AnatomyTemplate;

function templateFor(fdNumber: number): { tpl: AnatomyTemplate; rot: number; mirror: boolean } {
  const pos = fdNumber % 10; // 1..8 within quadrant
  const quad = Math.floor(fdNumber / 10); // 1,2,3,4
  const isUpper = quad === 1 || quad === 2;
  const isRight = quad === 1 || quad === 4;

  let tpl: AnatomyTemplate;
  if (!isUpper && (pos === 6 || pos === 7 || pos === 8)) {
    // lower molars use the dedicated 46 drawing
    tpl = LOWER_MOLAR;
  } else {
    tpl = TEMPLATES[pos] ?? 11;
  }

  // Reference mapping: quadrants 1 base; 2 mirrored; 3 rotated 180; 4 rotated 180 + mirrored
  const ops: string[] = [];
  if (!isRight) ops.push("scale(-1 1)");
  if (!isUpper) ops.push("scale(1 -1)");
  const rot = ops.length === 0 ? 0 : 180;
  // We express transforms relative to the artwork's own center, below.
  void rot;
  const mirror = ops.some(o => o === "scale(-1 1)");
  const flipY = ops.some(o => o === "scale(1 -1)");
  const flipX = ops.some(o => o === "scale(-1 1)");
  const flipBoth = flipX && flipY;
  return { tpl, rot: flipBoth ? 180 : flipY ? 180 : 0, mirror: flipX };
}

/** Orientation transform for the odontogram reference frame. */
export function toothTransform(fdNumber: number): string {
  const quad = Math.floor(fdNumber / 10);
  const isUpper = quad === 1 || quad === 2;
  const isRight = quad === 1 || quad === 4;
  const ops: string[] = [];
  if (!isRight) ops.push("scale(-1 1)");
  if (!isUpper) ops.push("scale(1 -1)");
  if (ops.length === 0) return "";
  return `translate(50 50) ${ops.join(" ")} translate(-50 -50)`;
}

/**
 * Build the per-tooth transform relative to the artwork's own viewBox center.
 * The artwork is always drawn upright (crown up); lower teeth need a 180°
 * rotation, right-side teeth a horizontal mirror (viewed from outside).
 */
function localTransform(fdNumber: number, vb: string): string {
  const quad = Math.floor(fdNumber / 10);
  const isUpper = quad === 1 || quad === 2;
  const isRight = quad === 1 || quad === 4;
  const parts = vb.split(/\s+/).map(Number);
  const cx = (parts[0] + parts[2]) / 2;
  const cy = (parts[1] + parts[3]) / 2;
  const ops: string[] = [];
  if (!isRight) ops.push("scale(-1 1)");
  if (!isUpper) ops.push("scale(1 -1)");
  if (ops.length === 0) return "";
  return `translate(${cx} ${cy}) ${ops.join(" ")} translate(${-cx} ${-cy})`;
}

/**
 * Condition coloring for the anatomical artwork.
 * The artwork's shapes have fixed fill colors, so we tint the whole artwork
 * per-condition using CSS hue/saturation/lightness blending, plus an opacity
 * dim for missing/extraction states.
 */
const CONDITION_TINT: Record<string, string> = {
  healthy: "none",
  decay: "saturate(1.6) hue-rotate(340deg)",
  filling: "saturate(1.4) hue-rotate(185deg)",
  crown: "saturate(1.3) hue-rotate(235deg)",
  extraction: "grayscale(1)",
  implant: "saturate(1.2) hue-rotate(195deg)",
  root_canal: "saturate(1.5) hue-rotate(15deg)",
  missing: "grayscale(1)",
  veneers: "saturate(1.3) hue-rotate(125deg)",
  bridge: "saturate(1.2) hue-rotate(235deg)",
};

const CONDITION_FILL_TINT: Record<string, string> = {
  healthy: "saturate(1.1)",
  decay: "saturate(1.8) hue-rotate(345deg) brightness(0.98)",
  filling: "saturate(1.6) hue-rotate(190deg)",
  crown: "saturate(1.5) hue-rotate(235deg)",
  extraction: "grayscale(0.6) opacity(0.55)",
  implant: "saturate(1.4) hue-rotate(190deg)",
  root_canal: "saturate(1.7) hue-rotate(12deg)",
  missing: "grayscale(0.8) opacity(0.45)",
  veneers: "saturate(1.5) hue-rotate(125deg)",
  bridge: "saturate(1.4) hue-rotate(235deg)",
};

export function ToothGlyph({
  number,
  fill = "#f8fafc",
  stroke = "#64748b",
  cond,
  opacity = 1,
  selected,
  /** planned-treatment layer — rendered as a dashed outline, like the reference odontogram */
  plan = false,
  /** visibility layers from the reference odontogram controls */
  showBone = true,
  showPulp = true,
}: {
  number: number; // FDI number, e.g. 16
  fill?: string;
  stroke?: string;
  /** condition key, e.g. "decay" — used to pick the tint filter */
  cond?: string;
  opacity?: number;
  selected?: boolean;
  plan?: boolean;
  showBone?: boolean;
  showPulp?: boolean;
}) {
  void fill;
  const { tpl, mirror } = useMemo(() => templateFor(number), [number]);
  void mirror;
  const art = useMemo(() => ANATOMY[tpl], [tpl]);
  const transform = useMemo(() => localTransform(number, art.viewBox), [number, art]);
  const tint = cond ? (CONDITION_TINT[cond] ?? "none") : "none";
  const fillTint = cond ? (CONDITION_FILL_TINT[cond] ?? "none") : "none";
  const isMissing = cond === "missing" || cond === "extraction";

  return (
    <g transform={transform} style={{ opacity: cond && cond !== "healthy" && isMissing ? 0.4 : opacity }}>
      {/* condition-tinted artwork */}
      <g
        className="odontogram-art"
        data-show-bone={showBone}
        data-show-pulp={showPulp}
        data-plan={plan}
        style={{
          filter: selected
            ? `${tint} drop-shadow(0 0 2.5px ${stroke})`
            : plan
              ? "none"
              : fillTint,
          strokeDasharray: plan ? "2.6 2" : undefined,
          opacity: plan ? 0.9 : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: art.inner }}
      />
      {/* selection ring around the crown */}
      {selected && !plan && (
        <rect
          x={-6}
          y={-10}
          width={50}
          height={72}
          rx={10}
          fill="none"
          stroke={stroke}
          strokeWidth={2.2}
          strokeDasharray="3.5 2.5"
        />
      )}
      {/* plan-mode halo: dashed rounded outline around the crown */}
      {plan && (
        <rect
          x={-5}
          y={-8}
          width={48}
          height={68}
          rx={9}
          fill="none"
          stroke={stroke}
          strokeWidth={1.6}
          strokeDasharray="3 2"
          opacity={0.85}
        />
      )}
    </g>
  );
}

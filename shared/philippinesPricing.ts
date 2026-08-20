export const CLINIC_CURRENCY = {
  code: "PHP",
  locale: "en-PH",
  symbol: "₱",
} as const;

/**
 * Editable starting fees in Philippine pesos.
 * These are clinic configuration values, not mandatory or official fees.
 * Review them with the clinic dentist/administrator before using them for billing.
 */
export const PHILIPPINE_CDT_FEES: Record<string, number> = {
  // Diagnostic
  D0120: 500,
  D0140: 700,
  D0150: 800,
  D0210: 2500,
  D0220: 250,
  D0272: 500,
  D0274: 800,
  D0330: 1250,

  // Preventive
  D1110: 1500,
  D1120: 1000,
  D1206: 800,
  D1351: 1000,
  D1354: 800,

  // Restorative
  D2140: 1800,
  D2150: 2500,
  D2330: 2500,
  D2331: 3000,
  D2332: 3500,
  D2391: 2500,
  D2392: 3000,
  D2393: 3500,
  D2394: 4000,
  D2740: 25000,
  D2750: 12000,
  D2950: 5000,
  D2962: 15000,

  // Endodontics
  D3310: 10000,
  D3320: 12000,
  D3330: 18000,
  D3346: 13000,
  D3348: 17000,
  D3410: 8000,

  // Periodontics
  D4341: 3500,
  D4342: 2500,
  D4346: 2000,
  D4910: 2000,

  // Prosthodontics
  D5110: 27000,
  D5120: 27000,
  D5213: 20000,
  D5214: 20000,
  D6240: 18000,
  D6750: 12000,

  // Implant Services
  D6010: 35000,
  D6056: 8000,
  D6058: 25000,

  // Oral Surgery
  D7140: 1500,
  D7210: 5000,
  D7220: 5000,
  D7230: 7000,
  D7240: 9000,
  D7960: 8000,

  // Orthodontics
  D8080: 55000,
  D8090: 70000,
  D8680: 3000,

  // Adjunctive / General
  D9110: 2000,
  D9230: 2500,
  D9944: 8000,
  D9972: 12000,
};

export function getPhilippineCDTFee(code: string, fallback = 0): number {
  return PHILIPPINE_CDT_FEES[code.trim().toUpperCase()] ?? fallback;
}

export function formatPhilippinePeso(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(CLINIC_CURRENCY.locale, {
    style: "currency",
    currency: CLINIC_CURRENCY.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

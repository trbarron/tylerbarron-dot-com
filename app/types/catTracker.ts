// Types for the Cat Tracker API (cat-finder repo Lambdas).
// Summary endpoint:  .../checoStage/checoRestEndpoint
// Details endpoint:  .../checoStage/checoRestEndpoint/details
//
// Fields marked optional are additions from the 2026-06-10 Lambda update; they
// are optional so the frontend degrades gracefully if it ships before the
// Lambda redeploy.

export interface CatSummaryData {
  work_time: string; // "H:MM:SS", tuni + checo
  is_present: boolean;
  checo_time: string;
  tuni_time: string;
  cat: string;
}

export interface PerCatWorkTime {
  today: string; // "H:MM:SS"
  last_week_hours: number;
  thirty_days_hours: number;
  lifetime_hours: number;
}

export interface WorkTimeHistogramEntry {
  hour: number; // true Mountain-Time hour, 0-23 (pre-2026-06-10 Lambdas sent it shifted +6)
  count: number; // minutes of work (= tuni + checo + other, within rounding)
  tuni?: number;
  checo?: number;
  other?: number;
}

export interface CatDetailedData {
  today_work_time?: string; // "H:MM:SS"
  last_week_work_time: number; // hours
  thirty_days_work_time: number; // hours
  lifetime_work_time: number; // hours
  is_present: boolean;
  cat: "Tuni" | "Checo" | null;
  // `other` is ~307 lifetime hours of pre-custom-model entries ("Siamese cat",
  // "tabby", ...) that can't be attributed to either cat. Recent windows are 0.
  // Show it as "unknown" or compute percentages over tuni + checo only — never
  // fold it into one cat.
  per_cat_work_time?: {
    tuni: PerCatWorkTime;
    checo: PerCatWorkTime;
    other: PerCatWorkTime;
  };
  work_time_histogram: WorkTimeHistogramEntry[];
}

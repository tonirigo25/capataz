import { createHash } from "node:crypto";

export const SIGNAL_IDS = [
  "cmrjjtdha01c0ml0pymwqg02u",
  "cmrjjtdhm01c1ml0pqzw68bo7",
];
export const RECOMMENDATION_IDS = [
  "cmrjjtdqo01ceml0p2jq147u2",
  "cmrjjtdr801chml0pov3igtwc",
];
export const PARENT_IDS = {
  clientId: "cmrjjgvgb0000vdj0ld4qby02",
  workId: "cmrjjgvr90002vdj0xz2fq0sb",
  invoiceId: "cmrjjgwd50006vdj093l9wqpo",
};
export const SIGNAL_FINGERPRINTS = [
  `invoice:due-soon:${PARENT_IDS.invoiceId}`,
  `client:data:${PARENT_IDS.clientId}`,
];
export const RECOMMENDATION_FINGERPRINTS = [
  `recommendation:invoice_review:${PARENT_IDS.invoiceId}`,
  `recommendation:client_data_completion:${PARENT_IDS.clientId}`,
];
export const MANIFEST_LINES = [
  ...SIGNAL_IDS.map((id) => `BusinessSignalState:${id}`),
  ...RECOMMENDATION_IDS.map((id) => `BusinessRecommendation:${id}`),
].sort();
export const MANIFEST_SHA256 = createHash("sha256").update(MANIFEST_LINES.join("\n")).digest("hex");
export const EXPECTED_MANIFEST_SHA256 = "6d5edee4d1d163c9d4f0fad09eb6a8966fd8b09c8c23d08e47dd4603b7f4569d";
export const CLEANUP_APPROVAL = "DELETE-4-DERIVED-RESIDUES-6d5edee4";

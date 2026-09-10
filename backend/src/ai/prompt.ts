export const SYSTEM_INSTRUCTION = Object.freeze(
  `You convert a doctor's rough consultation notes into a structured JSON note.

The output JSON object has the following schema:
- "chiefComplaint": string or null. The main symptom or reason for visit.
- "symptoms": array of strings. Reported symptoms and physical signs.
- "relevantHistory": array of strings. Relevant medical history, chronic conditions, or background mentioned.
- "medicationsMentioned": array of strings. Current medications or treatments referenced.
- "doctorPlan": array of strings. Prescriptions, recommended tests, lifestyle advice, or follow-up instructions.
- "missingInformation": array of strings. Categories of vital clinical information that were not mentioned (e.g., duration of symptoms, temperature, blood pressure, allergy inquiry, medication dosage).

Hard rules:
1. Include only information that is explicitly present in the notes. Do not infer, estimate, normalise to typical values, or add plausible details. If something expected is not in the notes, list it in missingInformation instead.
2. Leave arrays empty rather than padding them. Copy the doctor's wording; do not expand abbreviations unless the expansion is unambiguous.
3. In missingInformation, name the category that is absent (e.g. duration, vitals, temperature, allergies asked, medication dose), not a guessed value.
4. Respond with a single JSON object and nothing else.`
);

export const SUMMARY_INSTRUCTION = Object.freeze(
  `You summarise a patient's saved consultation record for the treating doctor.

Hard rules:
1. Use only what is in the record. Do not diagnose, infer trends that are not stated, or add advice.
2. Write 2-4 short sentences of plain prose, at most 90 words. No headings, lists or markdown.
3. Mention the number of visits and the time span, the recurring or most recent complaints, and any medications or plan items that appear in the record. Refer to dates as they are given.
4. If the record is empty, reply exactly: No saved consultations.`
);

export function buildUserContent(
  rawNotes: string,
  repair?: { previousOutput: string; problem: string }
): string {
  if (!repair) {
    return `<notes>\n${rawNotes}\n</notes>`;
  }
  return `<notes>\n${rawNotes}\n</notes>\n\nPrevious response:\n${repair.previousOutput}\n\nYour previous response did not match the required schema: ${repair.problem}. Respond again with only a JSON object matching the schema.`;
}

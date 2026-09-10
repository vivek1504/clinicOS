import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be defined to seed the database");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("Seeding database...");

  const now = new Date();
  const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  const today930 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0, 0);
  const today1015 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 15, 0, 0);
  const today1100 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);

  const tomorrow1000 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0, 0);

  const monthsAgo = (m: number, d = 15) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - m, d, 14, 0, 0, 0);
    return dt;
  };

  await prisma.$transaction(async (tx) => {
    // 1. Doctor
    // Demo sign-in: mehta@clinicos.local / clinicos
    const passwordHash = await Bun.password.hash("clinicos");
    await tx.doctor.upsert({
      where: { id: "doc_default" },
      update: { name: "Dr. Mehta", email: "mehta@clinicos.local", passwordHash },
      create: {
        id: "doc_default",
        name: "Dr. Mehta",
        email: "mehta@clinicos.local",
        passwordHash,
      },
    });

    // 2. Patients
    const patients = [
      {
        id: "pat_asha",
        name: "Asha Sharma",
        dob: new Date("1988-04-12"),
        gender: "FEMALE" as const,
        phone: "+1-555-0101",
        allergies: ["Penicillin", "Sulfa drugs"],
        conditions: ["Asthma", "Mild Hypertension"],
      },
      {
        id: "pat_marcus",
        name: "Marcus Chen",
        dob: new Date("1975-09-23"),
        gender: "MALE" as const,
        phone: "+1-555-0102",
        allergies: ["Aspirin"],
        conditions: ["Type 2 Diabetes", "Hyperlipidemia"],
      },
      {
        id: "pat_elena",
        name: "Elena Rostova",
        dob: new Date("1995-11-05"),
        gender: "FEMALE" as const,
        phone: "+1-555-0103",
        allergies: ["Latex", "Amoxicillin"],
        conditions: ["Eczema"],
      },
      {
        id: "pat_david",
        name: "David Kim",
        dob: new Date("1962-02-18"),
        gender: "MALE" as const,
        phone: "+1-555-0104",
        allergies: [],
        conditions: ["Coronary Artery Disease", "Gout"],
      },
      {
        id: "pat_priya",
        name: "Priya Patel",
        dob: new Date("2001-07-30"),
        gender: "FEMALE" as const,
        phone: "+1-555-0105",
        allergies: ["Peanuts"],
        conditions: ["Allergic Rhinitis"],
      },
      {
        id: "pat_james",
        name: "James Wilson",
        dob: new Date("1982-12-14"),
        gender: "MALE" as const,
        phone: "+1-555-0106",
        allergies: ["Codeine"],
        conditions: ["Chronic Migraine"],
      },
    ];

    for (const p of patients) {
      await tx.patient.upsert({
        where: { id: p.id },
        update: p,
        create: p,
      });
    }

    // 3. Appointments
    const appointments = [
      {
        id: "appt_today_1",
        patientId: "pat_asha",
        doctorId: "doc_default",
        scheduledAt: todayMorning,
        reason: "Persistent dry cough for 2 weeks and chest tightness",
        status: "COMPLETED" as const,
      },
      {
        id: "appt_today_2",
        patientId: "pat_marcus",
        doctorId: "doc_default",
        scheduledAt: today930,
        reason: "Routine diabetes checkup & fasting glucose review",
        status: "IN_CONSULTATION" as const,
      },
      {
        id: "appt_today_3",
        patientId: "pat_elena",
        doctorId: "doc_default",
        scheduledAt: today1015,
        reason: "Acute flare-up of rash on arms with itching",
        status: "WAITING" as const,
      },
      {
        id: "appt_today_4",
        patientId: "pat_david",
        doctorId: "doc_default",
        scheduledAt: today1100,
        reason: "Follow-up on blood pressure medications and joint pain",
        status: "WAITING" as const,
      },
      {
        id: "appt_tomorrow_1",
        patientId: "pat_priya",
        doctorId: "doc_default",
        scheduledAt: tomorrow1000,
        reason: "Seasonal allergy consultation and inhaler review",
        status: "WAITING" as const,
      },
    ];

    for (const appt of appointments) {
      await tx.appointment.upsert({
        where: { id: appt.id },
        update: appt,
        create: appt,
      });
    }

    // 4. Consultations (prior consultations per patient + today's completed appointment)
    const consultations = [
      // Today's completed consultation for Asha
      {
        id: "cons_today_asha",
        patientId: "pat_asha",
        doctorId: "doc_default",
        appointmentId: "appt_today_1",
        clientRequestId: "req_seed_today_asha_001",
        createdAt: todayMorning,
        rawNotes: "Asha here for 2 wk dry cough, worse at night. Wheezing noted. Peak flow 320 (baseline 380). Uses albuterol prn. No fever. Denies sore throat. Started cetirizine last week no effect. Increase inhaled corticosteroid.",
        aiDraft: {
          chiefComplaint: "Persistent dry cough for 2 weeks",
          symptoms: ["dry cough worse at night", "wheezing"],
          relevantHistory: ["Asthma baseline peak flow 380"],
          medicationsMentioned: ["albuterol", "cetirizine"],
          doctorPlan: ["Increase inhaled corticosteroid", "continue albuterol PRN"],
          missingInformation: ["temperature", "blood pressure", "sputum production"],
        },
        finalNote: {
          chiefComplaint: "Persistent dry cough for 2 weeks with nocturnal worsening",
          symptoms: ["dry cough worse at night", "wheezing", "chest tightness"],
          relevantHistory: ["Asthma baseline peak flow 380", "current peak flow 320"],
          medicationsMentioned: ["albuterol inhaler", "cetirizine 10mg"],
          doctorPlan: [
            "Increase inhaled corticosteroid (Budesonide 200mcg twice daily)",
            "continue albuterol PRN before exercise or as rescue",
            "Return in 2 weeks if peak flow does not recover above 350",
          ],
          missingInformation: ["temperature", "blood pressure"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 910,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // Asha prior 1
      {
        id: "cons_asha_prior_1",
        patientId: "pat_asha",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_asha_prior_1",
        createdAt: monthsAgo(3),
        rawNotes: "Mild asthma flare triggered by cold weather. Lungs clear today. BP 124/80. Pulse 72. Refilled albuterol.",
        aiDraft: {
          chiefComplaint: "Mild asthma flare",
          symptoms: ["asthma flare triggered by cold weather"],
          relevantHistory: [],
          medicationsMentioned: ["albuterol"],
          doctorPlan: ["refill albuterol"],
          missingInformation: ["peak flow reading", "allergy review"],
        },
        finalNote: {
          chiefComplaint: "Mild asthma exacerbation secondary to cold weather",
          symptoms: ["asthma flare triggered by cold weather"],
          relevantHistory: ["Lungs clear on auscultation today"],
          medicationsMentioned: ["albuterol HFA 90mcg"],
          doctorPlan: ["Refilled albuterol HFA 90mcg 2 puffs q4-6h prn", "Advised wearing scarf over mouth in cold"],
          missingInformation: ["peak flow reading"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 820,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // Asha prior 2
      {
        id: "cons_asha_prior_2",
        patientId: "pat_asha",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_asha_prior_2",
        createdAt: monthsAgo(8),
        rawNotes: "Annual asthma action plan review. Doing well. Peak flow 390. Reminded to avoid penicillin and sulfa.",
        aiDraft: {
          chiefComplaint: "Annual asthma review",
          symptoms: [],
          relevantHistory: ["doing well"],
          medicationsMentioned: [],
          doctorPlan: ["avoid penicillin and sulfa"],
          missingInformation: ["vitals", "current maintenance meds"],
        },
        finalNote: {
          chiefComplaint: "Annual asthma action plan review",
          symptoms: ["asymptomatic"],
          relevantHistory: ["Asthma well controlled", "Peak flow 390 L/min"],
          medicationsMentioned: ["albuterol"],
          doctorPlan: ["Continue current asthma action plan", "Reinforced penicillin and sulfa allergy alert"],
          missingInformation: ["blood pressure"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 880,
        wasAiUsed: true,
        wasAiEdited: true,
      },

      // Marcus prior 1
      {
        id: "cons_marcus_prior_1",
        patientId: "pat_marcus",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_marcus_prior_1",
        createdAt: monthsAgo(2),
        rawNotes: "Marcus here for diabetes check. HbA1c 7.1%. Taking metformin 1000mg bid. Complaining of occasional morning dizziness. BP 138/86.",
        aiDraft: {
          chiefComplaint: "Diabetes follow-up",
          symptoms: ["morning dizziness"],
          relevantHistory: ["HbA1c 7.1%"],
          medicationsMentioned: ["metformin 1000mg bid"],
          doctorPlan: ["monitor morning dizziness"],
          missingInformation: ["hypoglycemia log", "weight", "dietary changes"],
        },
        finalNote: {
          chiefComplaint: "Type 2 diabetes follow-up and occasional morning dizziness",
          symptoms: ["occasional morning dizziness"],
          relevantHistory: ["Type 2 Diabetes mellitus", "HbA1c 7.1%"],
          medicationsMentioned: ["metformin 1000mg BID"],
          doctorPlan: [
            "Continue metformin 1000mg BID with meals",
            "Maintain home blood glucose log 3x weekly",
            "Repeat lipid panel and microalbumin in 3 months",
          ],
          missingInformation: ["home glucose readings", "weight"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 750,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // Marcus prior 2
      {
        id: "cons_marcus_prior_2",
        patientId: "pat_marcus",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_marcus_prior_2",
        createdAt: monthsAgo(6),
        rawNotes: "Lipid panel review. LDL 142. Started atorvastatin 20mg daily. Reminded no aspirin due to confirmed allergy.",
        aiDraft: {
          chiefComplaint: "Hyperlipidemia review",
          symptoms: [],
          relevantHistory: ["LDL 142"],
          medicationsMentioned: ["atorvastatin 20mg"],
          doctorPlan: ["start atorvastatin 20mg daily", "no aspirin"],
          missingInformation: ["LFT baseline", "muscle pain inquiry"],
        },
        finalNote: {
          chiefComplaint: "Hyperlipidemia management follow-up",
          symptoms: ["denies myalgias"],
          relevantHistory: ["Elevated LDL at 142 mg/dL", "Documented aspirin allergy"],
          medicationsMentioned: ["atorvastatin 20mg daily"],
          doctorPlan: [
            "Initiated atorvastatin 20mg orally once daily at bedtime",
            "Counsel on reporting any unexplained muscle pain or weakness",
            "Reinforced aspirin allergy documentation",
          ],
          missingInformation: ["baseline liver function tests"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 790,
        wasAiUsed: true,
        wasAiEdited: true,
      },

      // Elena prior 1
      {
        id: "cons_elena_prior_1",
        patientId: "pat_elena",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_elena_prior_1",
        createdAt: monthsAgo(4),
        rawNotes: "Eczema flare on flexor surfaces of elbows. Erythema and scaling. Itching disrupts sleep. Triamcinolone 0.1% ointment prescribed.",
        aiDraft: {
          chiefComplaint: "Eczema flare",
          symptoms: ["itching disrupts sleep", "erythema", "scaling on elbows"],
          relevantHistory: ["eczema"],
          medicationsMentioned: ["Triamcinolone 0.1% ointment"],
          doctorPlan: ["prescribe Triamcinolone 0.1% ointment"],
          missingInformation: ["trigger identification", "skin infection signs"],
        },
        finalNote: {
          chiefComplaint: "Acute eczema flare on bilateral antecubital fossae",
          symptoms: ["severe pruritus disrupting sleep", "erythema", "lichenified scaling on elbows"],
          relevantHistory: ["Chronic atopic dermatitis"],
          medicationsMentioned: ["triamcinolone acetonide 0.1% ointment"],
          doctorPlan: [
            "Triamcinolone 0.1% ointment apply sparingly BID for 7 days then taper",
            "Liberal application of fragrance-free emollient cream post-bathing",
            "Hydroxyzine 25mg at bedtime PRN severe itching",
          ],
          missingInformation: ["recent skin exposure triggers"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 830,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // Elena prior 2
      {
        id: "cons_elena_prior_2",
        patientId: "pat_elena",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_elena_prior_2",
        createdAt: monthsAgo(10),
        rawNotes: "Dental infection antibiotic consultation. Dentist suggested amoxicillin but patient carries allergy badge. Prescribed clindamycin 300mg qid x 7d.",
        aiDraft: {
          chiefComplaint: "Dental infection antibiotic selection",
          symptoms: ["dental infection"],
          relevantHistory: ["amoxicillin allergy"],
          medicationsMentioned: ["clindamycin 300mg", "amoxicillin"],
          doctorPlan: ["prescribe clindamycin 300mg qid x 7d"],
          missingInformation: ["temperature", "swelling severity"],
        },
        finalNote: {
          chiefComplaint: "Antibiotic clearance for odontogenic infection in penicillin-allergic patient",
          symptoms: ["localized toothache and gum tenderness"],
          relevantHistory: ["Documented severe rash with amoxicillin / penicillin cross-reactivity"],
          medicationsMentioned: ["clindamycin 300mg"],
          doctorPlan: [
            "Clindamycin 300mg orally QID for 7 days",
            "Advised to report rash or persistent diarrhea immediately",
            "Follow-up with endodontist within 5 days",
          ],
          missingInformation: ["temperature", "facial swelling extent"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 910,
        wasAiUsed: true,
        wasAiEdited: true,
      },

      // David prior 1
      {
        id: "cons_david_prior_1",
        patientId: "pat_david",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_david_prior_1",
        createdAt: monthsAgo(3),
        rawNotes: "Right 1st MTP joint red hot swollen. Classic podagra flare. Uric acid 8.4. Colchicine 0.6mg prescribed. Hold allopurinol adjustment until flare subsides.",
        aiDraft: {
          chiefComplaint: "Right toe joint pain and swelling",
          symptoms: ["right 1st MTP joint red hot swollen"],
          relevantHistory: ["podagra", "uric acid 8.4"],
          medicationsMentioned: ["Colchicine 0.6mg", "allopurinol"],
          doctorPlan: ["prescribe Colchicine 0.6mg", "hold allopurinol adjustment"],
          missingInformation: ["renal function", "dietary intake"],
        },
        finalNote: {
          chiefComplaint: "Acute gouty arthritis flare of right first metatarsophalangeal joint",
          symptoms: ["erythema, warmth, and marked swelling of right 1st MTP joint", "exquisite tenderness"],
          relevantHistory: ["Recurrent gout", "Serum uric acid 8.4 mg/dL", "Coronary artery disease"],
          medicationsMentioned: ["colchicine 0.6mg", "allopurinol 100mg"],
          doctorPlan: [
            "Colchicine 1.2mg stat, then 0.6mg one hour later, then 0.6mg daily until resolved",
            "Avoid NSAIDs given coronary artery disease history",
            "Maintain allopurinol at current 100mg dose until 2 weeks post-flare resolution",
            "Low purine diet and adequate hydration counselled",
          ],
          missingInformation: ["current eGFR / serum creatinine"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 940,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // David prior 2
      {
        id: "cons_david_prior_2",
        patientId: "pat_david",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_david_prior_2",
        createdAt: monthsAgo(7),
        rawNotes: "Cardiology follow up. Echo shows EF 55%. No angina on moderate exertion. Taking carvedilol 12.5mg bid and lisinopril 20mg. BP 132/78.",
        aiDraft: {
          chiefComplaint: "Cardiology follow up",
          symptoms: [],
          relevantHistory: ["EF 55%", "no angina on exertion"],
          medicationsMentioned: ["carvedilol 12.5mg bid", "lisinopril 20mg"],
          doctorPlan: ["continue medications"],
          missingInformation: ["heart rate", "peripheral edema"],
        },
        finalNote: {
          chiefComplaint: "Cardiology outpatient follow-up for CAD",
          symptoms: ["denies exertional chest pressure, dyspnea, or palpitations"],
          relevantHistory: ["Coronary artery disease s/p stent", "Preserved EF 55%"],
          medicationsMentioned: ["carvedilol 12.5mg BID", "lisinopril 20mg daily"],
          doctorPlan: [
            "Continue carvedilol 12.5mg BID and lisinopril 20mg daily",
            "Annual ECG and cardiac review in 6 months",
          ],
          missingInformation: ["resting pulse rate", "lower extremity edema check"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 810,
        wasAiUsed: true,
        wasAiEdited: true,
      },

      // Priya prior 1
      {
        id: "cons_priya_prior_1",
        patientId: "pat_priya",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_priya_prior_1",
        createdAt: monthsAgo(5),
        rawNotes: "Priya presents with spring seasonal allergies. Sneezing fits, clear rhinorrhea, itchy watery eyes. Has EpiPen for peanut allergy. Prescribed fluticasone nasal spray.",
        aiDraft: {
          chiefComplaint: "Seasonal allergies",
          symptoms: ["sneezing", "clear rhinorrhea", "itchy watery eyes"],
          relevantHistory: ["peanut allergy", "EpiPen carrier"],
          medicationsMentioned: ["EpiPen", "fluticasone nasal spray"],
          doctorPlan: ["prescribe fluticasone nasal spray"],
          missingInformation: ["nasal exam", "previous antihistamines tried"],
        },
        finalNote: {
          chiefComplaint: "Seasonal allergic rhinitis exacerbation",
          symptoms: ["paroxysmal sneezing", "profuse clear rhinorrhea", "bilateral ocular pruritus"],
          relevantHistory: ["Severe IgE-mediated peanut anaphylaxis history", "Current unexpired EpiPen carrier"],
          medicationsMentioned: ["fluticasone propionate nasal spray 50mcg", "epinephrine autoinjector"],
          doctorPlan: [
            "Fluticasone propionate 50mcg nasal spray 1 spray per nostril daily",
            "Olopatadine 0.1% ophthalmic drops BID PRN itchy eyes",
            "Verify EpiPen expiration date (confirmed valid)",
          ],
          missingInformation: ["nasal mucosal exam findings"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 760,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // Priya prior 2
      {
        id: "cons_priya_prior_2",
        patientId: "pat_priya",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_priya_prior_2",
        createdAt: monthsAgo(12),
        rawNotes: "Routine college health immunization check and allergy certification letter provided for university dining hall.",
        aiDraft: {
          chiefComplaint: "College immunization and allergy review",
          symptoms: [],
          relevantHistory: ["peanut allergy"],
          medicationsMentioned: [],
          doctorPlan: ["provide dining hall allergy certification letter"],
          missingInformation: ["vitals", "immunization records"],
        },
        finalNote: {
          chiefComplaint: "University entrance medical certification and dietary allergy documentation",
          symptoms: ["asymptomatic"],
          relevantHistory: ["Confirmed anaphylactic peanut allergy"],
          medicationsMentioned: ["epinephrine autoinjector 0.3mg"],
          doctorPlan: [
            "Issued official medical letter for university housing and dining services regarding strict peanut avoidance",
            "Prescribed replacement 2-pack EpiPen 0.3mg autoinjectors",
          ],
          missingInformation: ["meningococcal vaccination date"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 780,
        wasAiUsed: true,
        wasAiEdited: true,
      },

      // James prior 1
      {
        id: "cons_james_prior_1",
        patientId: "pat_james",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_james_prior_1",
        createdAt: monthsAgo(3),
        rawNotes: "Throbbing unilateral left temporal headache, photophobia, nausea. 3 attacks in last month. Sumatriptan 50mg effective. Codeine strictly avoided due to severe vomiting history.",
        aiDraft: {
          chiefComplaint: "Left temporal throbbing headache",
          symptoms: ["left temporal throbbing headache", "photophobia", "nausea"],
          relevantHistory: ["3 attacks last month", "codeine allergy with severe vomiting"],
          medicationsMentioned: ["Sumatriptan 50mg", "codeine"],
          doctorPlan: ["continue Sumatriptan 50mg"],
          missingInformation: ["headache diary", "blood pressure"],
        },
        finalNote: {
          chiefComplaint: "Migraine with aura and autonomic features",
          symptoms: ["pulsating left hemicranial headache", "photophobia", "phonophobia", "mild nausea"],
          relevantHistory: ["Chronic episodic migraine", "Adverse drug reaction / intolerance to codeine"],
          medicationsMentioned: ["sumatriptan 50mg orally at onset"],
          doctorPlan: [
            "Sumatriptan 50mg at onset of aura/headache; may repeat once after 2 hours if needed (max 200mg/24h)",
            "Advised keeping structured headache diary",
            "Consider preventative therapy (propranolol) if attack frequency exceeds 4 days/month",
          ],
          missingInformation: ["blood pressure during headache episode"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 890,
        wasAiUsed: true,
        wasAiEdited: true,
      },
      // James prior 2
      {
        id: "cons_james_prior_2",
        patientId: "pat_james",
        doctorId: "doc_default",
        appointmentId: null,
        clientRequestId: "req_seed_james_prior_2",
        createdAt: monthsAgo(9),
        rawNotes: "Migraine preventative follow-up. Sleep hygiene counseling. Reduced caffeine intake. Stress management discussed.",
        aiDraft: {
          chiefComplaint: "Migraine preventative follow-up",
          symptoms: [],
          relevantHistory: ["chronic migraine"],
          medicationsMentioned: [],
          doctorPlan: ["sleep hygiene", "reduce caffeine", "stress management"],
          missingInformation: ["attack frequency", "current acute medications"],
        },
        finalNote: {
          chiefComplaint: "Lifestyle modification and migraine trigger review",
          symptoms: ["decreased attack severity noted"],
          relevantHistory: ["Migraine trigger: sleep disruption and irregular caffeine"],
          medicationsMentioned: ["sumatriptan 50mg PRN"],
          doctorPlan: [
            "Counselled on consistent sleep schedule (7-8 hours nightly)",
            "Taper caffeine intake to < 100mg daily",
            "Continue sumatriptan for acute rescues only",
          ],
          missingInformation: ["monthly migraine disability assessment score (MIDAS)"],
        },
        aiModel: "gemini-2.5-flash",
        aiLatencyMs: 820,
        wasAiUsed: true,
        wasAiEdited: true,
      },
    ];

    for (const c of consultations) {
      await tx.consultation.upsert({
        where: { id: c.id },
        update: c,
        create: c,
      });
    }
  });

  console.log("Seeding completed successfully!");
}

seed()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

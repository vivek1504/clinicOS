import { Elysia, t } from "elysia";
import { PatientService } from "../services/patient.service";
import { PatientDto, GetPatientsQuery, CreatePatientBody, UpdatePatientBody } from "../schemas/patient";
import { ConsultationDto } from "../schemas/consultation";
import { IdParams, ErrorEnvelope } from "../schemas/common";
import { assertRole, sessionPlugin } from "../auth";

export const patientRoutes = new Elysia({ prefix: "/patients" })
  .use(sessionPlugin)
  .decorate("patientService", new PatientService())
  .get("", async ({ query, patientService }) => patientService.listPatients(query.q), {
    query: GetPatientsQuery,
    response: { 200: t.Array(PatientDto) },
  })
  .post(
    "",
    async ({ body, set, patientService }) => {
      set.status = 201;
      return await patientService.create(body);
    },
    { body: CreatePatientBody, response: { 201: PatientDto, 400: ErrorEnvelope, 409: ErrorEnvelope } }
  )
  .get("/:id", async ({ params, patientService }) => patientService.getPatientById(params.id), {
    params: IdParams,
    response: { 200: PatientDto, 404: ErrorEnvelope },
  })
  .patch("/:id", async ({ params, body, patientService }) => patientService.update(params.id, body), {
    params: IdParams,
    body: UpdatePatientBody,
    response: { 200: PatientDto, 400: ErrorEnvelope, 404: ErrorEnvelope },
  })
  .get(
    "/:id/consultations",
    async ({ params, patientService }) => patientService.getConsultationsByPatientId(params.id),
    {
      // Clinical history is for doctors only; the rest of this group is shared with the front desk.
      beforeHandle: ({ doctor }) => assertRole(doctor, "DOCTOR"),
      params: IdParams,
      response: { 200: t.Array(ConsultationDto), 403: ErrorEnvelope, 404: ErrorEnvelope },
    }
  );

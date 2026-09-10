import { Elysia, t } from "elysia";
import { PatientService } from "../services/patient.service";
import { PatientDto, GetPatientsQuery } from "../schemas/patient";
import { ConsultationDto } from "../schemas/consultation";
import { IdParams, ErrorEnvelope } from "../schemas/common";

export const patientRoutes = new Elysia({ prefix: "/patients" })
  .decorate("patientService", new PatientService())
  .get(
    "",
    async ({ query, patientService }) => {
      return await patientService.listPatients(query.q);
    },
    {
      query: GetPatientsQuery,
      response: {
        200: t.Array(PatientDto),
      },
    }
  )
  .get(
    "/:id",
    async ({ params, patientService }) => {
      return await patientService.getPatientById(params.id);
    },
    {
      params: IdParams,
      response: {
        200: PatientDto,
        404: ErrorEnvelope,
      },
    }
  )
  .get(
    "/:id/consultations",
    async ({ params, patientService }) => {
      return await patientService.getConsultationsByPatientId(params.id);
    },
    {
      params: IdParams,
      response: {
        200: t.Array(ConsultationDto),
        404: ErrorEnvelope,
      },
    }
  );

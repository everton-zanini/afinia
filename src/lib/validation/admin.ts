import { z } from "zod";

export const TEMP_PASSWORD_MIN = 10;

export const participantSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80, "Use até 80 caracteres"),
  email: z.email("Informe um email válido").trim().toLowerCase(),
  password: z
    .string()
    .min(TEMP_PASSWORD_MIN, `A senha temporária deve ter pelo menos ${TEMP_PASSWORD_MIN} caracteres`)
    .max(128),
});
export type ParticipantInput = z.infer<typeof participantSchema>;

export const createHouseholdSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do casal").max(80, "Use até 80 caracteres"),
    includeMe: z.boolean(),
    participants: z.array(participantSchema).max(2),
  })
  .refine((d) => d.participants.length + (d.includeMe ? 1 : 0) >= 1, {
    path: ["participants"],
    message: "Informe pelo menos um participante",
  })
  .refine((d) => d.participants.length + (d.includeMe ? 1 : 0) <= 2, {
    path: ["participants"],
    message: "Um casal tem no máximo dois participantes",
  })
  .refine(
    (d) => new Set(d.participants.map((p) => p.email)).size === d.participants.length,
    { path: ["participants"], message: "Os participantes precisam ter emails diferentes" },
  );
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const resetPasswordSchema = z.object({
  password: participantSchema.shape.password,
});

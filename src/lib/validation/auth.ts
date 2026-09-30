import { z } from "zod";

export const PASSWORD_MIN = 8;

export const loginSchema = z.object({
  email: z.email("Informe um email válido").trim().toLowerCase(),
  password: z.string().min(1, "Informe a senha"),
});

export const nameSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(80, "Use até 80 caracteres"),
});

export const emailChangeSchema = z.object({
  email: z.email("Informe um email válido").trim().toLowerCase(),
  currentPassword: z.string().min(1, "Informe sua senha atual"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual"),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `A nova senha deve ter pelo menos ${PASSWORD_MIN} caracteres`)
      .max(128, "Use até 128 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da atual",
  });

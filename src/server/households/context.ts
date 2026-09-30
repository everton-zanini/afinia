import { db } from "@/server/db";

export type HouseholdMemberInfo = { memberId: string; userId: string; name: string };

/** Contexto de tenant. Sempre derivado da sessão — nunca de dados enviados pelo navegador. */
export type HouseholdContext = {
  householdId: string;
  householdName: string;
  userId: string;
  memberId: string;
  members: HouseholdMemberInfo[];
};

export async function getHouseholdContext(userId: string): Promise<HouseholdContext | null> {
  const membership = await db.householdMember.findUnique({
    where: { userId },
    select: {
      id: true,
      active: true,
      household: {
        select: {
          id: true,
          name: true,
          active: true,
          members: {
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, userId: true, user: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!membership?.active || !membership.household.active) return null;
  const h = membership.household;
  return {
    householdId: h.id,
    householdName: h.name,
    userId,
    memberId: membership.id,
    members: h.members.map((m) => ({ memberId: m.id, userId: m.userId, name: m.user.name })),
  };
}

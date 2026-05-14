import type { MutationContext } from "@/application/security/types";
import type { Prisma } from "@generated/prisma/client";
import { AuditSeverity } from "@generated/prisma/enums";

export type AuditEventInput = {
  tenantId: string;
  context: MutationContext;
  action: string;
  targetType: string;
  targetId?: string | null;
  severity?: AuditSeverity;
  metadata?: Prisma.InputJsonObject;
};

export function recordAuditEvent(
  tx: Prisma.TransactionClient,
  input: AuditEventInput,
) {
  return tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.context.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      severity: input.severity ?? AuditSeverity.INFO,
      ipAddress: input.context.ipAddress ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    select: {
      id: true,
    },
  });
}

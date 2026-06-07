import type { OperationsRepository } from "@/application/operations/use-cases";
import { getOperationsBackupSnapshot } from "@/infrastructure/prisma/operations/backup";
import { validateOperationsImportCandidate } from "@/infrastructure/prisma/operations/import-validation";
import { getOperationsSnapshot } from "@/infrastructure/prisma/operations/snapshot";
import { updateTenantProfile } from "@/infrastructure/prisma/operations/tenant-profile";

export {
  getOperationsBackupSnapshot,
  getOperationsSnapshot,
  updateTenantProfile,
  validateOperationsImportCandidate,
};

export const prismaOperationsRepository = {
  getOperationsBackupSnapshot,
  getOperationsSnapshot,
  updateTenantProfile,
  validateOperationsImportCandidate,
} satisfies OperationsRepository;

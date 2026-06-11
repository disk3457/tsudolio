import type { OperationsRepository } from "@/application/operations/use-cases";
import { getOperationsBackupSnapshot } from "@/infrastructure/prisma/operations/backup";
import {
  previewOperationsRestore,
  validateOperationsImportCandidate,
} from "@/infrastructure/prisma/operations/import-validation";
import { getOperationsSnapshot } from "@/infrastructure/prisma/operations/snapshot";
import { updateTenantProfile } from "@/infrastructure/prisma/operations/tenant-profile";

export {
  getOperationsBackupSnapshot,
  getOperationsSnapshot,
  previewOperationsRestore,
  updateTenantProfile,
  validateOperationsImportCandidate,
};

export const prismaOperationsRepository = {
  getOperationsBackupSnapshot,
  getOperationsSnapshot,
  previewOperationsRestore,
  updateTenantProfile,
  validateOperationsImportCandidate,
} satisfies OperationsRepository;

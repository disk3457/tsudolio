import type { OrganizationRepository } from "@/application/organization/use-cases";
import {
  createOrganizationUnit,
  deleteOrganizationUnit,
  updateOrganizationUnit,
} from "@/infrastructure/prisma/organization/organization-units";
import { getOrganizationSnapshot } from "@/infrastructure/prisma/organization/queries";
import {
  createUser,
  deleteOrSuspendUser,
  updateUser,
} from "@/infrastructure/prisma/organization/users";

export {
  createOrganizationUnit,
  createUser,
  deleteOrganizationUnit,
  deleteOrSuspendUser,
  getOrganizationSnapshot,
  updateOrganizationUnit,
  updateUser,
};

export const prismaOrganizationRepository = {
  getOrganizationSnapshot,
  createOrganizationUnit,
  updateOrganizationUnit,
  deleteOrganizationUnit,
  createUser,
  updateUser,
  deleteOrSuspendUser,
} satisfies OrganizationRepository;

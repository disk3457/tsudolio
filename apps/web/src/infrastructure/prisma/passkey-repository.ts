import {
  createPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} from "@/infrastructure/prisma/passkeys/authentication";
import { listPasskeys } from "@/infrastructure/prisma/passkeys/list";
import {
  deletePasskey,
  updatePasskey,
} from "@/infrastructure/prisma/passkeys/management";
import {
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "@/infrastructure/prisma/passkeys/registration";
import {
  createPasskeyStepUpOptions,
  verifyPasskeyStepUp,
} from "@/infrastructure/prisma/passkeys/step-up";

export const prismaPasskeyRepository = {
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  createPasskeyStepUpOptions,
  deletePasskey,
  listPasskeys,
  updatePasskey,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
  verifyPasskeyStepUp,
};

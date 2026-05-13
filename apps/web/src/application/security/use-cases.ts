import type {
  CurrentUserContext,
  CurrentUserLookup,
} from "@/application/security/types";
import { toCurrentUserSession } from "@/application/security/permissions";

export type CurrentUserRepository = {
  resolveCurrentUser: (
    lookup: CurrentUserLookup,
  ) => Promise<CurrentUserContext>;
};

export function createSecurityUseCases(repository: CurrentUserRepository) {
  return {
    async getCurrentUserSession(lookup: CurrentUserLookup) {
      const currentUser = await repository.resolveCurrentUser(lookup);

      return toCurrentUserSession(currentUser);
    },
  };
}


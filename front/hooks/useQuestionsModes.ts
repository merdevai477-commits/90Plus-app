import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';

import type { Language } from '../src/i18n';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import {
  QuestionsModesService,
  type QuestionsModesResult,
} from '../services/questionsModes';

export function useQuestionsModes(language: Language) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  return useQuery<QuestionsModesResult>({
    queryKey: ['questions-modes', language],
    queryFn: async () => {
      const token = await getClerkBearerToken(getToken);
      if (!token) {
        throw new Error('AUTH_REQUIRED');
      }
      return QuestionsModesService.getModes(token, language);
    },
    enabled: isLoaded === true && isSignedIn === true,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        return false;
      }
      return failureCount < 1;
    },
  });
}

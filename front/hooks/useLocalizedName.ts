import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';

/** Player or team label in the app language. Re-renders when Arabic names arrive. */
export function useLocalizedName(name: string | null | undefined): string {
  const { language } = useTranslation();
  return getTeamDisplayName(name, language);
}

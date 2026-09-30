import { useThemePreference } from '@/features/profile/profile.queries';
import { useApplyThemePreference } from '@/shared/theme';

/** UX-23: applies the stored theme (read during startup, see `StartupGate`) and every later change. */
export function ThemePreferenceSync() {
  useApplyThemePreference(useThemePreference().data);
  return null;
}

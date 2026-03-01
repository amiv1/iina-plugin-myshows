/**
 * Minimal i18n module.
 *
 * Detects whether the system locale is Russian and exposes a `t()` helper
 * that returns the appropriate translation. Only English and Russian are
 * supported; all other locales fall back to English.
 */

const isRussian = Intl.DateTimeFormat().resolvedOptions().locale.startsWith("ru");

const translations = {
    en: {
        markedAsWatched:    "✓ Marked as watched in MyShows",
        failedToMark:       "⚠ Failed to mark episode as watched in MyShows",
        authFailed:         "⚠ MyShows: authentication failed",
        authError:          "⚠ MyShows: authentication error",
    },
    ru: {
        markedAsWatched:    "✓ Отмечено как просмотренное в MyShows",
        failedToMark:       "⚠ Не удалось отметить эпизод как просмотренный в MyShows",
        authFailed:         "⚠ MyShows: ошибка аутентификации",
        authError:          "⚠ MyShows: ошибка аутентификации",
    },
} as const;

type TranslationKey = keyof typeof translations.en;

/** Returns the translated string for the current system locale. */
export function t(key: TranslationKey): string {
    return (isRussian ? translations.ru : translations.en)[key];
}

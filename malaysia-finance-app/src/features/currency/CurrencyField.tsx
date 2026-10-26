import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { CURRENCIES, HOME_CURRENCY, rateToInput } from '@/domain/fx';
import { formatRM, type Sen } from '@/domain/money';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { TextField } from '@/features/wealth/TextField';

export type CurrencyChoice = {
  /** MYR, or the code of the currency the spending was paid in. */
  code: string;
  /** Ringgit per 1 unit, as typed. */
  rateText: string;
  /** The person typed or changed the rate, so a refreshed live rate does not replace it. */
  manual: boolean;
};

export const RINGGIT: CurrencyChoice = { code: HOME_CURRENCY, rateText: '', manual: false };

function ago(ms: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 60) return t('fx.justNow');
  const hours = Math.round(minutes / 60);
  return hours < 48 ? t('fx.hoursAgo', { count: hours }) : t('fx.daysAgo', { count: Math.round(hours / 24) });
}

type Props = {
  value: CurrencyChoice;
  onChange: (next: CurrencyChoice) => void;
  /** What was typed in the foreign currency, to show what it counts as in ringgit. */
  ringgit: Sen | null;
};

/** Pick the currency something was paid in; for a foreign one the live rate fills in, and can be overridden. */
export function CurrencyField({ value, onChange, ringgit }: Props) {
  const foreign = value.code !== HOME_CURRENCY;
  const { rates, status, refresh } = useExchangeRates(foreign);
  const live = foreign ? rates?.perUnit[value.code] : undefined;

  // Fill the rate from the live (or saved) one unless the person has set their own.
  useEffect(() => {
    if (!foreign || value.manual || live === undefined) return;
    const text = rateToInput(live);
    if (text !== value.rateText) onChange({ ...value, rateText: text });
  }, [foreign, live, value, onChange]);

  const statusText =
    status === 'loading' ? t('fx.loading')
    : status === 'live' && rates ? t('fx.live', { when: ago(rates.fetchedAt) })
    : status === 'saved' && rates ? t('fx.saved', { when: ago(rates.fetchedAt) })
    : t('fx.none');

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="eyebrow" tone="muted">{t('fx.field')}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingRight: 16 }} keyboardShouldPersistTaps="handled">
        {[HOME_CURRENCY, ...CURRENCIES.map((c) => c.code)].map((code) => (
          <Chip
            compact
            key={code}
            label={code}
            selected={value.code === code}
            onPress={() => onChange(code === HOME_CURRENCY ? RINGGIT : { code, rateText: '', manual: false })}
          />
        ))}
      </ScrollView>
      {foreign ? (
        <View style={{ gap: 8 }}>
          <TextField
            label={t('fx.rate', { code: value.code })}
            value={value.rateText}
            numeric
            decimals={6}
            onChange={(text) => onChange({ ...value, rateText: text, manual: true })}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AppText variant="small" tone="muted" style={{ flexShrink: 1 }}>{statusText}</AppText>
            {status !== 'loading' ? (
              <Chip compact icon="refresh" label={t('fx.refresh')} onPress={() => { onChange({ ...value, manual: false }); void refresh(); }} />
            ) : null}
          </View>
          {ringgit !== null ? (
            <AppText variant="bodyStrong" testID="fx-counts">{t('fx.counts', { amount: formatRM(ringgit) })}</AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

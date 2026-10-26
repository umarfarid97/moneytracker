import { useEffect } from 'react';
import { View } from 'react-native';
import { CURRENCIES, HOME_CURRENCY, rateToInput } from '@/domain/fx';
import { formatRM, type Sen } from '@/domain/money';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Chip';
import { TextField } from '@/features/wealth/TextField';
import { Sheet } from '@/ui/Sheet';

export type CurrencyChoice = {
  /** MYR, or the code of the currency the spending was paid in. */
  code: string;
  /** Ringgit per 1 unit, as typed. */
  rateText: string;
  /** The person typed or changed the rate, so a refreshed live rate does not replace it. */
  manual: boolean;
};

export const RINGGIT: CurrencyChoice = { code: HOME_CURRENCY, rateText: '', manual: false };

/** A fresh choice of currency: the rate fills in from the live (or saved) one. */
export function choiceFor(code: string): CurrencyChoice {
  return code === HOME_CURRENCY ? RINGGIT : { code, rateText: '', manual: false };
}

type PickerProps = {
  visible: boolean;
  value: string;
  onPick: (code: string) => void;
  onClose: () => void;
};

/** Pop-up list of currencies, opened by tapping the currency tag on an amount. */
export function CurrencyPickerSheet({ visible, value, onPick, onClose }: PickerProps) {
  return (
    <Sheet visible={visible} title={t('fx.field')} onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[HOME_CURRENCY, ...CURRENCIES.map((c) => c.code)].map((code) => (
          <Chip key={code} label={code} selected={value === code} onPress={() => { onPick(code); onClose(); }} />
        ))}
      </View>
    </Sheet>
  );
}

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

/** For a foreign currency: the rate (live or saved, and can be overridden) and what the amount counts as in ringgit. Nothing for ringgit. */
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

  if (!foreign) return null;
  return (
    <View style={{ gap: 8 }}>
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
    </View>
  );
}

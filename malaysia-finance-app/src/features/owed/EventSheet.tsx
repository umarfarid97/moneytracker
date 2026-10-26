import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { signOf, type EventBalance, type OwedEntry } from '@/domain/owed';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { PressableScale } from '@/ui/PressableScale';
import { Sheet } from '@/ui/Sheet';
import { balanceText } from './PersonSheet';

type Props = {
  event: EventBalance;
  onClose: () => void;
  onSettle: () => void;
  onAdd: () => void;
  onEdit: (entry: OwedEntry) => void;
};

/** One event: what each person owes for it, and every entry behind that. */
export function EventSheet({ event, onClose, onSettle, onAdd, onEdit }: Props) {
  const name = event.event || t('owed.noEvent');
  return (
    <Sheet visible title={name} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <AppText testID="event-balance" variant="bodyStrong">{balanceText(event.balance)}</AppText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title={t('owed.settleEvent')}
              accessibilityLabel={t('owed.settleEventLabel', { name })}
              disabled={event.balance === 0 && event.people.every((p) => p.balance === 0)}
              onPress={onSettle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('owed.addToEvent')} variant="secondary" onPress={onAdd} />
          </View>
        </View>
        {event.people.map((p) => (
          <View key={p.person} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{p.person}</AppText>
              <AppText variant="small" tone="muted">{balanceText(p.balance)}</AppText>
            </View>
            {p.balance !== 0 ? (
              <AppText variant="bodyStrong" tone={p.balance > 0 ? 'positive' : 'negative'}>{formatRM(Math.abs(p.balance))}</AppText>
            ) : null}
          </View>
        ))}
        <AppText variant="eyebrow" tone="muted">{t('owed.history')}</AppText>
        {event.entries.map((e) => (
          <PressableScale
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${e.person}, ${t(`owed.kind.${e.kind}`)} ${formatRM(e.amount)}`}
            onPress={() => onEdit(e)}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{e.person} · {t(`owed.kind.${e.kind}`)}</AppText>
              <AppText variant="small" tone="muted">{shortDate(e.date)}{e.note ? ` · ${e.note}` : ''}</AppText>
            </View>
            <AppText variant="bodyStrong" tone={signOf(e.kind) > 0 ? 'positive' : 'negative'}>
              {signOf(e.kind) > 0 ? '+' : '-'}{formatRM(e.amount)}
            </AppText>
          </PressableScale>
        ))}
      </View>
    </Sheet>
  );
}

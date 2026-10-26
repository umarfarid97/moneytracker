import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { signOf, type EventSummary, type OwedEntry, type PersonBalance } from '@/domain/owed';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { PressableScale } from '@/ui/PressableScale';
import { Sheet } from '@/ui/Sheet';
import { balanceText } from './PersonSheet';

type Props = {
  summary: EventSummary;
  onClose: () => void;
  onAdd: () => void;
  onSplit: () => void;
  onSettle: (person: PersonBalance) => void;
  onEdit: (entry: OwedEntry) => void;
};

export const eventTitle = (event: string) => event || t('owed.noEvent');

/** One event: who owes what within it, with a Settle button per person, and every entry behind it. */
export function EventSheet({ summary, onClose, onAdd, onSplit, onSettle, onEdit }: Props) {
  const title = eventTitle(summary.event);
  return (
    <Sheet visible title={title} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="small" tone="muted">{t('owed.owedToMe')}</AppText>
            <AppText testID="event-owed" variant="bodyStrong" tone="positive">{formatRM(summary.owedToMe)}</AppText>
          </View>
          {summary.iOwe > 0 ? (
            <View style={{ flex: 1 }}>
              <AppText variant="small" tone="muted">{t('owed.iOwe')}</AppText>
              <AppText variant="bodyStrong" tone="negative">{formatRM(summary.iOwe)}</AppText>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('owed.addToEvent', { event: title })} onPress={onAdd} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('owed.splitHere')} variant="secondary" onPress={onSplit} />
          </View>
        </View>

        <AppText variant="eyebrow" tone="muted">{t('owed.whoOwesWhat')}</AppText>
        {summary.people.map((p) => (
          <View key={p.person} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{p.person}</AppText>
              <AppText variant="small" tone="muted">{balanceText(p.balance)}</AppText>
            </View>
            {p.balance !== 0 ? (
              <Chip
                compact
                label={t('owed.settleOne')}
                accessibilityLabel={t('owed.settleEventLabel', { name: p.person, event: title })}
                onPress={() => onSettle(p)}
              />
            ) : null}
          </View>
        ))}

        <AppText variant="eyebrow" tone="muted">{t('owed.history')}</AppText>
        {summary.entries.map((e) => (
          <PressableScale
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${e.person} ${t(`owed.kind.${e.kind}`)} ${formatRM(e.amount)}`}
            onPress={() => onEdit(e)}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{e.person}: {t(`owed.kind.${e.kind}`)}</AppText>
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

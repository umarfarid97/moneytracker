import { View } from 'react-native';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { signOf, type OwedEntry, type PersonBalance } from '@/domain/owed';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { PressableScale } from '@/ui/PressableScale';
import { Sheet } from '@/ui/Sheet';

type Props = {
  person: PersonBalance;
  onClose: () => void;
  onSettle: () => void;
  onAdd: () => void;
  onEdit: (entry: OwedEntry) => void;
};

export function balanceText(balance: number): string {
  return balance > 0 ? t('owed.theyOwe', { amount: formatRM(balance) })
    : balance < 0 ? t('owed.youOwe', { amount: formatRM(-balance) })
    : t('owed.settled');
}

/** One person's balance and every entry behind it. */
export function PersonSheet({ person, onClose, onSettle, onAdd, onEdit }: Props) {
  return (
    <Sheet visible title={person.person} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <AppText testID="person-balance" variant="bodyStrong">{balanceText(person.balance)}</AppText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title={t('owed.settleUp')}
              accessibilityLabel={t('owed.settleLabel', { name: person.person })}
              disabled={person.balance === 0}
              onPress={onSettle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('owed.addFor', { name: person.person })} variant="secondary" onPress={onAdd} />
          </View>
        </View>
        <AppText variant="eyebrow" tone="muted">{t('owed.history')}</AppText>
        {person.entries.map((e) => (
          <PressableScale
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${t(`owed.kind.${e.kind}`)} ${formatRM(e.amount)}`}
            onPress={() => onEdit(e)}
            pressedScale={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{t(`owed.kind.${e.kind}`)}</AppText>
              <AppText variant="small" tone="muted">{shortDate(e.date)}{e.event ? ` · ${e.event}` : ''}{e.note ? ` · ${e.note}` : ''}</AppText>
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

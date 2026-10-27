import { View } from 'react-native';
import type { BalanceLeft } from '@/domain/balance';
import { brandForBill } from '@/domain/brandLookup';
import { shortDate } from '@/domain/dates';
import { formatRM } from '@/domain/money';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { BrandBadge } from '@/ui/BrandBadge';
import { Sheet } from '@/ui/Sheet';
import { useTheme } from '@/ui/useTheme';

type Props = {
  visible: boolean;
  balance: BalanceLeft;
  today: string;
  /** Amounts show as RM •••• while the balance is hidden. */
  hidden: boolean;
  onClose: () => void;
};

/** The unpaid bills and loan instalments behind "RM X in bills still to pay", with how the numbers add up. */
export function BillsLeftSheet({ visible, balance, today, hidden, onClose }: Props) {
  const { c } = useTheme();
  const money = (sen: number) => (hidden ? 'RM ••••' : sen < 0 ? `-${formatRM(-sen)}` : formatRM(sen));
  return (
    <Sheet visible={visible} title={t('billsLeft.title')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        {balance.upcomingItems.length === 0 ? (
          <AppText variant="body" tone="muted">{t('billsLeft.empty')}</AppText>
        ) : (
          <View style={{ gap: 12 }}>
            {balance.upcomingItems.map((b) => (
              <View key={`${b.commitmentId}-${b.dueDate}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                {brandForBill(b.name) ? <BrandBadge {...brandForBill(b.name)!} size={32} /> : null}
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{b.name}</AppText>
                  <AppText variant="small" tone={b.dueDate < today ? 'negative' : 'muted'}>
                    {t(b.dueDate < today ? 'billsLeft.overdue' : 'billsLeft.due', { date: shortDate(b.dueDate) })}
                    {b.variable ? ` · ${t('billsLeft.estimate')}` : ''}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{money(b.amount)}</AppText>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="bodyStrong">{t('billsLeft.total')}</AppText>
              <AppText variant="bodyStrong">{money(balance.upcoming)}</AppText>
            </View>
          </View>
        )}
        <View style={{ gap: 6 }}>
          <AppText variant="smallStrong">{t('billsLeft.explainTitle')}</AppText>
          <AppText variant="small" tone="muted">
            {t('billsLeft.explainLeft', { income: money(balance.income), spent: money(balance.spent), left: money(balance.left) })}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('billsLeft.explainFree', { free: money(Math.max(0, balance.afterBills)) })}
          </AppText>
          <AppText variant="small" tone="muted">{t('billsLeft.explainDates')}</AppText>
        </View>
      </View>
    </Sheet>
  );
}

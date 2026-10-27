import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { shortDate } from '@/domain/dates';
import { HOME_CURRENCY, rateToInput } from '@/domain/fx';
import { formatRM, senToInput } from '@/domain/money';
import type { Expense } from '@/domain/types';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { IconBadge } from '@/ui/IconBadge';
import { ReceiptPreview } from '@/ui/ReceiptPreview';
import { ReceiptFile, ReceiptMissing, useReceipt } from '@/ui/useReceipt';
import { Screen } from '@/ui/Screen';
import { categoryLook, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  expense: Expense;
  categoryName: string;
  /** The category's chosen icon, if it has one. */
  categoryIcon?: string;
  methodName: string | null;
  reliefName: string | null;
  error: string | null;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** A saved spending, read-only. Nothing changes until Edit is tapped. */
export function ExpenseDetails({ expense, categoryName, categoryIcon, methodName, reliefName, error, busy, onEdit, onDelete, onClose }: Props) {
  const { c } = useTheme();
  const [previewing, setPreviewing] = useState(false);
  const receipt = useReceipt(expense.receiptUri);
  const look = categoryLook(categoryName, categoryIcon);
  const year = expense.date.slice(0, 4);

  const row = (label: string, value: ReactNode, last = false) => (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border,
      }}
    >
      <AppText variant="body" tone="muted">{label}</AppText>
      <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
    </View>
  );

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}>
              <Button title={t('common.edit')} onPress={onEdit} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.delete')} variant="secondary" onPress={onDelete} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.close')} variant="secondary" onPress={onClose} />
            </View>
          </View>
        </View>
      }
    >
      <AppText variant="title">{t('expense.view')}</AppText>
      <HeroCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: radius.control }}>
            <IconBadge icon={look.icon} color={look.color} size={36} />
          </View>
          <AppText variant="bodyStrong" color={onHero.ink}>{categoryName}</AppText>
        </View>
        <AppText testID="expense-amount" variant="kpi" color={onHero.ink} style={{ fontSize: 40, lineHeight: 48 }}>
          {formatRM(expense.amount)}
        </AppText>
        {expense.note ? (
          <AppText variant="body" color={onHero.soft}>{expense.note}</AppText>
        ) : null}
      </HeroCard>

      <Card style={{ paddingVertical: 4 }}>
        {row(t('common.date'), `${shortDate(expense.date)} ${year}`)}
        {expense.currency && expense.currency !== HOME_CURRENCY && expense.foreignAmount != null && expense.fxRate != null
          ? row(t('fx.original', { code: expense.currency }), t('fx.originalValue', {
              amount: senToInput(expense.foreignAmount), code: expense.currency, rate: rateToInput(expense.fxRate),
            }))
          : null}
        {expense.sst != null ? row(t('scan.sstLabel'), formatRM(expense.sst)) : null}
        {row(t('method.field'), methodName ?? t('methods.noMethod'))}
        {row(t('relief.field'), reliefName ?? t('relief.none'), expense.reliefAmount === null)}
        {expense.reliefAmount !== null ? row(t('relief.claimable'), formatRM(expense.reliefAmount), true) : null}
      </Card>

      <Card style={{ gap: 12, flexGrow: expense.receiptUri ? 1 : 0 }}>
        <AppText variant="eyebrow" tone="muted">{t('expense.receipt')}</AppText>
        {expense.receiptUri ? (
          receipt.uri && !receipt.isImage ? (
            <ReceiptFile stored={expense.receiptUri} />
          ) : receipt.uri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('receipt.view')}
              onPress={() => setPreviewing(true)}
              style={{ flexGrow: 1, minHeight: 180, borderRadius: radius.control, backgroundColor: c.ground, overflow: 'hidden' }}
            >
              <Image
                source={{ uri: receipt.uri }}
                accessibilityLabel={t('expense.receipt')}
                resizeMode="contain"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            </Pressable>
          ) : (
            <View style={{ flexGrow: 1, minHeight: 180, flexDirection: 'row' }}>{receipt.missing ? <ReceiptMissing /> : null}</View>
          )
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="image-outline" size={20} color={c.muted} />
            <AppText variant="body" tone="muted">{t('receipt.none')}</AppText>
          </View>
        )}
      </Card>
      <ReceiptPreview
        uri={previewing && receipt.uri ? receipt.uri : null}
        onClose={() => setPreviewing(false)}
      />
    </Screen>
  );
}

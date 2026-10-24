import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { dayMonth } from '@/domain/dates';
import { formatRM, parseRM } from '@/domain/money';
import { capReliefClaims } from '@/domain/reliefs';
import { useAllReliefClaims } from '@/hooks/useAllReliefClaims';
import { useExpenses } from '@/hooks/useExpenses';
import { useTaxYear } from '@/hooks/useTaxYear';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ReceiptField } from '@/ui/ReceiptField';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ReliefPage() {
  const { c, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { year, data } = useTaxYear();
  const def = data.reliefs.find((r) => r.id === id);
  const { data: allClaims, manual, add, remove } = useAllReliefClaims(year);
  const { data: expenses } = useExpenses();
  const summary = useMemo(() => capReliefClaims(allClaims, data.reliefs), [allClaims, data]);

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!def) {
    return (
      <Screen>
        <BackButton />
        <AppText variant="section">{t('tax.notFound')}</AppText>
      </Screen>
    );
  }

  const manualClaims = manual.filter((claim) => claim.reliefId === def.id);
  const spendingRows = expenses.filter(
    (e) => e.reliefId === def.id && e.id > 0 && e.date.startsWith(String(year)),
  );
  const entry = summary.perRelief[def.id];
  const surplus = entry ? entry.claimed - entry.allowed : 0;
  const amount = parseRM(amountText);
  const warn = statusStyle('tight', scheme);

  async function addClaim() {
    if (!def || amount === null || amount <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await add({ reliefId: def.id, year, amount, receiptUri, note: note.trim() });
      setAmountText('');
      setNote('');
      setReceiptUri(null);
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const missingBadge = (
    <View style={{ alignSelf: 'flex-start', backgroundColor: warn.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
      <AppText variant="smallStrong" color={warn.ink}>
        {t('tax.missingReceipt')}
      </AppText>
    </View>
  );

  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{def.name}</AppText>
        <AppText variant="bodyStrong" tone="muted">
          {t('tax.limit', { amount: formatRM(def.limit) })}
        </AppText>
        {def.perItem ? (
          <>
            <AppText variant="small" tone="muted">
              {t('tax.eachChild')}
            </AppText>
            <AppText variant="small" tone="muted">
              {t('tax.eachChildSpending')}
            </AppText>
          </>
        ) : null}
        {def.note ? (
          <AppText variant="small" tone="muted">
            {def.note}
          </AppText>
        ) : null}
      </View>

      <Card style={{ gap: 4 }}>
        <AppText variant="small" tone="muted">
          {t('tax.claims')}
        </AppText>
        <AppText variant="kpi">
          {t('tax.claimedOf', { claimed: formatRM(entry?.allowed ?? 0), limit: formatRM(def.limit) })}
        </AppText>
        {surplus > 0 ? (
          <AppText variant="small" tone="negative">
            {t('tax.notClaimable', { amount: formatRM(surplus) })}
          </AppText>
        ) : null}
      </Card>

      {spendingRows.length === 0 && manualClaims.length === 0 ? (
        <AppText variant="body" tone="muted">
          {t('tax.noClaims')}
        </AppText>
      ) : null}

      {spendingRows.length > 0 ? (
        <View style={{ gap: 8 }}>
          {spendingRows.map((e) => {
            const claimable = Math.min(Math.max(e.reliefAmount ?? e.amount, 0), e.amount);
            return (
              <Pressable
                key={`s-${e.id}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/add-expense', params: { id: String(e.id) } })}
                style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {e.note || t('tax.fromSpendingShort')}
                  </AppText>
                  <AppText variant="bodyStrong">
                    {claimable === e.amount
                      ? formatRM(e.amount)
                      : t('tax.claimableOf', { claimable: formatRM(claimable), amount: formatRM(e.amount) })}
                  </AppText>
                </View>
                <AppText variant="small" tone="muted">
                  {t('tax.fromSpending', { date: dayMonth(e.date) })}
                </AppText>
                {def.requiresReceipt && !e.receiptUri ? missingBadge : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {manualClaims.length > 0 ? (
        <View style={{ gap: 8 }}>
          {manualClaims.map((claim) => (
            <View key={claim.id} style={{ backgroundColor: c.surface, borderRadius: radius.control, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {claim.note}
                </AppText>
                <AppText variant="bodyStrong">{formatRM(claim.amount)}</AppText>
              </View>
              {def.requiresReceipt && !claim.receiptUri ? missingBadge : null}
              <Button title={t('common.delete')} variant="secondary" onPress={() => remove(claim.id).catch(() => {})} />
            </View>
          ))}
        </View>
      ) : null}

      <AmountInput label={t('common.amount')} value={amountText} onChange={(text) => setAmountText(text)} />
      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('common.note')}</AppText>
        <TextInput
          accessibilityLabel={t('common.note')}
          value={note}
          onChangeText={setNote}
          placeholderTextColor={c.muted}
          style={{
            height: controlHeight,
            borderRadius: radius.control,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.control,
            paddingHorizontal: 14,
            color: c.text,
            fontFamily: fontFamily.medium,
            fontSize: 16,
          }}
        />
      </View>
      {def.requiresReceipt ? <ReceiptField uri={receiptUri} onChange={setReceiptUri} /> : null}
      {error ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      <Button title={t('tax.addClaim')} onPress={addClaim} disabled={amount === null || amount <= 0 || busy} />
    </Screen>
  );
}

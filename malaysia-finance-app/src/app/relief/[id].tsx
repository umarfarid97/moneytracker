import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { dayMonth } from '@/domain/dates';
import { estimateSocso } from '@/domain/netpay';
import { formatRM, parseRM, senToInput } from '@/domain/money';
import { capReliefClaims } from '@/domain/reliefs';
import type { ReliefClaim } from '@/domain/types';
import { useAllReliefClaims } from '@/hooks/useAllReliefClaims';
import { useExpenses } from '@/hooks/useExpenses';
import { useProfile } from '@/hooks/useProfile';
import { useTaxYear } from '@/hooks/useTaxYear';
import { reliefLabel } from '@/i18n/content';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';
import { confirmDelete } from '@/ui/confirm';
import { ReceiptField } from '@/ui/ReceiptField';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { controlHeight, fontFamily, radius, statusStyle } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ReliefPage() {
  const { c, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { year, data } = useTaxYear();
  const def = data.reliefs.find((r) => r.id === id);
  const { data: allClaims, manual, add, update, remove } = useAllReliefClaims(year);
  const { data: expenses } = useExpenses();
  const { data: profile } = useProfile();
  const summary = useMemo(() => capReliefClaims(allClaims, data.reliefs), [allClaims, data]);

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

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
  // With a salary on file and nothing claimed yet, offer the year's EPF or SOCSO as a one-tap claim.
  const fromSalary =
    def.id === 'epf'
      ? Math.round(profile.grossMonthly * profile.epfRate) * 12
      : def.id === 'socso'
        ? (profile.socsoMonthly > 0 ? profile.socsoMonthly : estimateSocso(profile.grossMonthly)) * 12
        : 0;
  const suggested = !entry && manualClaims.length === 0 ? Math.min(fromSalary, def.limit) : 0;

  async function addSuggested() {
    if (!def || suggested <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await add({ reliefId: def.id, year, amount: suggested, receiptUri: null, note: t('tax.fromSalaryNote') });
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setAmountText('');
    setNote('');
    setReceiptUri(null);
    setError(null);
  }

  function startEdit(claim: ReliefClaim) {
    setEditingId(claim.id);
    setAmountText(senToInput(claim.amount));
    setNote(claim.note);
    setReceiptUri(claim.receiptUri);
    setError(null);
  }

  async function saveClaim() {
    if (!def || amount === null || amount <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const editing = manualClaims.find((claim) => claim.id === editingId);
      if (editing) await update({ ...editing, amount, receiptUri, note: note.trim() });
      else await add({ reliefId: def.id, year, amount, receiptUri, note: note.trim() });
      resetForm();
    } catch {
      setError(t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const formFields = (
    <>
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
        <ReceiptField uri={receiptUri} onChange={setReceiptUri} />
    </>
  );

  const missingBadge = (
    <View style={{ alignSelf: 'flex-start', backgroundColor: warn.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
      <AppText variant="smallStrong" color={warn.ink}>
        {t('tax.missingReceipt')}
      </AppText>
    </View>
  );

  // Existing claims keep the add form folded away until you add one; an empty relief shows it straight away. Editing opens a popup.
  const editing = editingId !== null;
  const showForm = formOpen || (!editing && spendingRows.length === 0 && manualClaims.length === 0);
  const canSave = amount !== null && amount > 0 && !busy;
  const footer = (
    <View style={{ gap: 8 }}>
      {error && !editing ? (
        <AppText variant="small" tone="negative">
          {error}
        </AppText>
      ) : null}
      {!showForm ? (
        <Button title={t('tax.addAnother')} onPress={() => setFormOpen(true)} />
      ) : formOpen ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 2 }}>
            <Button title={t('common.save')} onPress={saveClaim} disabled={!canSave} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={resetForm} disabled={busy} />
          </View>
        </View>
      ) : (
        <Button title={t('tax.addClaim')} onPress={saveClaim} disabled={!canSave} />
      )}
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackButton />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{reliefLabel(def)}</AppText>
        {def.perItem ? (
          <AppText variant="small" tone="muted">
            {t('tax.eachChild')}. {t('tax.eachChildSpending')}
          </AppText>
        ) : null}
        {def.note ? (
          <AppText variant="small" tone="muted">
            {def.note}
          </AppText>
        ) : null}
      </View>

      <Card style={{ gap: 6 }}>
        <AppText variant="kpi">{formatRM(entry?.allowed ?? 0)}</AppText>
        <AppText variant="small" tone="muted">
          {t('tax.claimedOf', { claimed: formatRM(entry?.allowed ?? 0), limit: formatRM(def.limit) })}
        </AppText>
        <ProgressBar fraction={def.perItem ? (entry ? 1 : 0) : (entry?.allowed ?? 0) / def.limit} />
        {surplus > 0 ? (
          <AppText variant="small" tone="negative">
            {t('tax.notClaimable', { amount: formatRM(surplus) })}
          </AppText>
        ) : null}
      </Card>

      {suggested > 0 ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="bodyStrong">{t('tax.fromSalary', { amount: formatRM(suggested) })}</AppText>
          <AppText variant="small" tone="muted">{t('tax.fromSalaryHint')}</AppText>
          <Button title={t('tax.fromSalaryUse')} onPress={addSuggested} disabled={busy} />
        </Card>
      ) : null}

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
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <Button compact title={t('common.edit')} variant="secondary" onPress={() => startEdit(claim)} disabled={busy} />
              <Button
                compact
                title={t('common.delete')}
                variant="secondary"
                onPress={async () => {
                  const ok = await confirmDelete(
                    t('confirm.deleteClaim'), t('confirm.deleteClaimBody', { amount: formatRM(claim.amount) }), t('common.delete'), t('common.cancel'),
                  );
                  if (ok) {
                    if (editingId === claim.id) resetForm();
                    remove(claim.id).catch(() => {});
                  }
                }}
              />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {showForm ? <Card style={{ gap: 14 }}>{formFields}</Card> : null}
      <Sheet
        visible={editing}
        title={t('tax.editClaim')}
        onClose={resetForm}
        footer={
          <View style={{ gap: 8 }}>
            {error ? (
              <AppText variant="small" tone="negative">
                {error}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <Button title={t('common.save')} onPress={saveClaim} disabled={!canSave} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('common.cancel')} variant="secondary" onPress={resetForm} disabled={busy} />
              </View>
            </View>
          </View>
        }
      >
        <View style={{ gap: 14 }}>{formFields}</View>
      </Sheet>
    </Screen>
  );
}

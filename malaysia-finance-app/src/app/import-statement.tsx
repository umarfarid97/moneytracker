import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { extractPdfLines } from '@/domain/pdfText';
import { formatRM, senToInput } from '@/domain/money';
import { todayKL } from '@/domain/dates';
import { buildImportItems, mergeIntoPrevious, toNewExpenses, type ImportItem } from '@/domain/statementImport';
import { parseStatementCsv, parseStatementLines, type StatementRow } from '@/domain/statementParse';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { t } from '@/i18n/t';
import { pickStatementFile } from '@/statementFile';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { controlHeight, fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Loaded = { file: string; items: ImportItem[]; skippedIn: number };
type Phase = { step: 'pick'; error: string | null } | { step: 'preview'; data: Loaded } | { step: 'done'; count: number; failed: boolean };

/** The amount of one line: keeps what is being typed, and only passes on a valid amount above zero. */
function RowAmount({ amount, onChange }: { amount: number; onChange: (sen: number) => void }) {
  const [text, setText] = useState(senToInput(amount));
  return (
    <AmountInput
      compact
      label={t('import.amount')}
      value={text}
      onChange={(next, sen) => { setText(next); if (sen !== null && sen > 0) onChange(sen); }}
    />
  );
}

/** More > Import bank statement: read a CSV or PDF on the phone, review the lines, then save the ticked ones as spending. */
export default function ImportStatement() {
  const { c } = useTheme();
  const { data: categories } = useCategories();
  const { data: methods } = usePaymentMethods();
  const { data: expenses, add } = useExpenses();
  const [phase, setPhase] = useState<Phase>({ step: 'pick', error: null });
  const [busy, setBusy] = useState<'reading' | 'saving' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function choose() {
    setBusy('reading');
    try {
      const file = await pickStatementFile();
      if (!file) return;
      const year = Number(todayKL().slice(0, 4));
      let rows: StatementRow[];
      let sourceText: string;
      if (file.kind === 'csv') {
        rows = parseStatementCsv(file.text, year);
        sourceText = file.text.slice(0, 2000);
      } else {
        const lines = extractPdfLines(file.bytes);
        if (lines.length === 0) return setPhase({ step: 'pick', error: t('import.noText') });
        rows = parseStatementLines(lines, year);
        sourceText = lines.slice(0, 40).join('\n');
      }
      if (rows.length === 0) return setPhase({ step: 'pick', error: t('import.empty') });
      const { items, skippedIn } = buildImportItems(rows, { categories, methods, existing: expenses, source: file.name, sourceText });
      if (items.length === 0) return setPhase({ step: 'pick', error: t('import.noSpending') });
      setEditing(null);
      setPhase({ step: 'preview', data: { file: file.name, items, skippedIn } });
    } catch {
      setPhase({ step: 'pick', error: t('import.failed') });
    } finally {
      setBusy(null);
    }
  }

  const change = (fn: (items: ImportItem[]) => ImportItem[]) =>
    setPhase((p) => (p.step === 'preview' ? { step: 'preview', data: { ...p.data, items: fn(p.data.items) } } : p));
  const patch = (key: string, next: Partial<ImportItem>) =>
    change((items) => items.map((i) => (i.key === key ? { ...i, ...next } : i)));

  async function save(items: ImportItem[]) {
    setBusy('saving');
    let count = 0;
    let failed = false;
    for (const e of toNewExpenses(items)) {
      try {
        await add(e);
        count++;
      } catch {
        failed = true;
      }
    }
    setBusy(null);
    setPhase({ step: 'done', count, failed });
  }

  const field = {
    height: controlHeight, borderRadius: radius.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.control,
    paddingHorizontal: 14, color: c.text, fontFamily: fontFamily.medium, fontSize: 16,
  } as const;

  if (phase.step === 'done') {
    return (
      <Screen>
        <BackButton />
        <Card style={{ gap: 12, alignItems: 'flex-start' }}>
          <Ionicons name={phase.failed ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={36} color={phase.failed ? c.negative : c.positive} />
          <AppText variant="section">{phase.failed ? t('import.saveFailed', { count: phase.count }) : t('import.done', { count: phase.count })}</AppText>
          {phase.failed ? null : <AppText variant="body" tone="muted">{t('import.doneBody')}</AppText>}
        </Card>
        <Button title={t('import.another')} variant="secondary" onPress={() => setPhase({ step: 'pick', error: null })} />
        <Button title={t('import.close')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (phase.step === 'pick') {
    return (
      <Screen>
        <BackButton />
        <AppText variant="title">{t('import.title')}</AppText>
        <Card style={{ gap: 10 }}>
          <AppText variant="body">{t('import.intro')}</AppText>
          <AppText variant="small" tone="muted">{t('import.supported')}</AppText>
        </Card>
        {phase.error ? <AppText variant="small" tone="negative">{phase.error}</AppText> : null}
        <Button title={busy === 'reading' ? t('import.reading') : t('import.choose')} disabled={busy !== null} onPress={choose} />
      </Screen>
    );
  }

  const { file, items, skippedIn } = phase.data;
  const ticked = items.filter((i) => i.selected && i.amount > 0);
  const total = ticked.reduce((sum, i) => sum + i.amount, 0);
  const duplicates = items.filter((i) => i.duplicate).length;
  const allMethod = items.length > 0 && items.every((i) => i.paymentMethodId === items[0].paymentMethodId) ? items[0].paymentMethodId : null;
  const categoryName = (id: number) => categories.find((x) => x.id === id)?.name ?? '';
  const methodName = (id: number | null) => methods.find((m) => m.id === id)?.name ?? '';

  return (
    <Screen
      footer={
        <Button
          title={busy === 'saving' ? t('import.saving') : ticked.length === 0 ? t('import.buttonNone') : t('import.button', { count: ticked.length, total: formatRM(total) })}
          disabled={ticked.length === 0 || busy !== null}
          onPress={() => save(items)}
        />
      }
    >
      <BackButton />
      <AppText variant="title">{t('import.title')}</AppText>
      <Card style={{ gap: 6 }}>
        <AppText variant="bodyStrong">{t('import.found', { count: items.length, file })}</AppText>
        {skippedIn > 0 ? <AppText variant="small" tone="muted">{t('import.skippedIn', { count: skippedIn })}</AppText> : null}
        {duplicates > 0 ? <AppText variant="small" tone="warning">{t('import.duplicates', { count: duplicates })}</AppText> : null}
        <PressableScale accessibilityRole="button" onPress={choose} style={{ paddingVertical: 4 }}>
          <AppText variant="smallStrong" color={c.accent}>{t('import.pickDifferent')}</AppText>
        </PressableScale>
      </Card>

      <View style={{ gap: 8 }}>
        <AppText variant="smallStrong">{t('import.paidWithAll')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {methods.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              accessibilityLabel={`${t('import.paidWith')} ${m.name}`}
              selected={allMethod === m.id}
              onPress={() => change((list) => list.map((i) => ({ ...i, paymentMethodId: m.id })))}
            />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip compact label={t('import.selectAll')} onPress={() => change((list) => list.map((i) => ({ ...i, selected: true })))} />
        <Chip compact label={t('import.selectNone')} onPress={() => change((list) => list.map((i) => ({ ...i, selected: false })))} />
      </View>

      <View style={{ gap: 8 }}>
        {items.map((item, index) => {
          const shownNote = item.note || t('import.noNote');
          const open = editing === item.key;
          return (
            <Card key={item.key} style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <PressableScale
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('import.include', { note: shownNote })}
                  accessibilityState={{ checked: item.selected }}
                  onPress={() => patch(item.key, { selected: !item.selected })}
                  hitSlop={8}
                >
                  <Ionicons name={item.selected ? 'checkbox' : 'square-outline'} size={26} color={item.selected ? c.accent : c.control} />
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('import.edit', { note: shownNote })}
                  onPress={() => setEditing(open ? null : item.key)}
                  style={{ flex: 1, gap: 2 }}
                >
                  <AppText variant="bodyStrong" numberOfLines={open ? undefined : 2}>{shownNote}</AppText>
                  <AppText variant="small" tone="muted">
                    {item.date} · {categoryName(item.categoryId)}{item.paymentMethodId !== null ? ` · ${methodName(item.paymentMethodId)}` : ''}
                  </AppText>
                  {item.duplicate ? <AppText variant="small" tone="warning">{t('import.possibleDuplicate')}</AppText> : null}
                </PressableScale>
                <AppText variant="bodyStrong" tone="negative">{formatRM(item.amount)}</AppText>
              </View>
              {open ? (
                <View style={{ gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <AppText variant="eyebrow" tone="muted">{t('import.note')}</AppText>
                    <TextInput
                      accessibilityLabel={t('import.note')}
                      value={item.note}
                      maxLength={80}
                      onChangeText={(note) => patch(item.key, { note })}
                      style={field}
                    />
                  </View>
                  <RowAmount amount={item.amount} onChange={(amount) => patch(item.key, { amount })} />
                  <View style={{ flexDirection: 'row' }}>
                    <DateField compact label={t('import.date')} value={item.date} onChange={(date) => patch(item.key, { date })} />
                  </View>
                  <View style={{ gap: 6 }}>
                    <AppText variant="eyebrow" tone="muted">{t('import.category')}</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {categories.map((cat) => (
                        <Chip key={cat.id} compact label={cat.name} selected={item.categoryId === cat.id} onPress={() => patch(item.key, { categoryId: cat.id })} />
                      ))}
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <AppText variant="eyebrow" tone="muted">{t('import.paidWith')}</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {methods.map((m) => (
                        <Chip key={m.id} compact label={m.name} selected={item.paymentMethodId === m.id} onPress={() => patch(item.key, { paymentMethodId: m.id })} />
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                    {index > 0 ? (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={t('import.mergeUpLabel', { note: shownNote })}
                        onPress={() => { setEditing(items[index - 1].key); change((list) => mergeIntoPrevious(list, item.key)); }}
                      >
                        <AppText variant="bodyStrong" color={c.accent}>{t('import.mergeUp')}</AppText>
                      </PressableScale>
                    ) : null}
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={t('import.removeLabel', { note: shownNote })}
                      onPress={() => { setEditing(null); change((list) => list.filter((i) => i.key !== item.key)); }}
                    >
                      <AppText variant="bodyStrong" tone="negative">{t('import.remove')}</AppText>
                    </PressableScale>
                    <PressableScale accessibilityRole="button" onPress={() => setEditing(null)}>
                      <AppText variant="bodyStrong" color={c.accent}>{t('import.editDone')}</AppText>
                    </PressableScale>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

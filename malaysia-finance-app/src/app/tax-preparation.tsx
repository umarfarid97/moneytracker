import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { buildBeSummary, beSummaryText } from '@/domain/beForm';
import { formatRM, senToInput } from '@/domain/money';
import { buildReliefPack } from '@/domain/reliefPack';
import { auditTaxRecords, confirmedTaxPack, reviewedFilingCsv, reviewKey, reviewTaxPack } from '@/domain/taxPreparation';
import { GUIDE_ANSWERS, guideCondition, suggestReliefs, type GuideAnswer } from '@/domain/taxGuide';
import { shareBinaryFile, shareTextFile } from '@/exportFile';
import { useExpenses } from '@/hooks/useExpenses';
import { useReliefClaims } from '@/hooks/useReliefClaims';
import { useTaxYear } from '@/hooks/useTaxYear';
import { reliefLabel } from '@/i18n/content';
import { t } from '@/i18n/t';
import { fromBase64 } from '@/sync/bytes';
import { prepareReceipts, readReceiptBase64 } from '@/sync/receiptFiles';
import { buildTaxEvidence, EvidenceTooLarge } from '@/taxEvidence';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';

export default function TaxPreparation() {
  const { year, data, notice, options, setYear } = useTaxYear();
  const { data: expenses } = useExpenses();
  const { data: manualClaims } = useReliefClaims(year);
  const [answers, setAnswers] = useState<GuideAnswer[]>([]);
  const [confirmations, setConfirmations] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pack = buildReliefPack({ year, data, expenses, manualClaims });
  const review = reviewTaxPack(pack, data);
  const rawIssues = auditTaxRecords(year, data, expenses, manualClaims);
  const confirmed = confirmedTaxPack(pack, data, rawIssues ? [] : confirmations, acknowledged);
  const summary = buildBeSummary(confirmed);
  const summaryText = [t('prep.filingHint'), t('prep.rules', { ya: data.ya, date: data.fetchedOn }), data.reliefSourceUrl,
    !review.exact ? t('prep.fallback') : '', `${confirmed.sections.length}/${pack.sections.length}`, beSummaryText(summary)].join('\n\n');
  const go = (id: string) => router.push({ pathname: '/relief/[id]', params: { id } });
  const toggle = <T,>(items: T[], value: T) => items.includes(value) ? items.filter(x => x !== value) : [...items, value];
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(t(e instanceof EvidenceTooLarge ? 'prep.tooLarge' : 'prep.failed')); }
    finally { setBusy(false); }
  }
  async function exportEvidence() {
    await prepareReceipts();
    const result = await buildTaxEvidence(pack, summaryText, async reference => {
      const base64 = await readReceiptBase64(reference);
      return base64 === null ? null : fromBase64(base64);
    });
    await shareBinaryFile(`Duit-tax-${year}.zip`, result.bytes, 'application/zip', t('prep.evidence'));
    setMessage(t('prep.exported', { count: result.unavailable }));
  }
  return <Screen>
    <BackButton />
    <AppText variant="title">{t('prep.title')}</AppText>
    <AppText tone="muted">{t('prep.intro')}</AppText>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[...new Set([...options, data.ya])].map(y => <Chip key={y} label={String(y)} selected={y === year} onPress={() => { setYear(y); setConfirmations([]); setAcknowledged([]); setMessage(''); }} />)}
    </View>
    <AppText variant="small" tone="muted">{t('prep.rules', { ya: data.ya, date: data.fetchedOn })}</AppText>
    {notice ? <AppText variant="small" tone="warning">{notice}</AppText> : null}
    {!review.exact ? <AppText variant="bodyStrong" tone="warning">{t('prep.fallback')}</AppText> : null}
    <Button compact variant="secondary" title={t('prep.source')} onPress={() => void action(() => Linking.openURL(data.reliefSourceUrl).then(() => {}))} />
    <AppText variant="small" tone="muted">{t('prep.session')}</AppText>

    <Card style={{ gap: 10 }}>
      <AppText variant="section">{t('prep.readiness')}</AppText>
      <AppText variant="bodyStrong">{t('prep.claims', { count: review.items })}</AppText>
      <AppText tone="muted">{t('prep.reviewed', { count: confirmed.sections.length, total: pack.sections.length })}</AppText>
      {review.items === 0 ? <AppText variant="small" tone="muted">{t('prep.empty')}</AppText> : null}
      {rawIssues ? <AppText tone="warning">{t('prep.rawIssues', { count: rawIssues })}</AppText> : null}
      {rawIssues ? <Button compact variant="secondary" title={t('prep.review')} onPress={() => router.push('/(tabs)/spending')} /> : null}
      <Button compact title={t('taxCalc.title')} onPress={() => router.push('/tax-calculator')} />
    </Card>
    {pack.sections.map(section => {
      const key = reviewKey(pack, section);
      const issues = review.issues.filter(i => i.reliefId === section.reliefId);
      const blocked = issues.some(i => ['missing', 'note', 'invalid'].includes(i.kind));
      const duplicate = issues.some(i => i.kind === 'duplicate');
      const reviewed = confirmed.sections.some(s => s.reliefId === section.reliefId);
      const def = data.reliefs.find(r => r.id === section.reliefId)!;
      return <Card key={section.reliefId} style={{ gap: 10 }}>
        <AppText variant="bodyStrong">{reliefLabel(def)}</AppText>
        <AppText>{formatRM(section.allowed)}</AppText>
        <AppText variant="small" tone="muted">{t(`prep.condition.${guideCondition(section.reliefId)}`)}</AppText>
        {issues.map(i => <AppText key={i.kind} variant="small" tone="warning">{t(`prep.issue.${i.kind}`, { count: i.count })}</AppText>)}
        {duplicate ? <Button compact variant="secondary" title={t('prep.ack')} disabled={busy || acknowledged.includes(key)} onPress={() => setAcknowledged(prev => [...prev, key])} /> : null}
        <AppText variant="small" tone="muted">{t('prep.confirmHint')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button compact variant="secondary" title={t('prep.review')} onPress={() => go(section.reliefId)} />
          <Button compact title={t(reviewed ? 'prep.confirmed' : 'prep.confirm')} accessibilityLabel={t('prep.confirmLabel', { name: reliefLabel(def) })}
            disabled={busy || !review.exact || rawIssues > 0 || blocked || (duplicate && !acknowledged.includes(key))} onPress={() => setConfirmations(prev => toggle(prev, key))} />
        </View>
      </Card>;
    })}

    <Card style={{ gap: 10 }}>
      <AppText variant="section">{t('prep.guide')}</AppText>
      <AppText variant="small" tone="muted">{t('prep.guideHint')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GUIDE_ANSWERS.map(a => <Chip key={a} label={t(`prep.answer.${a}`)} selected={answers.includes(a)} onPress={() => setAnswers(prev => toggle(prev, a))} />)}
      </View>
      {suggestReliefs(answers, data).map(def => <View key={def.id} style={{ gap: 6, marginTop: 8 }}>
        <AppText variant="bodyStrong">{reliefLabel(def)}</AppText>
        <AppText variant="small" tone="muted">{formatRM(def.limit)} · {t(`prep.condition.${guideCondition(def.id)}`)}</AppText>
        <View style={{ alignSelf: 'flex-start' }}><Button compact variant="secondary" title={t('prep.review')} accessibilityLabel={`${t('prep.review')}: ${reliefLabel(def)}`} onPress={() => go(def.id)} /></View>
      </View>)}
    </Card>

    <Card style={{ gap: 10 }}>
      <AppText variant="section">{t('prep.filing')}</AppText>
      <AppText variant="small" tone="muted">{t('prep.filingHint')}</AppText>
      {confirmed.automatic.map(a => <AppText key={a.name}>{a.name} · {t('tax.automatic')} · {formatRM(a.amount)}</AppText>)}
      {summary.sections.map(sec => <View key={sec.id} style={{ gap: 10 }}>
        <AppText variant="eyebrow" tone="muted">{sec.title}</AppText>
        {sec.lines.map(line => <View key={line.reliefId} style={{ gap: 6 }}>
          <AppText>{reliefLabel(data.reliefs.find(r => r.id === line.reliefId)!)}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <AppText selectable variant="bodyStrong">{formatRM(line.enter)}</AppText>
            <Button compact variant="secondary" title={t('prep.copy')} disabled={busy} accessibilityLabel={t('prep.copyLabel', { name: line.name })} onPress={() => void action(async () => {
              const copied = await Clipboard.setStringAsync(senToInput(line.enter));
              if (!copied) throw new Error('Clipboard unavailable');
              setMessage(t('prep.copied'));
            })} />
          </View>
        </View>)}
      </View>)}
      <Button compact title={t('prep.download')} disabled={busy || !review.exact || !confirmed.sections.length} onPress={() => void action(() => shareTextFile(`Duit-reviewed-${year}.txt`, summaryText, 'text/plain', t('prep.filing')))} />
      <Button compact variant="secondary" title={t('prep.csv')} disabled={busy || !review.exact || !confirmed.sections.length} onPress={() => void action(() => shareTextFile(`Duit-reviewed-${year}.csv`, reviewedFilingCsv(pack, confirmed, data), 'text/csv', t('prep.filing')))} />
    </Card>
    <Card style={{ gap: 10 }}>
      <AppText variant="section">{t('prep.evidence')}</AppText>
      <AppText variant="small" tone="muted">{t('prep.evidenceHint')}</AppText>
      <Button title={t('prep.evidence')} disabled={busy || !review.items} onPress={() => void action(exportEvidence)} />
      <AppText variant="small" tone="muted">{t('prep.retention')}</AppText>
    </Card>
    {message ? <AppText accessibilityRole="alert" tone="positive">{message}</AppText> : null}
    {error ? <AppText accessibilityRole="alert" tone="negative">{error}</AppText> : null}
  </Screen>;
}

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { SavingsSheet } from '@/features/wealth/SavingsSheet';
import { formatRM, parseRM } from '@/domain/money';
import { gain, monthsToTarget, progress, SAVINGS_KINDS, type SavingsAccount } from '@/domain/savings';
import { useSavings } from '@/hooks/useSavings';
import { t } from '@/i18n/t';
import { AmountInput } from '@/ui/AmountInput';
import { AppText } from '@/ui/AppText';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confirmDelete } from '@/ui/confirm';
import { EmptyState } from '@/ui/EmptyState';
import { HeroCard, onHero } from '@/ui/HeroCard';
import { IconBadge } from '@/ui/IconBadge';
import { PressableScale } from '@/ui/PressableScale';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { useTheme } from '@/ui/useTheme';

type Money = { account: SavingsAccount; mode: 'deposit' | 'value' };

function MoneySheet({ account, mode, onClose, onSave }: Money & { onClose: () => void; onSave: (a: SavingsAccount) => Promise<void> }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sen = parseRM(text);
  const valid = sen !== null && (mode === 'value' ? text.trim() !== '' : sen > 0);

  async function save() {
    if (sen === null) return;
    try {
      await onSave(
        mode === 'deposit'
          ? { ...account, balance: account.balance + sen, invested: account.invested + sen }
          : { ...account, balance: sen },
      );
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Sheet visible title={t(mode === 'deposit' ? 'savings.deposit' : 'savings.updateValue')} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <AppText variant="small" tone="muted">
          {t(mode === 'deposit' ? 'savings.depositHint' : 'savings.valueHint', { name: account.name })}
        </AppText>
        <AmountInput label={t(mode === 'deposit' ? 'common.amount' : 'savings.balance')} value={text} onChange={setText} autoFocus compact />
        {error ? <AppText variant="small" tone="negative">{error}</AppText> : null}
        <Button title={t('common.save')} disabled={!valid} onPress={save} />
      </View>
    </Sheet>
  );
}

export default function Savings() {
  const { c } = useTheme();
  const { data, totals, add, update, remove } = useSavings();
  const [edit, setEdit] = useState<{ key: number; account: SavingsAccount | null } | null>(null);
  const [money, setMoney] = useState<Money | null>(null);

  async function removeAccount(a: SavingsAccount): Promise<boolean> {
    if (!(await confirmDelete(t('savings.deleteTitle'), t('savings.deleteMessage', { name: a.name }), t('common.delete'), t('common.cancel')))) return false;
    await remove(a.id);
    return true;
  }

  return (
    <Screen>
      <BackButton />
      <AppText variant="title">{t('savings.title')}</AppText>
      <HeroCard style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <AppText variant="eyebrow" color={onHero.soft}>{t('savings.total')}</AppText>
          <AppText testID="savings-total" variant="kpi" color={onHero.ink}>{formatRM(totals.balance)}</AppText>
        </View>
        {totals.invested > 0 ? (
          <AppText variant="small" tone="muted">
            {t('savings.putIn', { invested: formatRM(totals.invested) })}
            {' · '}
            {t(totals.gain >= 0 ? 'savings.gain' : 'savings.loss', { amount: formatRM(Math.abs(totals.gain)) })}
          </AppText>
        ) : null}
      </HeroCard>

      <Button title={t('savings.add')} onPress={() => setEdit({ key: Date.now(), account: null })} />

      {data.length === 0 ? (
        <EmptyState icon="trending-up" text={t('savings.empty')} hint={t('savings.emptyHint')} />
      ) : (
        data.map((a) => {
          const part = progress(a);
          const months = monthsToTarget(a);
          const g = gain(a);
          const kind = SAVINGS_KINDS.find((k) => k.kind === a.kind);
          return (
            <Card key={a.id} style={{ gap: 12 }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('savings.editLabel', { name: a.name })}
                onPress={() => setEdit({ key: Date.now(), account: a })}
                pressedScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <IconBadge icon={(kind?.icon ?? 'wallet') as keyof typeof Ionicons.glyphMap} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{a.name}</AppText>
                  <AppText variant="small" tone="muted">{kind?.label}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="bodyStrong" color={c.accent}>{formatRM(a.balance)}</AppText>
                  {a.invested > 0 && g !== 0 ? (
                    <AppText variant="small" tone={g > 0 ? 'positive' : 'negative'}>
                      {g > 0 ? '+' : '-'}{formatRM(Math.abs(g))}
                    </AppText>
                  ) : null}
                </View>
              </PressableScale>
              {part !== null ? (
                <View style={{ gap: 6 }}>
                  <ProgressBar fraction={part} />
                  <AppText variant="small" tone="muted">
                    {t('savings.progress', { percent: Math.round(part * 100), target: formatRM(a.target ?? 0) })}
                    {months !== null && months > 0 ? ` · ${t('savings.months', { count: months })}` : ''}
                  </AppText>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('savings.deposit')}
                    accessibilityLabel={t('savings.depositLabel', { name: a.name })}
                    variant="secondary"
                    compact
                    onPress={() => setMoney({ account: a, mode: 'deposit' })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('savings.updateValue')}
                    accessibilityLabel={t('savings.valueLabel', { name: a.name })}
                    variant="secondary"
                    compact
                    onPress={() => setMoney({ account: a, mode: 'value' })}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}

      {edit ? (
        <SavingsSheet
          key={edit.key}
          visible
          existing={edit.account}
          onClose={() => setEdit(null)}
          onSave={async (input) => {
            if (edit.account) await update({ ...edit.account, ...input });
            else await add(input);
          }}
          onDelete={edit.account ? () => removeAccount(edit.account!) : undefined}
        />
      ) : null}
      {money ? <MoneySheet {...money} onClose={() => setMoney(null)} onSave={update} /> : null}
    </Screen>
  );
}

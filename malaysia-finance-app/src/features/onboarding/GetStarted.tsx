import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/ui/useTheme';

type Props = {
  hasSalary: boolean;
  hasBill: boolean;
  hasSpending: boolean;
};

/** Stops showing once the user has logged this many spendings, even if a step was skipped. */
export const GET_STARTED_MAX_SPENDINGS = 15;

/** A short first-run checklist on Home: salary, a first bill or loan, a first spending. */
export function GetStarted({ hasSalary, hasBill, hasSpending }: Props) {
  const { c } = useTheme();
  const steps: { key: string; done: boolean; href: Href }[] = [
    { key: 'salary', done: hasSalary, href: '/profile' },
    { key: 'bill', done: hasBill, href: '/commitments' },
    { key: 'spending', done: hasSpending, href: '/add-expense' },
  ];
  return (
    <Card style={{ gap: 6 }}>
      <AppText variant="bodyStrong">{t('start.title')}</AppText>
      <AppText variant="small" tone="muted">{t('start.hint')}</AppText>
      {steps.map((step, i) => (
        <PressableScale
          key={step.key}
          accessibilityRole="button"
          accessibilityLabel={t(`start.${step.key}` as 'start.salary')}
          onPress={() => router.push(step.href)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
        >
          <Ionicons name={step.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={step.done ? c.positive : c.muted} />
          <AppText variant="body" tone={step.done ? 'muted' : 'text'} style={{ flex: 1 }}>
            {`${i + 1}. ${t(`start.${step.key}` as 'start.salary')}`}
          </AppText>
          {step.done ? null : <Ionicons name="chevron-forward" size={18} color={c.accent} />}
        </PressableScale>
      ))}
    </Card>
  );
}

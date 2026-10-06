import { getTranslations } from 'next-intl/server';
import { StepProgress } from '@pluma/ui';
import type { OnboardingStep, SessionInfo } from '@pluma/services';

/** Barra de pasos: el paso del tutor solo cuenta si la persona es menor de edad. */
export async function OnboardingProgress({ session, step }: { session: SessionInfo; step: OnboardingStep }) {
  const t = await getTranslations('common');
  const steps: OnboardingStep[] = ['profile', 'society', ...(session.minor ? (['guardian'] as const) : []), 'plan', 'contract', 'payment'];
  const current = Math.max(steps.indexOf(step), 0) + 1;
  return <StepProgress current={current} total={steps.length} label={t('stepOf', { current, total: steps.length })} />;
}

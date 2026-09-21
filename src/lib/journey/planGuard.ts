/**
 * The Schreibliste at runtime (docs/orchestrator/SPEC.md §6.1, second half).
 *
 * check-plan holds the page CODE against the plan at build time; this guard
 * holds every WRITE against it when the flow runs. useJourneySubmit calls
 * checkPlanWrite before each create/update: an entity the flow's plan line
 * does not list, or a field outside it, is refused with a sentence the user
 * can read — the record is never sent. Without a plan (empty FLOW_WRITES) or
 * for a flow the plan does not know, nothing is refused.
 *
 * React-free: the flow's slug comes from the hash route (#/intents/<slug>),
 * like IntentPolicyLoader reads it.
 */
import { FLOW_WRITES, HAS_PLAN, PLAN_SENTENCES } from '@/config/plan';
import { t } from '@/i18n';

export function flowSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const path = (window.location.hash || '').replace(/^#/, '');
  const m = /^\/intents\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}

/** null when the write is allowed; else the message to refuse it with. */
export function checkPlanWrite(slug: string | null, entity: string, payload: Record<string, unknown>): string | null {
  if (!HAS_PLAN || !slug) return null;
  const writes = FLOW_WRITES[slug];
  if (!writes) return null;                       // a flow the plan does not know (built by a page job later)
  const allowed = writes[entity];
  if (!allowed) return t('jg_entity_not_planned', { entity, flow: slug });
  const extra = Object.keys(payload).filter(k => !allowed.includes(k));
  if (extra.length) return t('jg_fields_not_planned', { entity, fields: extra.join(', '), flow: slug });
  return null;
}

export function planSentencesFor(slug: string): string[] {
  return PLAN_SENTENCES[slug] ?? [];
}

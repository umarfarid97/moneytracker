import { isDefaultProject, type OwedProject } from '@/domain/owed';
import { t } from '@/i18n/t';

/** The project's name for display; the default project is named in the chosen language. */
export const projectName = (p: Pick<OwedProject, 'name' | 'uid'>) => (isDefaultProject(p) ? t('owed.defaultProject') : p.name);

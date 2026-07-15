import type { ImportedProjectModel } from '../types/domain';
import { createDemoProject } from '../../entities/project/demo';

export function loadBundledFsmModel(): ImportedProjectModel {
  return createDemoProject();
}

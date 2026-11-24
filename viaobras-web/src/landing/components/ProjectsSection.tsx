import { CROPS, PROJECTS, SECTION_IDS, SHOTS } from '../content'
import { FeatureSplit } from './FeatureSplit'

/** Gestão de obras: texto à esquerda, screenshot à direita, fundo branco. */
export function ProjectsSection() {
  return (
    <FeatureSplit
      id={SECTION_IDS.projects}
      tone="white"
      eyebrow={PROJECTS.eyebrow}
      title={PROJECTS.title}
      text={PROJECTS.text}
      features={PROJECTS.features}
      shot={SHOTS.projects}
      crop={CROPS.projects}
    />
  )
}

import { CROPS, SECTION_IDS, SHOTS, SUPPLIES } from '../content'
import { FeatureSplit } from './FeatureSplit'

/** Suprimentos: posição invertida (screenshot à esquerda) sobre fundo azul suave; a tabela e os status ficam visíveis. */
export function SuppliesSection() {
  return (
    <FeatureSplit
      id={SECTION_IDS.supplies}
      tone="soft"
      reverse
      eyebrow={SUPPLIES.eyebrow}
      title={SUPPLIES.title}
      text={SUPPLIES.text}
      features={SUPPLIES.features}
      shot={SHOTS.supplies}
      crop={CROPS.supplies}
    />
  )
}

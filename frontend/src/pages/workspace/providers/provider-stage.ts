export function providerStageIndex(stage: string) {
  if (stage === 'I1') return 0
  if (stage === 'I2' || stage === 'suspended') return 1
  return 2
}
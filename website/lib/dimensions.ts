export interface Dimension {
  id: string
  symbol: string
  name: string
  tagline: string
  description: string
  color: string
  colorClass: string
  glowClass: string
}

export const dimensions: Dimension[] = [
  {
    id: 'magnitude',
    symbol: 'm',
    name: 'Magnitude',
    tagline: 'The foundation',
    description: 'Pure value, waiting to become. The base quantity from which all dimensions extend.',
    color: '#ffffff',
    colorClass: 'text-dim-magnitude',
    glowClass: '',
  },
  {
    id: 'temporal',
    symbol: 'T',
    name: 'Temporal',
    tagline: 'Money that ages',
    description: 'Some decays to encourage flow. Some grows to reward patience. Time becomes a dimension of value.',
    color: '#6366f1',
    colorClass: 'text-dim-temporal',
    glowClass: 'glow-temporal',
  },
  {
    id: 'locality',
    symbol: 'L',
    name: 'Locality',
    tagline: 'Money that belongs',
    description: 'Communities create economic membranes—permeable but present. Value knows where it belongs.',
    color: '#22c55e',
    colorClass: 'text-dim-locality',
    glowClass: 'glow-locality',
  },
  {
    id: 'purpose',
    symbol: 'P',
    name: 'Purpose',
    tagline: 'Money with intent',
    description: 'Education. Health. Creation. Value flows toward meaning, carrying intent through every exchange.',
    color: '#f59e0b',
    colorClass: 'text-dim-purpose',
    glowClass: 'glow-purpose',
  },
  {
    id: 'reputation',
    symbol: 'R',
    name: 'Reputation',
    tagline: 'Money that remembers',
    description: 'Earned, gifted, inherited—provenance becomes signal. History accretes rather than vanishes.',
    color: '#ec4899',
    colorClass: 'text-dim-reputation',
    glowClass: 'glow-reputation',
  },
]

export const getDimensionById = (id: string): Dimension | undefined => {
  return dimensions.find(d => d.id === id)
}

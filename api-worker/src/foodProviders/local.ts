import type { FoodCandidate, FoodSearchQuery } from '../contracts'
import type { FoodDataProvider } from './types'

type LocalEntry = Omit<FoodCandidate, 'source' | 'fetchedAt'> & { aliases: string[] }

const LOCAL_FOODS: LocalEntry[] = [
  {
    sourceId: 'chicken-breast-raw',
    name: '雞胸肉',
    preparation: '未調味',
    weightState: 'raw',
    basis: '100g',
    kcal: 120,
    proteinG: 23.1,
    carbsG: 0,
    fatG: 2.6,
    aliases: ['雞胸', '雞胸肉', 'chicken breast', 'hähnchenbrust'],
    completeness: 'partial',
  },
  {
    sourceId: 'egg-whole',
    name: '雞蛋',
    weightState: 'raw',
    basis: '100g',
    kcal: 143,
    proteinG: 12.6,
    carbsG: 0.7,
    fatG: 9.5,
    aliases: ['蛋', '雞蛋', 'egg', 'ei'],
    completeness: 'partial',
  },
  {
    sourceId: 'rice-white-cooked',
    name: '白飯',
    preparation: '熟飯',
    weightState: 'cooked',
    basis: '100g',
    kcal: 130,
    proteinG: 2.4,
    carbsG: 28.6,
    fatG: 0.2,
    fiberG: 0.3,
    aliases: ['白飯', '米飯', 'cooked rice', 'reis gekocht'],
    completeness: 'partial',
  },
  {
    sourceId: 'cabbage-raw',
    name: '高麗菜',
    weightState: 'raw',
    basis: '100g',
    kcal: 25,
    proteinG: 1.3,
    carbsG: 5.8,
    fatG: 0.1,
    fiberG: 2.5,
    sodiumMg: 18,
    aliases: ['高麗菜', '白菜', 'cabbage', 'weißkohl'],
    completeness: 'complete',
  },
  {
    sourceId: 'tofu-firm',
    name: '板豆腐',
    preparation: '原味',
    weightState: 'unknown',
    basis: '100g',
    kcal: 144,
    proteinG: 17.3,
    carbsG: 2.8,
    fatG: 8.7,
    fiberG: 2.3,
    sodiumMg: 14,
    aliases: ['豆腐', '板豆腐', 'tofu'],
    completeness: 'complete',
  },
]

const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '')

export class LocalFoodProvider implements FoodDataProvider {
  readonly source = 'local' as const

  constructor(private readonly now: () => number = Date.now) {}

  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    if (query.barcode) return []
    const term = normalized(query.text)
    if (!term) return []
    return LOCAL_FOODS
      .filter((entry) => entry.aliases.some((alias) => normalized(alias).includes(term) || term.includes(normalized(alias))))
      .slice(0, query.limit)
      .map(({ aliases: _aliases, ...entry }) => ({ ...entry, source: 'local', fetchedAt: new Date(this.now()).toISOString() }))
  }

  async getById(id: string): Promise<FoodCandidate | null> {
    const entry = LOCAL_FOODS.find((food) => food.sourceId === id)
    if (!entry) return null
    const { aliases: _aliases, ...candidate } = entry
    return { ...candidate, source: 'local', fetchedAt: new Date(this.now()).toISOString() }
  }
}

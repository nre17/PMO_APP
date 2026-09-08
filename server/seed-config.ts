export type SeedProfile = 'portfolio' | 'demo' | 'project' | 'showcase';

/** Selection is used only when creating a store; existing records are never replaced. */
export function seedConfiguration(options: { dataDir?: string; seedProfile?: SeedProfile } = {}, environment: Record<string, string | undefined> = process.env) {
  const seedProfile = options.seedProfile ?? environment.SEED_PROFILE ?? 'portfolio';
  if (!['portfolio', 'demo', 'project', 'showcase'].includes(seedProfile)) throw new Error('SEED_PROFILE must be portfolio, demo, project or showcase. Existing stores have not been changed.');
  const dataDir = options.dataDir ?? environment.DATA_DIR ?? (seedProfile === 'demo' ? '.data/pmo' : seedProfile === 'project' ? '.data/client' : seedProfile === 'showcase' ? '.data/showcase' : '.data/portfolio');
  if (!dataDir.trim()) throw new Error('DATA_DIR must name a local data directory.');
  return { seedProfile, dataDir };
}

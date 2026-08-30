export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: "first-vector", label: "FIRST VECTOR", description: "Write your first traversal vector." },
  { id: "stop-short", label: "STOP SHORT", description: "Commit a warp before 100% of the written line." },
  { id: "airborne-chain", label: "AIRBORNE CHAIN", description: "Clear the Training chamber that teaches airborne reacquisition." },
  { id: "low-profile", label: "LOW PROFILE", description: "Clear the Training crouch / low-clearance chamber." },
  { id: "moving-endpoint", label: "MOVING ENDPOINT", description: "Clear the Training moving-destination chamber." },
  { id: "reorientation", label: "NEW ANGLE", description: "Clear the Training reorientation chamber." },
  { id: "training-complete", label: "GRAMMAR LEARNED", description: "Complete the full Traversal Training course." },
  { id: "map-01-complete", label: "FOUNDATIONS", description: "Complete Campaign Map 01." },
  { id: "map-02-complete", label: "TIMING", description: "Complete Campaign Map 02." },
  { id: "map-03-complete", label: "LINE OF SIGHT", description: "Complete Campaign Map 03." },
  { id: "clean-run", label: "CLEAN GEOMETRY", description: "Finish a run with no restarts and no wasted shots." },
  { id: "challenge-clear", label: "UNDER CONSTRAINT", description: "Complete a Challenge run." },
  { id: "time-trial-clear", label: "ROUTE CLOCK", description: "Complete a Time Trial run." }
];

export type CampaignCheckpoint = {
  sectorId: string;
  checkpointId: string;
  updatedAt: number;
};

export type CampaignProgress = {
  active: boolean;
  completed: boolean;
  currentSectorId: string | null;
  checkpoint: CampaignCheckpoint | null;
  discoveredSectors: string[];
};

export type SectorProgress = {
  completed: boolean;
  clears: number;
  bestTimeSeconds?: number;
};

export interface TraversalProgressData {
  schemaVersion: 2;
  achievements: string[];
  completedMaps: string[];
  bestTimes: Record<string, number>;
  runsCompleted: number;
  campaign: CampaignProgress;
  sectors: Record<string, SectorProgress>;
  timeTrialMedals: Record<string, string>;
  challengeClears: string[];
  secretsFound: string[];
}

type LegacyProgressData = Partial<Pick<
  TraversalProgressData,
  "achievements" | "completedMaps" | "bestTimes" | "runsCompleted"
>>;

const STORAGE_KEY = "traversal-progression:v2";
const LEGACY_STORAGE_KEY = "traversal-progression:v1";
const FIRST_SECTOR_ID = "map-01";
const SECTOR_START_CHECKPOINT = "sector-start";
let activeProgression: TraversalProgression | null = null;

export function activeTraversalProgression(): TraversalProgression | null {
  return activeProgression;
}

function emptyCampaign(): CampaignProgress {
  return {
    active: false,
    completed: false,
    currentSectorId: null,
    checkpoint: null,
    discoveredSectors: []
  };
}

function emptyProgress(): TraversalProgressData {
  return {
    schemaVersion: 2,
    achievements: [],
    completedMaps: [],
    bestTimes: {},
    runsCompleted: 0,
    campaign: emptyCampaign(),
    sectors: {},
    timeTrialMedals: {},
    challengeClears: [],
    secretsFound: []
  };
}

export class TraversalProgression {
  private data: TraversalProgressData = emptyProgress();
  private listeners = new Set<(achievement: AchievementDefinition) => void>();

  constructor(private readonly storage: { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T): Promise<void> }) {
    activeProgression = this;
  }

  async load(): Promise<void> {
    const saved = await this.storage.get<TraversalProgressData>(STORAGE_KEY);
    if (saved) {
      this.data = normalizeProgress(saved);
      return;
    }

    const legacy = await this.storage.get<LegacyProgressData>(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    this.data = migrateLegacyProgress(legacy);
    await this.persist();
  }

  snapshot(): TraversalProgressData {
    return structuredClone(this.data);
  }

  isUnlocked(id: string): boolean {
    return this.data.achievements.includes(id);
  }

  hasCampaignContinue(): boolean {
    return this.data.campaign.active &&
      !this.data.campaign.completed &&
      Boolean(this.data.campaign.currentSectorId);
  }

  campaignCheckpoint(): CampaignCheckpoint | null {
    return this.data.campaign.checkpoint ? structuredClone(this.data.campaign.checkpoint) : null;
  }

  discoveredSectors(): string[] {
    return [...this.data.campaign.discoveredSectors];
  }

  onUnlock(listener: (achievement: AchievementDefinition) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async unlock(id: string): Promise<boolean> {
    if (this.isUnlocked(id)) return false;
    const definition = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!definition) return false;
    this.data.achievements.push(id);
    await this.persist();
    for (const listener of this.listeners) listener(definition);
    return true;
  }

  async startCampaign(sectorId = FIRST_SECTOR_ID): Promise<void> {
    const now = Date.now();
    const discovered = new Set(this.data.campaign.discoveredSectors);
    discovered.add(sectorId);
    this.data.campaign = {
      active: true,
      completed: false,
      currentSectorId: sectorId,
      checkpoint: { sectorId, checkpointId: SECTOR_START_CHECKPOINT, updatedAt: now },
      discoveredSectors: [...discovered]
    };
    await this.persist();
  }

  async setCampaignCheckpoint(sectorId: string, checkpointId = SECTOR_START_CHECKPOINT): Promise<void> {
    this.data.campaign.active = true;
    this.data.campaign.completed = false;
    this.data.campaign.currentSectorId = sectorId;
    this.data.campaign.checkpoint = { sectorId, checkpointId, updatedAt: Date.now() };
    this.discoverSectorInMemory(sectorId);
    await this.persist();
  }

  async discoverSector(sectorId: string): Promise<void> {
    if (this.data.campaign.discoveredSectors.includes(sectorId)) return;
    this.discoverSectorInMemory(sectorId);
    await this.persist();
  }

  async completeCampaignSector(sectorId: string, nextSectorId?: string): Promise<void> {
    const sector = this.data.sectors[sectorId] ?? { completed: false, clears: 0 };
    sector.completed = true;
    this.data.sectors[sectorId] = sector;
    if (!this.data.completedMaps.includes(sectorId)) this.data.completedMaps.push(sectorId);

    if (nextSectorId) {
      const now = Date.now();
      this.discoverSectorInMemory(nextSectorId);
      this.data.campaign.active = true;
      this.data.campaign.completed = false;
      this.data.campaign.currentSectorId = nextSectorId;
      this.data.campaign.checkpoint = {
        sectorId: nextSectorId,
        checkpointId: SECTOR_START_CHECKPOINT,
        updatedAt: now
      };
    } else {
      this.data.campaign.active = false;
      this.data.campaign.completed = true;
      this.data.campaign.currentSectorId = null;
      this.data.campaign.checkpoint = null;
    }
    await this.persist();
  }

  async recordRun(contentId: string, modeId: string, elapsedSeconds: number): Promise<void> {
    this.data.runsCompleted += 1;
    const key = `${contentId}:${modeId}`;
    const previous = this.data.bestTimes[key];
    if (previous === undefined || elapsedSeconds < previous) this.data.bestTimes[key] = elapsedSeconds;

    if (contentId.startsWith("map-")) {
      if (!this.data.completedMaps.includes(contentId)) this.data.completedMaps.push(contentId);
      const sector = this.data.sectors[contentId] ?? { completed: false, clears: 0 };
      sector.completed = true;
      sector.clears += 1;
      if (sector.bestTimeSeconds === undefined || elapsedSeconds < sector.bestTimeSeconds) {
        sector.bestTimeSeconds = elapsedSeconds;
      }
      this.data.sectors[contentId] = sector;
    }
    await this.persist();
  }

  async recordTimeTrialMedal(contentId: string, medalId: string): Promise<void> {
    this.data.timeTrialMedals[contentId] = medalId;
    await this.persist();
  }

  async recordChallengeClear(challengeId: string): Promise<void> {
    if (this.data.challengeClears.includes(challengeId)) return;
    this.data.challengeClears.push(challengeId);
    await this.persist();
  }

  async recordSecret(secretId: string): Promise<void> {
    if (this.data.secretsFound.includes(secretId)) return;
    this.data.secretsFound.push(secretId);
    await this.persist();
  }

  private discoverSectorInMemory(sectorId: string): void {
    if (!this.data.campaign.discoveredSectors.includes(sectorId)) {
      this.data.campaign.discoveredSectors.push(sectorId);
    }
  }

  private async persist(): Promise<void> {
    await this.storage.set(STORAGE_KEY, this.data);
  }
}

function normalizeProgress(saved: TraversalProgressData): TraversalProgressData {
  const base = emptyProgress();
  return {
    ...base,
    ...saved,
    schemaVersion: 2,
    achievements: saved.achievements ?? [],
    completedMaps: saved.completedMaps ?? [],
    bestTimes: saved.bestTimes ?? {},
    runsCompleted: saved.runsCompleted ?? 0,
    campaign: {
      ...base.campaign,
      ...(saved.campaign ?? {}),
      discoveredSectors: saved.campaign?.discoveredSectors ?? []
    },
    sectors: saved.sectors ?? {},
    timeTrialMedals: saved.timeTrialMedals ?? {},
    challengeClears: saved.challengeClears ?? [],
    secretsFound: saved.secretsFound ?? []
  };
}

function migrateLegacyProgress(legacy: LegacyProgressData): TraversalProgressData {
  const migrated = emptyProgress();
  migrated.achievements = legacy.achievements ?? [];
  migrated.completedMaps = legacy.completedMaps ?? [];
  migrated.bestTimes = legacy.bestTimes ?? {};
  migrated.runsCompleted = legacy.runsCompleted ?? 0;
  migrated.campaign.discoveredSectors = [...migrated.completedMaps].filter((id) => id.startsWith("map-"));
  for (const sectorId of migrated.completedMaps) {
    if (!sectorId.startsWith("map-")) continue;
    migrated.sectors[sectorId] = { completed: true, clears: 1 };
  }
  return migrated;
}

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
  { id: "clean-run", label: "CLEAN GEOMETRY", description: "Finish a run with no restarts and no wasted shots." },
  { id: "challenge-clear", label: "UNDER CONSTRAINT", description: "Complete a Challenge run." },
  { id: "time-trial-clear", label: "ROUTE CLOCK", description: "Complete a Time Trial run." }
];

export interface TraversalProgressData {
  achievements: string[];
  completedMaps: string[];
  bestTimes: Record<string, number>;
  runsCompleted: number;
}

const STORAGE_KEY = "traversal-progression:v1";

export class TraversalProgression {
  private data: TraversalProgressData = {
    achievements: [],
    completedMaps: [],
    bestTimes: {},
    runsCompleted: 0
  };
  private listeners = new Set<(achievement: AchievementDefinition) => void>();

  constructor(private readonly storage: { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T): Promise<void> }) {}

  async load(): Promise<void> {
    const saved = await this.storage.get<TraversalProgressData>(STORAGE_KEY);
    if (!saved) return;
    this.data = {
      achievements: saved.achievements ?? [],
      completedMaps: saved.completedMaps ?? [],
      bestTimes: saved.bestTimes ?? {},
      runsCompleted: saved.runsCompleted ?? 0
    };
  }

  snapshot(): TraversalProgressData {
    return structuredClone(this.data);
  }

  isUnlocked(id: string): boolean {
    return this.data.achievements.includes(id);
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

  async recordRun(contentId: string, modeId: string, elapsedSeconds: number): Promise<void> {
    this.data.runsCompleted += 1;
    const key = `${contentId}:${modeId}`;
    const previous = this.data.bestTimes[key];
    if (previous === undefined || elapsedSeconds < previous) this.data.bestTimes[key] = elapsedSeconds;
    if (contentId.startsWith("map-") && !this.data.completedMaps.includes(contentId)) {
      this.data.completedMaps.push(contentId);
    }
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.storage.set(STORAGE_KEY, this.data);
  }
}

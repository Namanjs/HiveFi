import * as path from 'path';
import { readJSON, atomicWriteJSON } from './fileUtils';

const ratingsPath = path.join(__dirname, '../config/ratings.json');

export async function submitRating(modelId: string, taskId: string, score: number, niche: string): Promise<void> {
  if (score < 1 || score > 5) throw new Error("Score must be between 1 and 5");
  
  const ratings = await readJSON<any>(ratingsPath, {});

  if (!ratings[modelId]) {
    ratings[modelId] = { totalRatings: 0, totalScore: 0, averageScore: 0, history: [] };
  }

  const modelData = ratings[modelId];
  modelData.history.push({ score, taskId, timestamp: Date.now(), niche });
  modelData.totalRatings += 1;
  modelData.totalScore += score;
  modelData.averageScore = modelData.totalScore / modelData.totalRatings;

  await atomicWriteJSON(ratingsPath, ratings);
}

export async function getRating(modelId: string): Promise<{ averageScore: number, totalRatings: number } | null> {
  const ratings = await readJSON<any>(ratingsPath, {});
  if (ratings[modelId]) {
    return { averageScore: ratings[modelId].averageScore, totalRatings: ratings[modelId].totalRatings };
  }
  return null;
}

export async function getAllRatings(): Promise<Record<string, { averageScore: number, totalRatings: number }>> {
  const ratings = await readJSON<any>(ratingsPath, {});
  const summary: Record<string, { averageScore: number, totalRatings: number }> = {};
  for (const [key, val] of Object.entries<any>(ratings)) {
    summary[key] = { averageScore: val.averageScore, totalRatings: val.totalRatings };
  }
  return summary;
}

export async function getRatingsData(): Promise<any> {
  return await readJSON<any>(ratingsPath, {});
}

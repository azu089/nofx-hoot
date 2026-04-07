/**
 * BM25 记忆系统 - 1:1 对应 Python TradingAgents FinancialSituationMemory
 *
 * 使用 BM25 (Best Matching 25) 算法进行文本相似度匹配
 * 纯 TypeScript 实现，零外部依赖，离线工作
 */

import fs from 'fs';
import path from 'path';

interface MemoryMatch {
  matched_situation: string;
  recommendation: string;
  similarity_score: number;
}

/**
 * BM25 算法实现
 * 公式：score = Σ IDF(qi) * (tf(qi,D) * (k1+1)) / (tf(qi,D) + k1 * (1 - b + b * |D|/avgdl))
 */
class BM25 {
  private k1 = 1.5;
  private b = 0.75;
  private documents: string[][] = [];
  private avgdl = 0;
  private docCount = 0;
  private idfCache: Map<string, number> = new Map();

  init(docs: string[]): void {
    this.documents = docs.map(d => this.tokenize(d));
    this.docCount = this.documents.length;
    if (this.docCount === 0) {
      this.avgdl = 0;
      return;
    }
    const totalLen = this.documents.reduce((sum, d) => sum + d.length, 0);
    this.avgdl = totalLen / this.docCount;
    this.idfCache.clear();
  }

  getScores(query: string): number[] {
    if (this.docCount === 0) return [];
    const queryTokens = this.tokenize(query);
    const scores: number[] = [];

    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      let score = 0;
      for (const qt of queryTokens) {
        const idf = this.getIDF(qt);
        const tf = doc.filter(t => t === qt).length;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgdl));
        score += idf * (numerator / denominator);
      }
      scores.push(score);
    }
    return scores;
  }

  private getIDF(term: string): number {
    if (this.idfCache.has(term)) return this.idfCache.get(term)!;
    const docsWithTerm = this.documents.filter(d => d.includes(term)).length;
    const idf = Math.log((this.docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
    this.idfCache.set(term, idf);
    return idf;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }
}

/**
 * 金融场景记忆系统
 * 对应 Python: FinancialSituationMemory
 */
export class FinancialSituationMemory {
  name: string;
  private documents: string[] = [];
  private recommendations: string[] = [];
  private bm25: BM25 = new BM25();
  private persistPath: string | null;

  constructor(name: string, config?: { results_dir?: string }) {
    this.name = name;
    if (config?.results_dir) {
      this.persistPath = path.join(config.results_dir, `memory_${name}.json`);
      this.load();
    } else {
      this.persistPath = null;
    }
  }

  addSituations(situationsAndAdvice: Array<[string, string]>): void {
    for (const [situation, recommendation] of situationsAndAdvice) {
      this.documents.push(situation);
      this.recommendations.push(recommendation);
    }
    this.rebuildIndex();
    this.save();
  }

  getMemories(currentSituation: string, nMatches: number = 1): MemoryMatch[] {
    if (this.documents.length === 0) return [];

    const scores = this.bm25.getScores(currentSituation);
    const maxScore = Math.max(...scores) || 1;

    // Get top-n indices sorted by score descending
    const indexed = scores.map((score, index) => ({ index, score }));
    indexed.sort((a, b) => b.score - a.score);
    const topN = indexed.slice(0, nMatches);

    return topN.map(({ index, score }) => ({
      matched_situation: this.documents[index],
      recommendation: this.recommendations[index],
      similarity_score: maxScore > 0 ? score / maxScore : 0,
    }));
  }

  clear(): void {
    this.documents = [];
    this.recommendations = [];
    this.rebuildIndex();
  }

  private rebuildIndex(): void {
    this.bm25.init(this.documents);
  }

  private save(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify({
        documents: this.documents,
        recommendations: this.recommendations,
      }));
    } catch {
      // 静默失败
    }
  }

  private load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.documents = data.documents || [];
      this.recommendations = data.recommendations || [];
      this.rebuildIndex();
    } catch {
      // 静默失败
    }
  }
}

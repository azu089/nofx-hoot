// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package arena

import (
	"math"
	"regexp"
	"sort"
	"strings"
)

// ---------------------------------------------------------------------------
// FinancialMemory — BM25 记忆系统
// Implements the FinancialSituationMemory pattern from TradingAgents (ICAIF 2024).
// Uses BM25-Okapi lexical similarity — no external API or embedding required.
// ---------------------------------------------------------------------------

// BM25 超参数（与 rank_bm25.BM25Okapi 默认值一致）
const (
	bm25K1 = 1.5
	bm25B  = 0.75
)

// MemoryMatch 单条匹配结果
type MemoryMatch struct {
	MatchedSituation string  `json:"matched_situation"`
	Recommendation   string  `json:"recommendation"`
	SimilarityScore  float64 `json:"similarity_score"` // 归一化 0-1
}

// FinancialMemory 存储历史情境和对应建议，用 BM25 检索
type FinancialMemory struct {
	Name            string
	documents       []string   // 历史情境描述
	recommendations []string   // 对应的建议
	tokenizedDocs   [][]string // 预分词结果
	// BM25 预计算（在 rebuildIndex 中更新）
	docFreq  map[string]int // 每个 term 出现在多少文档中
	avgDL    float64        // 平均文档长度
	docCount int            // 文档总数
}

var tokenRegex = regexp.MustCompile(`\b\w+\b`)

// NewFinancialMemory 创建记忆实例
func NewFinancialMemory(name string) *FinancialMemory {
	return &FinancialMemory{
		Name:    name,
		docFreq: make(map[string]int),
	}
}

// tokenize 分词（小写 + 正则 \b\w+\b，与 Python 版一致）
func tokenize(text string) []string {
	return tokenRegex.FindAllString(strings.ToLower(text), -1)
}

// AddSituation 添加单条情境 + 建议
func (m *FinancialMemory) AddSituation(situation, recommendation string) {
	m.documents = append(m.documents, situation)
	m.recommendations = append(m.recommendations, recommendation)
	m.rebuildIndex()
}

// AddSituations 批量添加
func (m *FinancialMemory) AddSituations(pairs [][2]string) {
	for _, p := range pairs {
		m.documents = append(m.documents, p[0])
		m.recommendations = append(m.recommendations, p[1])
	}
	m.rebuildIndex()
}

// rebuildIndex 重建 BM25 索引（添加文档后调用）
func (m *FinancialMemory) rebuildIndex() {
	m.docCount = len(m.documents)
	m.tokenizedDocs = make([][]string, m.docCount)
	m.docFreq = make(map[string]int)

	totalLen := 0
	for i, doc := range m.documents {
		tokens := tokenize(doc)
		m.tokenizedDocs[i] = tokens
		totalLen += len(tokens)
		// 统计 doc freq（每个 term 在本文档只计一次）
		seen := make(map[string]bool)
		for _, t := range tokens {
			if !seen[t] {
				m.docFreq[t]++
				seen[t] = true
			}
		}
	}
	if m.docCount > 0 {
		m.avgDL = float64(totalLen) / float64(m.docCount)
	}
}

// GetMemories 检索最相似的 nMatches 条记忆
func (m *FinancialMemory) GetMemories(currentSituation string, nMatches int) []MemoryMatch {
	if m.docCount == 0 {
		return nil
	}

	queryTokens := tokenize(currentSituation)
	scores := m.bm25Scores(queryTokens)

	// 找最大分数用于归一化
	maxScore := 0.0
	for _, s := range scores {
		if s > maxScore {
			maxScore = s
		}
	}

	// 按分数降序排序
	type indexedScore struct {
		idx   int
		score float64
	}
	ranked := make([]indexedScore, len(scores))
	for i, s := range scores {
		ranked[i] = indexedScore{idx: i, score: s}
	}
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].score > ranked[j].score
	})

	// 取 top-n
	if nMatches > len(ranked) {
		nMatches = len(ranked)
	}
	results := make([]MemoryMatch, 0, nMatches)
	for i := 0; i < nMatches; i++ {
		idx := ranked[i].idx
		norm := 0.0
		if maxScore > 0 {
			norm = ranked[i].score / maxScore
		}
		results = append(results, MemoryMatch{
			MatchedSituation: m.documents[idx],
			Recommendation:   m.recommendations[idx],
			SimilarityScore:  norm,
		})
	}
	return results
}

// bm25Scores 计算 query 对所有文档的 BM25 分数
func (m *FinancialMemory) bm25Scores(queryTokens []string) []float64 {
	scores := make([]float64, m.docCount)
	N := float64(m.docCount)

	for _, qt := range queryTokens {
		df, ok := m.docFreq[qt]
		if !ok {
			continue
		}
		// IDF = ln((N - df + 0.5) / (df + 0.5) + 1)  — BM25 Okapi 标准公式
		idf := math.Log((N-float64(df)+0.5)/(float64(df)+0.5) + 1.0)

		for i, docTokens := range m.tokenizedDocs {
			// 统计 term 在文档中的频次
			tf := 0
			for _, dt := range docTokens {
				if dt == qt {
					tf++
				}
			}
			if tf == 0 {
				continue
			}
			dl := float64(len(docTokens))
			// BM25 score = IDF * (tf * (k1+1)) / (tf + k1 * (1 - b + b * dl/avgDL))
			num := float64(tf) * (bm25K1 + 1.0)
			denom := float64(tf) + bm25K1*(1.0-bm25B+bm25B*dl/m.avgDL)
			scores[i] += idf * num / denom
		}
	}
	return scores
}

// Clear 清空所有记忆
func (m *FinancialMemory) Clear() {
	m.documents = nil
	m.recommendations = nil
	m.tokenizedDocs = nil
	m.docFreq = make(map[string]int)
	m.avgDL = 0
	m.docCount = 0
}

// Count 返回当前存储的记忆条数
func (m *FinancialMemory) Count() int {
	return m.docCount
}

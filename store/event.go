// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package store

// event.go — Event intelligence storage layer.
//
// 5 tables: event_sources, event_items, event_signals, event_decision_logs, event_provider_cache

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ─── Constants ──────────────────────────────────────────────────────────────

const (
	EventSourceTypeManual = "manual"
	EventSourceTypeRSS    = "rss"

	EventSignalStatusPending  = "pending"
	EventSignalStatusActive   = "active"
	EventSignalStatusDecaying = "decaying"
	EventSignalStatusExpired  = "expired"
	EventSignalStatusRejected = "rejected"
)

// ─── Models ─────────────────────────────────────────────────────────────────

// EventSource represents a configured event data source.
type EventSource struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"column:name;not null;uniqueIndex" json:"name"`
	Type        string    `gorm:"column:type;not null" json:"type"` // "manual" | "rss"
	URL         string    `gorm:"column:url;default:''" json:"url"`
	Enabled     bool      `gorm:"column:enabled;default:true" json:"enabled"`
	RefreshSecs int       `gorm:"column:refresh_secs;default:300" json:"refresh_secs"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (EventSource) TableName() string { return "event_sources" }

// EventItem represents a raw event fetched from a source.
type EventItem struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	SourceID    int64     `gorm:"column:source_id;not null;index" json:"source_id"`
	Title       string    `gorm:"column:title;not null" json:"title"`
	Content     string    `gorm:"column:content;type:text" json:"content"`
	PublishedAt time.Time `gorm:"column:published_at" json:"published_at"`
	RawJSON     string    `gorm:"column:raw_json;type:text" json:"raw_json"`
	Hash        string    `gorm:"column:hash;not null;uniqueIndex" json:"hash"` // SHA1 dedup key
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (EventItem) TableName() string { return "event_items" }

// EventSignalRecord is the DB representation of a normalized event signal.
// Named *Record to avoid conflict with kernel.EventSignal.
type EventSignalRecord struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ItemID          int64     `gorm:"column:item_id;index" json:"item_id"`
	Category        string    `gorm:"column:category;not null;index" json:"category"` // macro/regulation/exchange/protocol/geopolitics
	Severity        int       `gorm:"column:severity;not null" json:"severity"`       // 1-5
	Direction       string    `gorm:"column:direction;default:'neutral'" json:"direction"` // risk_off/risk_on/neutral
	Scope           string    `gorm:"column:scope;default:'market'" json:"scope"`       // market/symbol
	AffectedSymbols string    `gorm:"column:affected_symbols;default:''" json:"affected_symbols"` // comma-separated
	Confidence      float64   `gorm:"column:confidence;default:0.5" json:"confidence"`
	SourceType      string    `gorm:"column:source_type;default:''" json:"source_type"`
	SourceName      string    `gorm:"column:source_name;default:''" json:"source_name"`
	Summary         string    `gorm:"column:summary;type:text" json:"summary"`
	Status          string    `gorm:"column:status;default:'active';index" json:"status"`
	StartsAt        time.Time `gorm:"column:starts_at" json:"starts_at"`
	EndsAt          time.Time `gorm:"column:ends_at" json:"ends_at"`
	DecayMinutes    int       `gorm:"column:decay_minutes;default:60" json:"decay_minutes"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (EventSignalRecord) TableName() string { return "event_signals" }

// GetAffectedSymbolsList parses the comma-separated AffectedSymbols field.
func (r *EventSignalRecord) GetAffectedSymbolsList() []string {
	if r.AffectedSymbols == "" {
		return nil
	}
	parts := strings.Split(r.AffectedSymbols, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// SetAffectedSymbolsList sets the AffectedSymbols from a slice.
func (r *EventSignalRecord) SetAffectedSymbolsList(symbols []string) {
	r.AffectedSymbols = strings.Join(symbols, ",")
}

// EventDecisionLog records a trading decision influenced by an event.
type EventDecisionLog struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	SignalID  int64     `gorm:"column:signal_id;index" json:"signal_id"`
	TraderID  string    `gorm:"column:trader_id;index" json:"trader_id"`
	Symbol    string    `gorm:"column:symbol" json:"symbol"`
	Action    string    `gorm:"column:action" json:"action"` // block_open/threshold_raise/allow
	RuleCode  string    `gorm:"column:rule_code" json:"rule_code"`
	Before    string    `gorm:"column:before;type:text" json:"before"` // JSON
	After     string    `gorm:"column:after;type:text" json:"after"`   // JSON
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (EventDecisionLog) TableName() string { return "event_decision_logs" }

// EventProviderCache tracks fetch state for each source.
type EventProviderCache struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	SourceID     int64     `gorm:"column:source_id;not null;uniqueIndex" json:"source_id"`
	LastFetchAt  time.Time `gorm:"column:last_fetch_at" json:"last_fetch_at"`
	ETag         string    `gorm:"column:etag;default:''" json:"etag"`
	LastModified string    `gorm:"column:last_modified;default:''" json:"last_modified"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (EventProviderCache) TableName() string { return "event_provider_cache" }

// ─── EventStore ─────────────────────────────────────────────────────────────

// EventStore manages event intelligence data.
type EventStore struct {
	db *gorm.DB
}

// NewEventStore creates a new EventStore.
func NewEventStore(db *gorm.DB) *EventStore {
	return &EventStore{db: db}
}

// InitTables creates all event tables.
func (s *EventStore) InitTables() error {
	if err := s.db.AutoMigrate(
		&EventSource{},
		&EventItem{},
		&EventSignalRecord{},
		&EventDecisionLog{},
		&EventProviderCache{},
	); err != nil {
		return fmt.Errorf("failed to migrate event tables: %w", err)
	}
	return nil
}

// EnsureManualSource creates the default MANUAL_DESK source if not exists.
func (s *EventStore) EnsureManualSource() error {
	var count int64
	s.db.Model(&EventSource{}).Where("name = ?", "MANUAL_DESK").Count(&count)
	if count > 0 {
		return nil
	}
	src := EventSource{
		Name:    "MANUAL_DESK",
		Type:    EventSourceTypeManual,
		Enabled: true,
	}
	return s.db.Create(&src).Error
}

// ─── Source CRUD ─────────────────────────────────────────────────────────────

func (s *EventStore) ListSources() ([]EventSource, error) {
	var sources []EventSource
	err := s.db.Order("id ASC").Find(&sources).Error
	return sources, err
}

func (s *EventStore) GetSource(id int64) (*EventSource, error) {
	var src EventSource
	err := s.db.First(&src, id).Error
	if err != nil {
		return nil, err
	}
	return &src, nil
}

func (s *EventStore) GetSourceByName(name string) (*EventSource, error) {
	var src EventSource
	err := s.db.Where("name = ?", name).First(&src).Error
	if err != nil {
		return nil, err
	}
	return &src, nil
}

func (s *EventStore) CreateSource(src *EventSource) error {
	return s.db.Create(src).Error
}

func (s *EventStore) UpdateSource(src *EventSource) error {
	return s.db.Save(src).Error
}

// ─── Provider Cache ─────────────────────────────────────────────────────────

func (s *EventStore) UpsertProviderCache(sourceID int64, etag, lastModified string) error {
	cache := EventProviderCache{
		SourceID:     sourceID,
		LastFetchAt:  time.Now().UTC(),
		ETag:         etag,
		LastModified: lastModified,
	}
	return s.db.Where("source_id = ?", sourceID).Assign(cache).FirstOrCreate(&cache).Error
}

func (s *EventStore) GetProviderCache(sourceID int64) (*EventProviderCache, error) {
	var cache EventProviderCache
	err := s.db.Where("source_id = ?", sourceID).First(&cache).Error
	if err != nil {
		return nil, err
	}
	return &cache, nil
}

// ─── Item CRUD ──────────────────────────────────────────────────────────────

func (s *EventStore) CreateItem(item *EventItem) error {
	return s.db.Create(item).Error
}

func (s *EventStore) ItemExistsByHash(hash string) (bool, error) {
	var count int64
	err := s.db.Model(&EventItem{}).Where("hash = ?", hash).Count(&count).Error
	return count > 0, err
}

func (s *EventStore) ListItems(sourceID int64, limit int) ([]EventItem, error) {
	var items []EventItem
	err := s.db.Where("source_id = ?", sourceID).Order("published_at DESC").Limit(limit).Find(&items).Error
	return items, err
}

// ─── Signal CRUD ────────────────────────────────────────────────────────────

func (s *EventStore) CreateSignal(sig *EventSignalRecord) error {
	return s.db.Create(sig).Error
}

func (s *EventStore) GetSignal(id int64) (*EventSignalRecord, error) {
	var sig EventSignalRecord
	err := s.db.First(&sig, id).Error
	if err != nil {
		return nil, err
	}
	return &sig, nil
}

func (s *EventStore) SetSignalStatus(id int64, status string) error {
	return s.db.Model(&EventSignalRecord{}).Where("id = ?", id).Update("status", status).Error
}

// ListActiveSignals returns signals that are currently active (within time window).
func (s *EventStore) ListActiveSignals(now time.Time) ([]EventSignalRecord, error) {
	var signals []EventSignalRecord
	err := s.db.Where("status IN ? AND starts_at <= ? AND ends_at >= ?",
		[]string{EventSignalStatusActive, EventSignalStatusDecaying},
		now, now,
	).Order("severity DESC").Find(&signals).Error
	return signals, err
}

// ListWindowSignals returns all signals within a time window.
func (s *EventStore) ListWindowSignals(from, to time.Time) ([]EventSignalRecord, error) {
	var signals []EventSignalRecord
	err := s.db.Where("starts_at <= ? AND ends_at >= ?", to, from).
		Order("severity DESC").Find(&signals).Error
	return signals, err
}

// ─── Decision Log ───────────────────────────────────────────────────────────

func (s *EventStore) CreateDecisionLog(log *EventDecisionLog) error {
	return s.db.Create(log).Error
}

func (s *EventStore) ListDecisionLogs(traderID string, limit int) ([]EventDecisionLog, error) {
	var logs []EventDecisionLog
	err := s.db.Where("trader_id = ?", traderID).Order("created_at DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

// ─── Utility ────────────────────────────────────────────────────────────────

// EncodeJSONString encodes a value to JSON string for storage.
func EncodeJSONString(v interface{}) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// DecodeStringSlice decodes a comma-separated string into a string slice.
func DecodeStringSlice(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

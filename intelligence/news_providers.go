// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package intelligence

// news_providers.go — Event data source providers.
//
// EventProvider interface + ManualProvider (no-op) + RSSProvider (RSS/Atom).

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"nofx/store"
)

// ─── FetchedEventItem ───────────────────────────────────────────────────────

// FetchedEventItem is a raw event item fetched from a provider.
type FetchedEventItem struct {
	Title       string
	Content     string
	Link        string
	PublishedAt time.Time
}

// ─── EventProvider ──────────────────────────────────────────────────────────

// EventProvider abstracts event data sources.
type EventProvider interface {
	Fetch(ctx context.Context, source store.EventSource) ([]FetchedEventItem, error)
}

// ─── ManualProvider ─────────────────────────────────────────────────────────

// ManualProvider is a no-op provider. Manual events are created via API.
type ManualProvider struct{}

func (ManualProvider) Fetch(_ context.Context, _ store.EventSource) ([]FetchedEventItem, error) {
	return nil, nil
}

// ─── RSSProvider ────────────────────────────────────────────────────────────

// RSSProvider fetches and parses RSS/Atom feeds.
type RSSProvider struct {
	client *http.Client
}

// NewRSSProvider creates a new RSS provider with sensible defaults.
func NewRSSProvider() *RSSProvider {
	return &RSSProvider{
		client: &http.Client{Timeout: 12 * time.Second},
	}
}

// Fetch retrieves items from an RSS or Atom feed.
func (p *RSSProvider) Fetch(ctx context.Context, source store.EventSource) ([]FetchedEventItem, error) {
	if source.URL == "" {
		return nil, fmt.Errorf("RSS source %q has no URL", source.Name)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", source.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "nofx-event-engine/1.0")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, source.URL)
	}

	// Limit response to 2MB
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	items, err := parseRSSOrAtom(body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse feed: %w", err)
	}

	// Limit to 30 items
	if len(items) > 30 {
		items = items[:30]
	}

	return items, nil
}

// ─── RSS/Atom XML structures ────────────────────────────────────────────────

type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Items []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
}

type atomFeed struct {
	XMLName xml.Name   `xml:"feed"`
	Entries []atomEntry `xml:"entry"`
}

type atomEntry struct {
	Title     string   `xml:"title"`
	Link      atomLink `xml:"link"`
	Summary   string   `xml:"summary"`
	Content   string   `xml:"content"`
	Published string   `xml:"published"`
	Updated   string   `xml:"updated"`
}

type atomLink struct {
	Href string `xml:"href,attr"`
}

func parseRSSOrAtom(data []byte) ([]FetchedEventItem, error) {
	// Try RSS first
	var rss rssFeed
	if err := xml.Unmarshal(data, &rss); err == nil && len(rss.Channel.Items) > 0 {
		var items []FetchedEventItem
		for _, ri := range rss.Channel.Items {
			items = append(items, FetchedEventItem{
				Title:       ri.Title,
				Content:     ri.Description,
				Link:        ri.Link,
				PublishedAt: parseFlexDate(ri.PubDate),
			})
		}
		return items, nil
	}

	// Try Atom
	var atom atomFeed
	if err := xml.Unmarshal(data, &atom); err == nil && len(atom.Entries) > 0 {
		var items []FetchedEventItem
		for _, ae := range atom.Entries {
			content := ae.Content
			if content == "" {
				content = ae.Summary
			}
			pubDate := ae.Published
			if pubDate == "" {
				pubDate = ae.Updated
			}
			items = append(items, FetchedEventItem{
				Title:       ae.Title,
				Content:     content,
				Link:        ae.Link.Href,
				PublishedAt: parseFlexDate(pubDate),
			})
		}
		return items, nil
	}

	return nil, fmt.Errorf("unrecognized feed format")
}

// parseFlexDate tries multiple date formats.
func parseFlexDate(s string) time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Now().UTC()
	}
	for _, layout := range []string{
		time.RFC1123Z,
		time.RFC3339,
		time.RFC1123,
		time.RFC822Z,
		time.RFC822,
		time.RFC850,
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC()
		}
	}
	return time.Now().UTC()
}

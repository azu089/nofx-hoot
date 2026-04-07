package store

import (
	"fmt"

	"gorm.io/gorm"
	"nofx/logger"
)

// columnExists checks if a column exists in a table.
func columnExists(db *gorm.DB, table, column string) bool {
	dialector := db.Dialector.Name()

	var count int64
	switch dialector {
	case "postgres":
		db.Raw(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?`, table, column).Scan(&count)
	case "sqlite":
		// SQLite: use PRAGMA table_info
		rows, err := db.Raw(fmt.Sprintf("PRAGMA table_info(%s)", table)).Rows()
		if err != nil {
			return false
		}
		defer rows.Close()
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull int
			var dfltValue *string
			var pk int
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
				continue
			}
			if name == column {
				return true
			}
		}
		return false
	default:
		// MySQL and others
		db.Raw(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?`, table, column).Scan(&count)
	}
	return count > 0
}

// addColumnIfNotExists adds a column to a table if it doesn't already exist.
// colDef is the SQL column definition, e.g. "open_timestamp BIGINT DEFAULT 0".
func addColumnIfNotExists(db *gorm.DB, table, column, colDef string) error {
	if columnExists(db, table, column) {
		return nil
	}

	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s", table, colDef)
	if err := db.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to add column %s.%s: %w", table, column, err)
	}

	logger.Infof("[MIGRATE] Added column %s.%s", table, column)
	return nil
}

// RunMigrations runs all HOOT-specific migrations on startup.
// Safe to call multiple times — skips columns that already exist.
func RunMigrations(db *gorm.DB) error {
	// TraderPosition: open_timestamp for hold time tracking
	if err := addColumnIfNotExists(db, "trader_positions", "open_timestamp", "open_timestamp BIGINT DEFAULT 0"); err != nil {
		return err
	}

	// Backfill: set open_timestamp = entry_time / 1000 for existing rows where open_timestamp is 0
	result := db.Exec(`UPDATE trader_positions SET open_timestamp = entry_time / 1000 WHERE open_timestamp = 0 AND entry_time > 0`)
	if result.Error != nil {
		logger.Infof("[MIGRATE] Backfill open_timestamp warning: %v", result.Error)
	} else if result.RowsAffected > 0 {
		logger.Infof("[MIGRATE] Backfilled open_timestamp for %d rows", result.RowsAffected)
	}

	return nil
}

package api

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"nofx/store"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// internalUpsertUserReq is the JSON body accepted by POST /api/internal/users/upsert.
//
// id is required and is the upstream platform's stable user identifier; it becomes
// the nofx primary key, enabling a 1:1 mapping without any indirection table.
// email may be a real address or a synthetic placeholder; the unique index on
// users(email) means upstream must guarantee uniqueness.
type internalUpsertUserReq struct {
	ID    string `json:"id" binding:"required"`
	Email string `json:"email" binding:"required"`
}

// handleInternalUpsertUser provisions or refreshes a "shadow user" record on
// behalf of the upstream business platform. It is the only path by which
// upstream accounts come into existence in nofx, so the boundary stays clean:
// nofx never originates a user, it only ever observes one that the upstream platform has already
// authenticated.
//
// Authentication: a service-level shared secret in X-Internal-Token, validated
// against HOOT_INTERNAL_TOKEN env via constant-time compare. This route is NOT
// covered by authMiddleware because authMiddleware's internal path requires
// X-User-Id to already resolve in the DB — which is exactly what this endpoint
// is here to bootstrap.
//
// Password column is set to a high-entropy random bcrypt hash. The shadow user
// is never expected to log into nofx directly (the upstream platform owns the login surface),
// but a real hash prevents any future "blank password" regression.
func (s *Server) handleInternalUpsertUser(c *gin.Context) {
	expected := os.Getenv("HOOT_INTERNAL_TOKEN")
	if expected == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "internal auth not configured"})
		return
	}
	provided := c.GetHeader("X-Internal-Token")
	a := []byte(provided)
	b := []byte(expected)
	if len(a) == 0 || len(a) != len(b) || subtle.ConstantTimeCompare(a, b) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid internal token"})
		return
	}

	var req internalUpsertUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	req.ID = strings.TrimSpace(req.ID)
	req.Email = strings.TrimSpace(req.Email)
	if req.ID == "" || req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id and email are required"})
		return
	}

	existing, err := s.store.User().GetByID(req.ID)
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup failed"})
		return
	}
	if existing != nil {
		// Idempotent: refresh email if upstream changed it, otherwise no-op.
		if existing.Email != req.Email {
			if err := s.store.User().UpdateEmail(req.ID, req.Email); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"created": false, "id": req.ID})
		return
	}

	hash, err := generateRandomBcryptHash()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}

	user := &store.User{
		ID:           req.ID,
		Email:        req.Email,
		PasswordHash: hash,
	}
	if err := s.store.User().Create(user); err != nil {
		// Treat unique-constraint races as success (concurrent upsert from
		// register + lazy proxy path).
		if isUniqueViolation(err) {
			c.JSON(http.StatusOK, gin.H{"created": false, "id": req.ID})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"created": true, "id": req.ID})
}

// generateRandomBcryptHash returns a bcrypt hash of a 32-byte random secret.
// The plaintext is discarded — no caller will ever need it, since shadow users
// authenticate solely via the internal-token + X-User-Id path.
func generateRandomBcryptHash() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	plain := hex.EncodeToString(buf)
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// isUniqueViolation matches the SQLite + Postgres flavors of unique-index errors
// without importing driver-specific packages.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}

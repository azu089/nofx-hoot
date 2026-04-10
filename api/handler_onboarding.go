// Modified by nofx contributors (2025-2026)
// Original: https://github.com/NoFxAiOS/nofx
// License: AGPL-3.0

package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// The beginner-onboarding flow used to provision a fresh claw402/Base USDC
// wallet for new users so that AI calls could be paid via the x402 protocol.
// claw402 has been retired; these endpoints now return a "feature disabled"
// response and the routes are kept registered only to avoid breaking older
// frontends that may still call them.

type beginnerOnboardingResponse struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message"`
}

type currentBeginnerWalletResponse struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message"`
}

func (s *Server) handleBeginnerOnboarding(c *gin.Context) {
	c.JSON(http.StatusOK, beginnerOnboardingResponse{
		Enabled: false,
		Message: "beginner onboarding (claw402) is disabled",
	})
}

func (s *Server) handleCurrentBeginnerWallet(c *gin.Context) {
	c.JSON(http.StatusOK, currentBeginnerWalletResponse{
		Enabled: false,
		Message: "beginner wallet (claw402) is disabled",
	})
}

// checkClaw402Health is retained as a stub so handler_wallet.go can compile
// without referencing the deleted claw402 health probe.
func checkClaw402Health() string {
	return "disabled"
}

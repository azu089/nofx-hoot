package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Wallet endpoints used to drive the claw402 / Base USDC funding flow.
// claw402 has been retired; the routes remain registered but each handler
// returns {enabled: false, ...} so existing frontends fail closed cleanly.
//
// checkClaw402Health() lives in handler_onboarding.go and now returns the
// constant "disabled".

type walletStubResponse struct {
	Enabled bool   `json:"enabled"`
	Message string `json:"message"`
}

func (s *Server) handleWalletValidate(c *gin.Context) {
	c.JSON(http.StatusOK, walletStubResponse{
		Enabled: false,
		Message: "wallet validation (claw402) is disabled",
	})
}

func (s *Server) handleWalletGenerate(c *gin.Context) {
	c.JSON(http.StatusOK, walletStubResponse{
		Enabled: false,
		Message: "wallet generation (claw402) is disabled",
	})
}

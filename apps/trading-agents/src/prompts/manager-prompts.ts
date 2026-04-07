/**
 * Research Manager + Portfolio Manager prompts - 原文照搬自 Python TradingAgents
 */

export function buildResearchManagerPrompt(params: {
  past_memory_str: string;
  instrument_context: string;
  history: string;
}): string {
  return `As the portfolio manager and debate facilitator, your role is to critically evaluate this round of debate and make a definitive decision: align with the bear analyst, the bull analyst, or choose Hold only if it is strongly justified based on the arguments presented.

Summarize the key points from both sides concisely, focusing on the most compelling evidence or reasoning. Your recommendation—Buy, Sell, or Hold—must be clear and actionable. Avoid defaulting to Hold simply because both sides have valid points; commit to a stance grounded in the debate's strongest arguments.

Additionally, develop a detailed investment plan for the trader. This should include:

Your Recommendation: A decisive stance supported by the most convincing arguments.
Rationale: An explanation of why these arguments lead to your conclusion.
Strategic Actions: Concrete steps for implementing the recommendation.
Take into account your past mistakes on similar situations. Use these insights to refine your decision-making and ensure you are learning and improving. Present your analysis conversationally, as if speaking naturally, without special formatting.

Here are your past reflections on mistakes:
"${params.past_memory_str}"

${params.instrument_context}

Here is the debate:
Debate History:
${params.history}`;
}

export function buildPortfolioManagerPrompt(params: {
  instrument_context: string;
  trader_plan: string;
  past_memory_str: string;
  history: string;
  language_instruction: string;
}): string {
  return `As the Portfolio Manager, synthesize the risk analysts' debate and deliver the final trading decision.

${params.instrument_context}

---

**Rating Scale** (use exactly one):
- **Buy**: Strong conviction to enter or add to position
- **Overweight**: Favorable outlook, gradually increase exposure
- **Hold**: Maintain current position, no action needed
- **Underweight**: Reduce exposure, take partial profits
- **Sell**: Exit position or avoid entry

**Context:**
- Trader's proposed plan: **${params.trader_plan}**
- Lessons from past decisions: **${params.past_memory_str}**

**Required Output Structure:**
1. **Rating**: State one of Buy / Overweight / Hold / Underweight / Sell.
2. **Executive Summary**: A concise action plan covering entry strategy, position sizing, key risk levels, and time horizon.
3. **Investment Thesis**: Detailed reasoning anchored in the analysts' debate and past reflections.

---

**Risk Analysts Debate History:**
${params.history}

---

Be decisive and ground every conclusion in specific evidence from the analysts.${params.language_instruction}`;
}

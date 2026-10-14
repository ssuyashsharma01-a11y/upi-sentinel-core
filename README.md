# UPI Sentinel: Intent-to-Action Disparity Engine (IADE)

> Client-Side Cognitive Friction HUD for UPI Reverse-Charge Fraud Prevention

UPI Sentinel is a deterministic evaluation prototype designed to detect and flag intent-to-action disparities in UPI payment workflows. It evaluates discrepancies between unstructured communication context (e.g., chat promises of receiving funds/refunds) and the actual transaction payload (upi://pay URI).

---

## Operational Boundary & Scope

* Client-Side Advisory Only: UPI Sentinel operates as a pre-authorization advisory layer (simulated companion / checkout SDK). It does not intercept core-banking rails or modify NPCI switch transactions.
* Disparity vs Identity: The engine verifies syntactic and directional alignment between stated intent and payload debits. It does not assert off-chain legal identity or KYC records of beneficiaries.
* No False Enforcement Claims: Flags are surfaced as client-side cognitive friction (warnings and contextual breakdowns), not automated fund seizures.

---

## Architecture & Core Rules Contract

[Chat / Message Context]  ----+
                              +--> [IADE Intent & Heuristic Rules] --> [Disparity Matrix] --> [Pre-Auth Warning HUD]
[Raw UPI Payload String] -----+

1. Protocol Rigor: Rejects malformed schemes, duplicate query parameters (am=100&am=5000), and non-INR currencies (cu!=INR).
2. Currency Standardization: Enforces Western (1,000,000) and Indian (1,50,000) comma formatting; explicitly drops malformed amounts (e.g., 5,00) and negative currency values.
3. Perspective-Aware Intent: Distinguishes counterparty claims ("Maine bhej diya") from victim directives ("PIN dalo to receive"), classifying incoming promises as expected credits.
4. Coercion Suppression Rule: Explicit panic triggers (power disconnected, account blocked) suppress standard send clearance and demote verdict to INSUFFICIENT_CONTEXT.

---

## Deterministic Benchmark Evaluation

The project includes a 10-fixture synthetic test suite (test_fixtures.json) calibrated across reverse-charge scams, extortion urgency, benign payments, and malformed URI edge cases.

To run the deterministic CLI benchmark:

python eval_engine.py

Metrics Definition:
* Exact-Verdict Match: Strict multi-class accuracy across all 10 distinct test fixtures.
* Threat Precision: TP / (TP + FP) evaluated against synthetic attack patterns.
* Attack Recall: TP / (TP + FN) on known deception vectors.

---

## Running the Frontend Prototype

# Install dependencies
npm install

# Start local development server
npm run dev

Open http://localhost:5173 in your browser.

---

## Repository Structure

* eval_engine.py       : Python CLI deterministic evaluator & benchmark runner
* test_fixtures.json   : Single source of truth for benchmark evaluation
* src/App.jsx          : React prototype with sandbox, simulated HUD, & logs
* src/index.css        : Tailwind styling layer
* src/main.jsx         : Application entrypoint
* package.json
* README.md
# 🛡️ UPI Sentinel

> **Client-Side, Zero-Server Payment-Intent Disparity & Anomaly Inspection Utility**

[![Vercel Deployment](https://img.shields.io/badge/Deployment-Live%20on%20Vercel-000000?style=for-the-badge&logo=vercel)](https://upi-sentinel-core.vercel.app/)
[![Vitest Invariants](https://img.shields.io/badge/Tests-65%2F65%20Passing-brightgreen?style=for-the-badge&logo=vitest)](https://github.com/ssuyashsharma01-a11y/upi-sentinel-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Client Privacy](https://img.shields.io/badge/Privacy-Local--First%20Engine-purple?style=for-the-badge)](#privacy--threat-model)

🔗 **Live Production App:** [https://upi-sentinel-core.vercel.app/](https://upi-sentinel-core.vercel.app/)

---

## 🎯 Executive Overview

Over ₹1,750+ Cr in annual UPI fraud relies heavily on **social-engineering deception**—specifically reverse-charge traps where victims are misled into believing they must approve an incoming transfer or enter their UPI PIN to "receive" funds.

**UPI Sentinel** is a deterministic, client-side inspection tool that intercepts semantic discrepancies between **communicated payment intent** (e.g., "Receive advance", "Claim refund") and the **actual underlying payment action** specified in the payment URI (`upi://pay`).

### 🛡️ Positioning & Architectural Scope
* **What it is:** A local-first, rule-based heuristic inspection utility running entirely within the client's browser sandbox.
* **What it is NOT:** A cloud SIEM, banking API interceptor, recipient verification system, or absolute fraud prevention guarantee. It does not block transactions; it alerts users to semantic and syntactic conflict before manual PIN authorization.

---

## 🔬 Core Innovations & Architecture
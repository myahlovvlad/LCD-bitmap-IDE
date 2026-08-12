# Ambiguous Decisions — ECROS-5400UV Phase 0
Generated: 2026-08-12T08:12:48.238Z
1 state(s) could not be automatically renamed. Each requires user confirmation.

## Decision 1: `7-1-1-7-settings-dark-current-measured-copy-copy-copy-copy-copy-copy`
- **Title:** 7-1-1-7 Settings-Dark_current_measured Copy Copy Copy Copy Copy Copy
- **Subsystem:** settings
- **Proposed new ID:** `SET_DARKCURR_MEASURED_2` *(auto-suffixed)*
- **Conflict:** ID collision: "SET_DARKCURR_MEASURED" already claimed by "7-1-1-1-settings-dark-current-measur-process-copy". Auto-suffixed to "SET_DARKCURR_MEASURED_2". Both num-prefix and type-suffix strategies exhausted.
- **Evidence:** origin:user, title-derived, collision-numeric-suffix-from:SET_DARKCURR_MEASURED
**Action required:** Confirm `SET_DARKCURR_MEASURED_2` or provide preferred ID.

---

# Runtime routing decisions

## Decision 1: `FILE_GRP_QUANT_ANALYSIS_COEF` + `UI.ESC`
- **Transition:** `tr-file-group-photometry-water-select-copy-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-file-group-photometry-water-select-copy-file-group-quantitative-analysis-coefficients-copy-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.
## Decision 2: `FILE_GRP_KIN` + `UI.ESC`
- **Transition:** `tr-file-group-corr-copy-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-file-group-corr-copy-file-group-kinetics-copy-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.

## Decision 3: `FILE_GRP_QUANT_ANALYSIS` + `UI.ESC`
- **Transition:** `tr-file-group-multiwavelength-copy-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-file-group-multiwavelength-copy-6-2-10-mutliwavelength-measurement-zero-685-5-copy-copy-copy-copy-copy-copy-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.

## Decision 4: `SET_ABOUT_SYS_N191` + `UI.ESC`
- **Transition:** `tr-7-1-9-settings-about-system-copy-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-7-1-9-settings-about-system-copy-7-1-7-settings-d2-lamp-peripheriae-copy-copy-copy-copy-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.

## Decision 5: `PC_DISCONN` + `UI.ESC`
- **Transition:** `tr-pc-connected-copy-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-pc-connected-copy-SHARED-PC-CONNECTED-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.

## Decision 6: `SHARED_PRNT_DISC` + `UI.ESC`
- **Transition:** `tr-SHARED-PRINTER-DISCONNECTED-diagnostic-warming-copy-esc`
- **Expected target:** `MAINMNU_SEL_PHOT`
- **Conflict:** Indistinguishable sibling route selected: tr-SHARED-PRINTER-DISCONNECTED-SHARED-PRINTER-CONNECTED-esc. No guard or input discriminator exists.
- **Action required:** specify a guard, distinct HMI action, or authoritative target priority.

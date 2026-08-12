# ECROS-5400UV — ID Mapping (before migration)
Generated: 2026-08-12T08:12:48.233Z

## Summary
| Auto-renames | 298 | Ambiguous | 1 | High | 8 | Medium | 1 | Low | 289 |

## Auto-renames
| Old ID | New ID | Title | SVG Node | Confidence |
|---|---|---|---|---|
| `SYS-DIAGNOSTIC` | `DIAG_FILTER_PROC` | 1-1-1 Diagnostic-filter-process | DIAG_FILTER | high |
| `PHOT-MAIN-A` | `PHOT_A_MAIN_PREZERO` | 3-1-1 Photometry-A-Main-before zero | P_MAIN | high |
| `PHOT-SIGNAL` | `QUANT_CRV_MAIN` | 4-1 Quantitative-submode-curves | Q_MENU | medium |
| `SET-MAIN` | `SET_DARK_MAIN` | 7-1-1 Settings-Dark_current | S_MENU | high |
| `SHARED-PRINTER-CONNECTED` | `SHARED_PRNT_CONN` | Printer connected | — | high |
| `SHARED-PRINTER-DISCONNECTED` | `SHARED_PRNT_DISC` | Printer disconnected | — | high |
| `SHARED-PC-CONNECTED` | `SHARED_PC_CONN` | PC connected | — | high |
| `SHARED-USB-NOT-DETECTED` | `SHARED_USB_NO_DET` | USB-storage connected | — | high |
| `SHARED-PRINTER-NOT-DETECTED` | `SHARED_PRNT_NO_DET` | Printer not connected | — | high |
| `diagnostic-filter-process-copy` | `DIAG_FILTER_OK` | 1-1-2 Diagnostic-filter-success | — | low |
| `diagnostic-filter-success-copy` | `DIAG_FILTER_FAIL` | 1-1-3 Diagnostic-filter-fail | — | low |
| `diagnostic-filter-fail-copy` | `DIAG_LAMP_PROC` | 1-2-1 Diagnostic-lamps-process | — | low |
| `diagnostic-lamp-process-copy` | `DIAG_LAMP_OK` | 1-2-2 Diagnostic-lamps-success | — | low |
| `diagnostic-lamp-success-copy` | `DIAG_LAMP_FAIL` | 1-2-3 Diagnostic-lamps-fail | — | low |
| `diagnostic-lamp-fail-copy` | `DIAG_DET_PROC` | 1-3-1 Diagnostic-detector-process | — | low |
| `diagnostic-lamp-fail-copy-copy` | `DIAG_DET_FAIL` | 1-3-3 Diagnostic-detector-fail | — | low |
| `diagnostic-detector-process-copy` | `DIAG_DET_OK` | 1-3-2 Diagnostic-detector-success | — | low |
| `diagnostic-detector-fail-copy` | `DIAG_W_LAMP_PROC` | 1-4-1 Diagnostic-W-lamp-process | — | low |
| `diagnostic-w-lamp-process-copy` | `DIAG_W_LAMP_OK` | 1-4-2 Diagnostic-W-lamp-success | — | low |
| `diagnostic-w-lamp-process-copy-copy` | `DIAG_W_LAMP_FAIL` | 1-4-3 Diagnostic-W-lamp-fail | — | low |
| `diagnostic-w-lamp-fail-copy` | `DIAG_D2_LAMP_PROC` | 1-5-1 Diagnostic-D2-lamp-process | — | low |
| `diagnostic-d2-lamp-process-copy` | `DIAG_D2_LAMP_OK` | 1-5-2 Diagnostic-D2-lamp-success | — | low |
| `diagnostic-d2-lamp-success-copy` | `DIAG_D2_LAMP_FAIL` | 1-5-3 Diagnostic-D2-lamp-fail | — | low |
| `diagnostic-d2-lamp-fail-copy` | `DIAG_CALIBR_WL_PROC` | 1-6-1 Diagnostic-calibr wl-process | — | low |
| `diagnostic-calibr-wl-process-copy` | `DIAG_CALIBR_WL_OK` | 1-6-2 Diagnostic-calibr wl-success | — | low |
| `diagnostic-calibr-wl-success-copy` | `DIAG_CALIBR_WL_FAIL` | 1-6-3 Diagnostic-calibr wl-fail | — | low |
| `diagnostic-calibr-wl-fail-copy` | `DIAG_SYS_PROC` | 1-7-1 Diagnostic-system-process | — | low |
| `diagnostic-system-process-copy` | `DIAG_SYS_OK` | 1-7-2 Diagnostic-system-success | — | low |
| `diagnostic-system-success-copy` | `DIAG_SYS_FAIL` | 1-7-3 Diagnostic-system-fail | — | low |
| `diagnostic-system-success-copy-copy` | `DIAG_DARKCURR_PROC` | 1-8-1 Diagnostic-dark_current-proccess | — | low |
| `diagnostic-dark-current-proccess-copy` | `DIAG_DARKCURR_OK` | 1-8-2 Diagnostic-dark_current-success | — | low |
| `diagnostic-dark-current-success-copy` | `DIAG_DARKCURR_FAIL` | 1-8-3 Diagnostic-dark_current-fail | — | low |
| `diagnostic-dark-current-fail-copy` | `DIAG_WARM` | 1-9-1 Diagnostic-warming | — | low |
| `diagnostic-warming-copy` | `MAINMNU_SEL_PHOT` | 2-1-1 Main menu-select-photometry | — | low |
| `main-menu-select-photometry-copy` | `MAINMNU_SEL_QUANT` | 2-1-2 Main menu-select-quantitative | — | low |
| `main-menu-select-quantitative-copy` | `MAINMNU_SEL_MW` | 2-1-3 Main menu-select-multiwavelength | — | low |
| `main-menu-select-multiwavelength-copy` | `MAINMNU_SEL_KIN` | 2-1-4 Main menu-select-kinetics | — | low |
| `main-menu-select-kinetics-copy` | `MAINMNU_SEL_SET` | 2-1-5 Main menu-select-setup | — | low |
| `photometry-a-main-before-zero-copy` | `PHOT_E_MAIN_PREZERO` | 3-2-1 Photometry-E-Main-before zero | — | low |
| `photometry-t-main-before-zero-copy-copy` | `PHOT_T_MAIN_PREZERO` | 3-3-1 Photometry-T-Main-before zero | — | low |
| `photometry-a-main-before-zero-copy-2` | `PHOT_A_MAIN_ZERO_PROC` | 3-1-3 Photometry-A-Main-zero-process | — | low |
| `photometry-t-main-before-zero-copy-copy-2` | `PHOT_E_MAIN_ZERO_PROC` | 3-2-2 Photometry-E-Main-zero-process | — | low |
| `photometry-t-main-before-zero-copy` | `PHOT_T_MAIN_ZERO_PROC` | 3-3-2 Photometry-T-Main-zero-process | — | low |
| `photometry-a-main-before-zero-copy-3` | `PHOT_A_MAIN_ZERO_DONE` | 3-1-2 Photometry-A-Main-zero-done | — | low |
| `photometry-t-main-zero-process-copy` | `PHOT_IN_WL_PROC` | 3-4-1 Photometry-input_wl_process | — | low |
| `photometry-input-wl-process-copy` | `PHOT_IN_WL_IN` | 3-4-2 Photometry-input_wl_inputing | — | low |
| `main-menu-select-setup-copy` | `FILE_GRP_CORR` | 8-5 File_group-Corr_λ | — | low |
| `file-group-corr-copy` | `FILE_GRP_KIN` | 8-4 File_group-Kinetics | — | low |
| `file-group-kinetics-copy` | `FILE_GRP_MW` | 8-3 File_group-Multiwavelength | — | low |
| `file-group-multiwavelength-copy` | `FILE_GRP_QUANT_ANALYSIS` | 8-2 File_group-Quantitative_analysis | — | low |
| `file-group-quantitative-copy` | `FILE_GRP_PHOT` | 8-1 File_group-Photometry | — | low |
| `file-photometry-select-copy` | `FILE_GRP_PHOT_MN_SEL` | 8-1-1 File_group-Photometry-Mn-select | — | low |
| `file-photometry-select-copy-copy` | `FILE_PHOT_MN_OPEN` | 8-1-1-1 File_Photometry_Mn_open | — | low |
| `file-photometry-select-copy-copy-copy` | `8_FILE_STOR_NAVIGATOR` | 8-Files-storage navigator | — | low |
| `file-photometry-select-copy-copy-copy-copy-2` | `FILE_PHOT_MN_REN` | 8-1-1-2-1 File_Photometry_Mn_renaming | — | low |
| `file-photometry-select-copy-copy-copy-copy...` | `FILE_PHOT_MN_DELETING_NO` | 8-1-1-3-1 File_Photometry_Mn_deleting-No | — | low |
| `usb-storage-connected-copy` | `USB_STOR_DISCONN` | USB-storage disconnected | — | low |
| `photometry-input-wl-done-copy` | `PHOT_PAR_MODE` | 3-5-1 Photometry-parameters-mode | — | low |
| `photometry-input-wl-done-copy-copy` | `PHOT_PAR_PARLL_MEAS` | 3-5-2 Photometry-parameters-parall me... | — | low |
| `photometry-input-wl-done-copy-copy-copy` | `PHOT_PAR_MODE_A` | 3-5-1-1 Photometry-parameters-mode-A | — | low |
| `photometry-parameter-mode-copy` | `PHOT_PAR_MODE_T` | 3-5-1-2 Photometry-parameters-mode-T | — | low |
| `photometry-parameter-mode-copy-copy` | `PHOT_PAR_MODE_E` | 3-5-1-3 Photometry-parameters-mode-E | — | low |
| `photometry-parameter-mode-copy-copy-copy-copy` | `PHOT_PAR_MODE_E_IN_GAIN` | 3-5-1-3-1 Photometry-parameters-mode-... | — | low |
| `photometry-parameter-mode-copy-copy-copy-c...` | `PHOT_PAR_PARLL_MEAS_IN` | 3-5-2-1 Photometry-parameters-parall ... | — | low |
| `photometry-parameter-mode-copy-copy-copy-c...` | `PHOT_A_MEAS_N1_UNFIXED` | 3-6-1-1 Photometry-A-n-1-measurement-... | — | low |
| `file-group-photometry-mn-select-copy` | `FILE_GRP_PHOT_WATER_SEL` | 8-1-2 File_group-Photometry-water-select | — | low |
| `file-group-photometry-water-select-copy` | `FILE_GRP_QUANT_ANALYSIS_COEF` | 8-2-3 File_group-Quantitative_analysi... | — | low |
| `file-photometry-select-copy-copy-copy-3` | `FILE_PHOT_MN_INFO` | 8-1-1-5 File_Photometry_Mn_info | — | low |
| `file-group-quantitative-analysis-coefficie...` | `FILE_GRP_QUANT_ANALYSIS_RES` | 8-2-2 File_group-Quantitative_analysi... | — | low |
| `file-group-quantitative-analysis-coefficie...` | `FILE_GRP_QUANT_ANALYSIS_CRV` | 8-2-1 File_group-Quantitative_analysi... | — | low |
| `8-1-1-1-file-photometry-select-copy-copy-copy` | `FILE_PHOT_MN_REN_N112` | 8-1-1-2 File_Photometry_Mn_rename | — | low |
| `8-1-1-2-file-photometry-select-rename-copy` | `FILE_PHOT_MN_DEL` | 8-1-1-3 File_Photometry_Mn_delete | — | low |
| `8-1-1-3-file-photometry-select-delete-copy` | `FILE_PHOT_MN_IMP` | 8-1-1-6 File_Photometry_Mn_import | — | low |
| `8-1-1-4-file-photometry-select-export-usb-...` | `FILE_PHOT_MN_EXP_USB` | 8-1-1-4 File_Photometry_Mn_export-USB... | — | low |
| `file-photometry-select-copy-copy-copy-copy...` | `FILE_PHOT_MN_DELETING_YES` | 8-1-1-3-2 File_Photometry_Mn_deleting... | — | low |
| `8-1-1-2-1-file-photometry-mn-renaming-copy` | `FILE_PHOT_MN_REN_N122` | 8-1-1-2-2 File_Photometry_Mn_renaming | — | low |
| `8-1-1-file-group-photometry-mn-select-copy` | `8_1_EDIT_FILE_GRP_PHOT_MN_SEL` | 8-1-1-edit File_group-Photometry-Mn-s... | — | low |
| `8-1-1-6-file-photometry-mn-import-copy` | `FILE_PHOT_MN_IMP_N116` | 8-1-1-6 File_Photometry_Mn_import Copy | — | low |
| `3-2-1-photometry-e-main-before-zero-copy` | `PHOT_E_MAIN_ZERO_DONE` | 3-2-3 Photometry-E-Main-zero-done | — | low |
| `3-3-1-photometry-t-main-before-zero-copy` | `PHOT_T_MAIN_ZERO_DONE` | 3-3-3 Photometry-T-Main-zero-done | — | low |
| `photometry-parameter-mode-copy-copy-copy-c...` | `PHOT_PAR_MODE_E_IN_GAIN_OK` | 3-5-1-3-2 Photometry-parameters-mode-... | — | low |
| `3-1-1-photometry-a-main-before-zero-copy` | `3_1_EDIT_N3_PHOT_A_MAIN_PREZERO` | 3-1-1-edit n=3 Photometry-A-Main-befo... | — | low |
| `photometry-parameter-mode-copy-copy-copy-c...` | `PHOT_A_MEAS_N9_FXD_SEL` | 3-6-1-4-2 Photometry-A-n-9-measuremen... | — | low |
| `photometry-parameter-mode-copy-copy-copy-c...` | `PHOT_A_MEAS_N3_FXD_SEL` | 3-6-1-4-1 Photometry-A-n-3-measuremen... | — | low |
| `id-3-5-2-2-photometry-parameters-parall-me...` | `PHOT_PAR_PARLL_MEAS_IN_OK` | 3-5-2-2 Photometry-parameters-parall ... | — | low |
| `photometry-n-1-measurement-copy` | `PHOT_A_MEAS_N2_FXD` | 3-6-1-3 Photometry-A-n-2-measurement-... | — | low |
| `photometry-n-1-measurement-copy-copy` | `PHOT_A_MEAS_N3_FXD` | 3-6-1-4 Photometry-A-n-3-measurement-... | — | low |
| `photometry-n-1-measurement-copy-2` | `PHOT_A_MEAS_N1_FXD` | 3-6-1-2 Photometry-A-n-1-measurement-... | — | low |
| `id-3-6-1-1-photometry-a-n-1-measurement-no...` | `PHOT_T_MEAS_N1_UNFIXED` | 3-6-2-1 Photometry-T-n-1-measurement-... | — | low |
| `id-3-6-1-2-photometry-a-n-1-measurement-fi...` | `PHOT_T_MEAS_N1_FXD` | 3-6-2-2 Photometry-T-n-1-measurement-... | — | low |
| `id-3-6-1-3-photometry-a-n-2-measurement-fi...` | `PHOT_T_MEAS_N2_FXD` | 3-6-2-3 Photometry-T-n-2-measurement-... | — | low |
| `id-3-6-1-4-2-photometry-a-n-9-measurement-...` | `PHOT_MEAS_N9_SEL_REMEASURE` | 3-6-4-2-1 Photometry-n-9-measurement-... | — | low |
| `id-3-6-4-2-1-photometry-n-9-measurement-se...` | `PHOT_MEAS_N9_SEL_DEL` | 3-6-4-2-2 Photometry-n-9-measurement-... | — | low |
| `id-3-6-4-2-2-photometry-n-9-measurement-se...` | `PHOT_MEAS_N9_SEL_DEL_ALL_NO` | 3-6-4-3-1 Photometry-n-9-measurement-... | — | low |
| `id-3-6-4-2-2-photometry-n-9-measurement-se...` | `PHOT_MEAS_N9_SEL_DEL_ALL_YES` | 3-6-4-3-2 Photometry-n-9-measurement-... | — | low |
| `id-3-6-2-1-photometry-t-n-1-measurement-no...` | `PHOT_E_MEAS_N3_FXD` | 3-6-3-4 Photometry-E-n-3-measurement-... | — | low |
| `id-3-6-3-1-photometry-e-n-1-measurement-no...` | `PHOT_E_MEAS_N2_FXD` | 3-6-3-3 Photometry-E-n-2-measurement-... | — | low |
| `3-6-3-3-photometry-e-n-2-measurement-not-f...` | `PHOT_E_MEAS_N1_FXD` | 3-6-3-2 Photometry-E-n-1-measurement-... | — | low |
| `3-6-2-3-photometry-a-n-2-measurement-fixed...` | `PHOT_T_MEAS_N3_FXD` | 3-6-2-4 Photometry-T-n-3-measurement-... | — | low |
| `3-6-4-3-2-photometry-n-9-measurement-selec...` | `PHOT_SAVE_RES_NO` | 3-6-5-1-1 Photometry-save results-no | — | low |
| `3-6-5-1-1-photometry-save-results-no-copy` | `PHOT_SAVE_RES_YES` | 3-6-5-1-2 Photometry-save results-yes | — | low |
| `3-6-5-1-2-photometry-save-results-yes-copy` | `PHOT_STOR_LOC_STOR` | 3-6-5-2-1 Photometry-storage location... | — | low |
| `3-6-5-2-1-photometry-storage-location-stor...` | `PHOT_STOR_LOC_USB` | 3-6-5-2-2 Photometry-storage location... | — | low |
| `3-6-5-2-2-photometry-storage-location-usb-...` | `PHOT_NAMED_FILE` | 3-6-5-3-2 Photometry-named_file | — | low |
| `3-6-5-3-1-photometry-naming-file-copy` | `PHOT_NAME_FILE` | 3-6-5-3-1 Photometry-naming_file | — | low |
| `3-6-5-3-1-photometry-naming-file-copy-copy` | `PHOT_PRNT_YES` | 3-6-5-4-1 Photometry-print-yes | — | low |
| `3-6-5-4-1-photometry-print-yes-copy` | `PHOT_PRNT_NO` | 3-6-5-4-2 Photometry-print-no | — | low |
| `4-1-quantitative-submode-curves-copy` | `QUANT_SMODE_COEF` | 4-2 Quantitative-submode-coefficients | — | low |
| `4-2-quantitative-submode-coefficients-copy` | `QUANT_SMODE_CRV_NEW_WL` | 4-1-1-1 Quantitative-submode-curves-n... | — | low |
| `4-2-quantitative-submode-coefficients-copy-2` | `QUANT_SMODE_CRV_NEW` | 4-1-1 Quantitative-submode-curves-new | — | low |
| `4-1-1-quantitative-submode-curves-new-copy` | `QUANT_SMODE_CRV_LOAD` | 4-1-2 Quantitative-submode-curves-load | — | low |
| `4-1-1-1-quantitative-submode-curves-new-wl...` | `QUANT_SMODE_CRV_NEW_CUVETTE` | 4-1-1-2 Quantitative-submode-curves-n... | — | low |
| `4-1-1-2-quantitative-submode-curves-new-cu...` | `QUANT_SMODE_CRV_NEW_VALUE` | 4-1-1-3 Quantitative-submode-curves-n... | — | low |
| `4-1-1-3-quantitative-submode-curves-new-va...` | `QUANT_SMODE_CRV_NEW_STD` | 4-1-1-4 Quantitative-submode-curves-n... | — | low |
| `4-1-1-4-quantitative-submode-curves-new-st...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH` | 4-1-1-5 Quantitative-submode-curves-n... | — | low |
| `1-9-diagnostic-warming-copy` | `WAITING` | 1-9-2 Waiting | — | low |
| `4-1-1-1-quantitative-submode-curves-new-wl...` | `QUANT_SMODE_CRV_NEW_IN` | 4-1-1-1-1 Quantitative-submode-curves... | — | low |
| `4-1-1-1-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_IN_OK` | 4-1-1-1-2 Quantitative-submode-curves... | — | low |
| `4-1-1-2-quantitative-submode-curves-new-cu...` | `QUANT_SMODE_CRV_NEW_CUVETTE_IN` | 4-1-1-2-1 Quantitative-submode-curves... | — | low |
| `4-1-1-2-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_CUVETTE_IN_OK` | 4-1-1-2-2 Quantitative-submode-curves... | — | low |
| `4-1-1-3-quantitative-submode-curves-new-va...` | `QUANT_SMODE_CRV_NEW_VALUE_T` | 4-1-1-3-2 Quantitative-submode-curves... | — | low |
| `4-1-1-3-quantitative-submode-curves-new-va...` | `QUANT_SMODE_CRV_NEW_VALUE_A` | 4-1-1-3-1 Quantitative-submode-curves... | — | low |
| `4-1-1-4-quantitative-submode-curves-new-st...` | `QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY` | 4-1-1-4-1 Quantitative-submode-curves... | — | low |
| `4-1-1-4-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_NUM_PARALL` | 4-1-1-4-2 Quantitative-submode-curves... | — | low |
| `4-1-1-4-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_UNIT` | 4-1-1-4-3 Quantitative-submode-curves... | — | low |
| `4-1-1-4-3-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_DIL` | 4-1-1-4-4 Quantitative-submode-curves... | — | low |
| `4-1-1-5-quantitative-submode-curves-new-st...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_TYPE_REG` | 4-1-1-5-1 Quantitative-submode-curves... | — | low |
| `4-1-1-5-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_AF_C` | 4-1-1-5-2-1 Quantitative-submode-curv... | — | low |
| `4-1-1-5-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_TYPE_REG_LIN` | 4-1-1-5-1-1 Quantitative-submode-curv... | — | low |
| `4-1-1-5-1-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_TYPE_REG_LIN_0` | 4-1-1-5-1-2 Quantitative-submode-curv... | — | low |
| `4-1-1-5-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUCTION_REG` | 4-1-1-5-2 Quantitative-submode-curves... | — | low |
| `4-1-1-5-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_CF_A` | 4-1-1-5-2-2 Quantitative-submode-curv... | — | low |
| `4-1-1-5-2-2-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_TF_C` | 4-1-1-5-2-3 Quantitative-submode-curv... | — | low |
| `4-1-1-5-2-3-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_CF_T` | 4-1-1-5-2-4 Quantitative-submode-curv... | — | low |
| `4-1-1-4-1-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_IN` | 4-1-1-4-1-2 Quantitative-submode-curv... | — | low |
| `4-1-1-4-1-2-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_INPUTTING` | 4-1-1-4-1-1 Quantitative-submode-curv... | — | low |
| `4-1-1-4-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN` | 4-1-1-4-2-1 Quantitative-submode-curv... | — | low |
| `4-1-1-4-2-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN_OK` | 4-1-1-4-2-2 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N431` | 4-1-1-4-3-1 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N432` | 4-1-1-4-3-2 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-2-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N433` | 4-1-1-4-3-3 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-3-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N434` | 4-1-1-4-3-4 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-4-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N435` | 4-1-1-4-3-5 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-5-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N436` | 4-1-1-4-3-6 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-6-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N437` | 4-1-1-4-3-7 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-7-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_TCU` | 4-1-1-4-3-8 Quantitative-submode-curv... | — | low |
| `4-1-1-4-3-8-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_UNIT_N439` | 4-1-1-4-3-9 Quantitative-submode-curv... | — | low |
| `4-1-1-5-quantitative-submode-curves-new-st...` | `QUANT_SMODE_CRV_NEW_NEXT` | 4-1-1-6 Quantitative-submode-curves-n... | — | low |
| `4-1-1-5-2-4-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_ZERO` | 4-1-1-6-1-1 Quantitative-submode-curv... | — | low |
| `4-1-1-4-1-2-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_1_INPUTTING` | 4-1-1-4-1-3  Quantitative-submode-cur... | — | low |
| `4-1-1-4-1-3-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_1_IN` | 4-1-1-4-1-4  Quantitative-submode-cur... | — | low |
| `4-1-1-4-1-4-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_2_IN` | 4-1-1-4-1-5  Quantitative-submode-cur... | — | low |
| `4-1-1-4-1-5-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_C3_IN` | 4-1-1-4-1-6  Quantitative-submode-cur... | — | low |
| `4-1-1-4-1-6-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_4_IN` | 4-1-1-4-1-7  Quantitative-submode-cur... | — | low |
| `4-1-2-1-1quantitative-submode-curves-new-s...` | `QUANT_SMODE_CRV_NEW_ST_1_PAR_1_MEAS` | 4-1-1-6-1-2 Quantitative-submode-curv... | — | low |
| `4-1-2-1-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_2_PAR_1_MEAS` | 4-1-1-6-1-3 Quantitative-submode-curv... | — | low |
| `4-1-2-1-3-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_3_PAR_1_MEAS` | 4-1-1-6-1-4 Quantitative-submode-curv... | — | low |
| `4-1-2-1-4-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_4_PAR_1_MEAS` | 4-1-1-6-1-5 Quantitative-submode-curv... | — | low |
| `4-1-2-1-5-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_1_PAR_2_MEAS` | 4-1-1-6-1-6 Quantitative-submode-curv... | — | low |
| `4-1-2-1-6-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_2_PAR_2_MEAS` | 4-1-1-6-1-7 Quantitative-submode-curv... | — | low |
| `4-1-2-1-7-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_3_PAR_2_MEAS` | 4-1-1-6-1-8 Quantitative-submode-curv... | — | low |
| `4-1-2-1-8-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_4_PAR_2_MEAS` | 4-1-1-6-1-9 Quantitative-submode-curv... | — | low |
| `4-1-2-1-9-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ST_1_PAR_3_MEAS` | 4-1-1-6-1-10 Quantitative-submode-cur... | — | low |
| `4-1-2-1-10-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_ST_2_PAR_3_MEAS` | 4-1-1-6-1-11 Quantitative-submode-cur... | — | low |
| `4-1-2-1-11-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_ST_3_PAR_3_MEAS` | 4-1-1-6-1-12 Quantitative-submode-cur... | — | low |
| `4-1-2-1-12-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_GRAPH_A_F_C` | 4-1-1-6-1-13 Quantitative-submode-cur... | — | low |
| `4-1-2-1-13-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_ST_2_PAR_4_MEAS` | 4-1-1-6-1-14 Quantitative-submode-cur... | — | low |
| `4-1-2-1-13-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEAS` | 4-1-1-7-1-1 Quantitative-submode-curv... | — | low |
| `4-1-2-1-13-quantitative-submode-curves-new...` | `QUANT_SMODE_CRV_NEW_SAVE_YES` | 4-1-1-6-2-1 Quantitative-submode-curv... | — | low |
| `4-1-2-1-15-1-quantitative-submode-curves-n...` | `QUANT_SMODE_CRV_NEW_SAVE_NO` | 4-1-1-6-2-2 Quantitative-submode-curv... | — | low |
| `4-1-2-1-15-2-quantitative-submode-curves-n...` | `QUANT_SMODE_CRV_NEW_SAVE_YES_STOR` | 4-1-1-6-3-1 Quantitative-submode-curv... | — | low |
| `4-1-2-1-15-1-1-quantitative-submode-curves...` | `QUANT_SMODE_CRV_NEW_SAVE_YES_NAME` | 4-1-1-6-4-1 Quantitative-submode-curv... | — | low |
| `4-1-2-1-15-1-1-quantitative-submode-curves...` | `QUANT_SMODE_CRV_NEW_SAVE_YES_USB` | 4-1-1-6-3-2 Quantitative-submode-curv... | — | low |
| `4-1-2-1-15-2-1-quantitative-submode-curves...` | `QUANT_SMODE_CRV_NEW_SAVE_YES_NAMED` | 4-1-1-6-4-2 Quantitative-submode-curv... | — | low |
| `4-1-3-1-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_STATIS` | 4-1-1-7-3-2 Quantitative-submode-curv... | — | low |
| `4-1-3-1-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES` | 4-1-1-7-2-1 Quantitative-submode-curv... | — | low |
| `4-1-3-1-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN` | 4-1-1-7-2-2 Quantitative-submode-curv... | — | low |
| `4-1-3-1-1-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN_N723` | 4-1-1-7-2-3 Quantitative-submode-curv... | — | low |
| `4-1-3-1-2-2-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_NO` | 4-1-1-7-3-3 Quantitative-submode-curv... | — | low |
| `4-1-3-1-2-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_MEAS_ZERO` | 4-1-1-8-1 Quantitative-submode-curves... | — | low |
| `4-1-3-2-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_MEAS_PARAL_1` | 4-1-1-8-2 Quantitative-submode-curves... | — | low |
| `4-1-3-2-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_MEAS_PAR_2` | 4-1-1-8-3 Quantitative-submode-curves... | — | low |
| `4-1-3-1-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_OK` | 4-1-1-7-3-1 Quantitative-submode-curv... | — | low |
| `4-1-3-2-3-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES` | 4-1-1-9-1 Quantitative-submode-curves... | — | low |
| `4-1-4-1-quantitative-submode-curves-new-an...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_NO` | 4-1-1-9-2 Quantitative-submode-curves... | — | low |
| `4-1-4-2-quantitative-submode-curves-new-an...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_USB` | 4-1-1-10-2 Quantitative-submode-curve... | — | low |
| `4-1-4-1-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR` | 4-1-1-10-1 Quantitative-submode-curve... | — | low |
| `4-1-4-1-1-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAME` | 4-1-1-11-1 Quantitative-submode-curve... | — | low |
| `4-1-5-1-quantitative-submode-curves-new-an...` | `QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAMED` | 4-1-1-11-2 Quantitative-submode-curve... | — | low |
| `4-1-2-quantitative-submode-curves-load-copy` | `QUANT_SMODE_CRV_LOAD_N211` | 4-1-2-1-1 Quantitative-submode-curves... | — | low |
| `4-1-2-1-quantitative-submode-curves-load-copy` | `QUANT_SMODE_CRV_LOAD_N212` | 4-1-2-1-2 Quantitative-submode-curves... | — | low |
| `4-1-1-6-1-13-quantitative-submode-curves-n...` | `QUANT_SMODE_CRV_NEW_GRAPH_A_F_C_N131` | 4-1-3-1 Quantitative-submode-curves-n... | — | low |
| `4-1-1-4-quantitative-submode-curves-new-st...` | `QUANT_SMODE_CRV_NEW_STD_N114` | 4-1-1-4 Quantitative-submode-curves-n... | — | low |
| `4-1-3-1-quantitative-submode-curves-new-gr...` | `QUANT_SMODE_CRV_LOAD_GRAPH` | 4-1-2-2 Quantitative-submode-curves-l... | — | low |
| `4-1-1-5-2-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_DIL` | 4-1-1-5-3 Quantitative-submode-curves... | — | low |
| `4-1-1-5-3-quantitative-submode-curves-new-...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_DIL_IN` | 4-1-1-5-3-1 Quantitative-submode-curv... | — | low |
| `4-1-1-5-3-1-quantitative-submode-curves-ne...` | `QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_DIL_IN_OK` | 4-1-1-5-3-2 Quantitative-submode-curv... | — | low |
| `4-1-1-quantitative-submode-curves-new-copy-2` | `QUANT_SMODE_COEF_NEW` | 4-2-1-1 Quantitative-submode-coeffici... | — | low |
| `4-2-1-1-quantitative-submode-coefficients-...` | `QUANT_SMODE_COEF_IN_COEFF_A_LIN` | 4-2-1-2-1-1 Quantitative-submode-coef... | — | low |
| `4-2-1-1-quantitative-submode-coefficients-...` | `QUANT_SMODE_COEF_NEW_TYPE_REG` | 4-2-1-1-1 Quantitative-submode-coeffi... | — | low |
| `4-2-1-1-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_NEW_MODE_LIN` | 4-2-1-1-1-1 Quantitative-submode-coef... | — | low |
| `4-2-1-1-2-2-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_NEW_MODE_LIN_0` | 4-2-1-1-1-2 Quantitative-submode-coef... | — | low |
| `4-2-1-1-1-2-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_NEW_MODE_A` | 4-2-1-1-2-1 Quantitative-submode-coef... | — | low |
| `4-2-1-1-1-2-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_NEW_MODE_T` | 4-2-1-1-2-2 Quantitative-submode-coef... | — | low |
| `4-2-1-2-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_LOAD` | 4-2-2 Quantitative-submode-coefficien... | — | low |
| `4-2-1-2-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_IN_COEFF_A_LIN_0` | 4-2-1-2-3-1 Quantitative-submode-coef... | — | low |
| `4-2-1-2-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_IN_COEFF_T_LIN` | 4-2-1-2-2-1 Quantitative-submode-coef... | — | low |
| `4-2-1-2-1-1-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_IN_COEFF_A_LIN_OK` | 4-2-1-2-1-2 Quantitative-submode-coef... | — | low |
| `4-2-1-2-2-1-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_IN_COEFF_T_LIN_OK` | 4-2-1-2-2-2 Quantitative-submode-coef... | — | low |
| `4-2-1-2-3-1-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_IN_COEFF_A_LIN_0_OK` | 4-2-1-2-3-2 Quantitative-submode-coef... | — | low |
| `4-2-1-2-3-2-quantitative-submode-coefficie...` | `QUANT_SMODE_COEF_PARR_MEAS_IN` | 4-2-1-3-1 Quantitative-submode-coeffi... | — | low |
| `4-2-1-3-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_PARR_MEAS_IN_OK` | 4-2-1-3-2 Quantitative-submode-coeffi... | — | low |
| `4-2-1-1-1-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_NEW_MODE` | 4-2-1-1-2 Quantitative-submode-coeffi... | — | low |
| `4-2-1-1-2-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_NEW_WL` | 4-2-1-1-3 Quantitative-submode-coeffi... | — | low |
| `4-2-1-1-2-quantitative-submode-coefficient...` | `QUANT_SMODE_COEF_NEW_NEXT` | 4-2-1-1-4 Quantitative-submode-coeffi... | — | low |
| `4-1-2-1-1-quantitative-submode-curves-load...` | `QUANT_SMODE_COEFF_LOAD` | 4-2-2-1-2 Quantitative-submode-coeff-... | — | low |
| `7-1-1-copy` | `SET_D2_LAMP` | 7-1-3 Settings-D2_lamp | — | low |
| `7-1-1-settings-dark-current-copy` | `SET_W_LAMP` | 7-1-2 Settings-W_lamp | — | low |
| `7-1-3-settings-d2-lamp-copy` | `SET_FILE_SYS` | 7-1-4 Settings-Files_system | — | low |
| `7-1-4-settings-d2-lamp-peripheriae-copy` | `SET_CHANGE_LAMP` | 7-1-5 Settings-Change_lamp | — | low |
| `7-1-4-settings-d2-lamp-peripheriae-copy-copy` | `SET_DATA_TIME` | 7-1-6 Settings-Data_Time | — | low |
| `7-1-6-settings-d2-lamp-peripheriae-copy-co...` | `SET_CAL` | 7-1-7 Settings-Calibration_λ | — | low |
| `7-1-7-settings-d2-lamp-peripheriae-copy-co...` | `SET_ABOUT_SYS` | 7-1-9 Settings-About_system | — | low |
| `7-1-2-settings-w-lamp-copy` | `SET_W_LAMP_ON` | 7-1-2-1 Settings-W_lamp-on | — | low |
| `7-1-3-settings-d2-lamp-copy-2` | `SET_D2_LAMP_ON` | 7-1-3-1 Settings-D2_lamp-on | — | low |
| `7-1-3-1-settings-d2-lamp-on-copy` | `SET_D2_LAMP_OFF` | 7-1-3-2 Settings-D2_lamp-off | — | low |
| `7-1-2-1-settings-w-lamp-on-copy` | `SET_W_LAMP_OFF` | 7-1-2-1 Settings-W_lamp-off | — | low |
| `7-1-4-settings-peripheriae-copy` | `SET_FILE_SYS_N141` | 7-1-4-1 Settings-Files_system | — | low |
| `7-1-5-1-settings-change-lamp-inputting-copy` | `SET_CHANGE_LAMP_IN` | 7-1-5-1 Settings-Change_lamp-inputing | — | low |
| `7-1-5-2-settings-change-lamp-inputed-copy` | `SET_CHANGE_LAMP_IN_OK` | 7-1-5-2 Settings-Change_lamp-inputed | — | low |
| `7-1-4-1-settings-files-system-copy` | `SET_DATA_TIME_IN_MONDAY` | 7-1-6-1 Settings-Data_Time-inputing-m... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy` | `SET_DATA_TIME_IN_TUESDAY` | 7-1-6-2 Settings-Data_Time-inputing-t... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy-copy` | `SET_DATA_TIME_IN_WESNESDAY` | 7-1-6-3 Settings-Data_Time-inputing-w... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy-c...` | `SET_DATA_TIME_IN_THURSDAY` | 7-1-6-4 Settings-Data_Time-inputing-t... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy-c...` | `SET_DATA_TIME_IN_FRIDAY` | 7-1-6-5 Settings-Data_Time-inputing-f... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy-c...` | `SET_DATA_TIME_IN_SATURDAY` | 7-1-6-6 Settings-Data_Time-inputing-s... | — | low |
| `7-1-6-1-settings-data-time-inputing-copy-c...` | `SET_DATA_TIME_IN` | 7-1-6-7 Settings-Data_Time-inputing C... | — | low |
| `7-1-1-settings-dark-current-copy-2` | `SET_DARKCURR_MEASUR_PROC` | 7-1-1-1 Settings-Dark_current_measur_... | — | low |
| `7-1-1-1-settings-dark-current-measur-proce...` | `SET_DARKCURR_MEASURED` | 7-1-1-2 Settings-Dark_current_measured | — | low |
| `7-1-1-2-settings-dark-current-measured-copy` | `SET_DARKCURR_MEASURED_OK` | 7-1-1-3 Settings-Dark_current_measure... | — | low |
| `7-1-1-2-settings-dark-current-measured-cop...` | `SET_DARKCURR_MEASURED_N114` | 7-1-1-4 Settings-Dark_current_measure... | — | low |
| `7-1-1-4-settings-dark-current-measured-cop...` | `SET_DARKCURR_MEASURED_N115` | 7-1-1-5 Settings-Dark_current_measure... | — | low |
| `7-1-1-5-settings-dark-current-measured-cop...` | `SET_DARKCURR_MEASURED_N116` | 7-1-1-6 Settings-Dark_current_measure... | — | low |
| `7-1-1-6-settings-dark-current-measured-cop...` | `SET_DARKCURR_MEASURED_N117` | 7-1-1-7 Settings-Dark_current_measure... | — | low |
| `7-1-7-settings-d2-lamp-calibration-copy` | `SET_CAL_PROC` | 7-1-7-1 Settings-Calibration_λ-process | — | low |
| `7-1-7-1-settings-calibration-process-copy` | `SET_CAL_OK` | 7-1-7-2 Settings-Calibration_λ-success | — | low |
| `7-1-7-2-settings-calibration-success-copy` | `SET_CAL_MISTAKE` | 7-1-7-3 Settings-Calibration_λ-mistake | — | low |
| `7-1-8-settings-d2-lamp-peripheriae-copy-co...` | `SET_SYS_DEFAULT` | 7-1-8 Settings-System_Default | — | low |
| `7-1-8-settings-system-default-copy` | `SET_SYS_DEFAULT_YES` | 7-1-8-1 Settings-System_Default_yes | — | low |
| `7-1-8-1-settings-system-default-yes-copy-2` | `SET_SYS_DEFAULT_YES_N182` | 7-1-8-2 Settings-System_Default_yes Copy | — | low |
| `pc-connected-copy` | `PC_DISCONN` | PC disconnected | — | low |
| `7-1-9-settings-about-system-copy` | `SET_ABOUT_SYS_N191` | 7-1-9-1 Settings-About_system | — | low |
| `screen-255` | `KIN_PAR_MODE` | 5-1-1 Kinetic-parameter-mode | — | low |
| `2-1-4-1-1-kinetic-parameter-mode-copy` | `KIN_PAR_LAYERS` | 5-1-2 Kinetic-parameter-layers | — | low |
| `2-1-4-1-2-kinetic-parameter-layers-copy` | `KIN_PAR_TIME` | 5-1-3 Kinetic-parameter-time | — | low |
| `2-1-4-1-3-kinetic-parameter-time-copy` | `KIN_PAR_NEXT` | 5-1-4 Kinetic-parameter-next | — | low |
| `2-1-4-1-4-kinetic-parameter-next-copy` | `KIN_PAR_MODE_A` | 5-1-1-1 Kinetic-parameter-mode-A | — | low |
| `2-1-4-1-4-kinetic-parameter-next-copy-copy` | `KIN_PAR_MODE_T` | 5-1-1-2 Kinetic-parameter-mode-T | — | low |
| `2-1-4-1-4-kinetic-parameter-next-copy-copy...` | `KIN_PAR_MODE_E` | 5-1-1-3 Kinetic-parameter-mode-E | — | low |
| `2-1-4-1-1-3-kinetic-parameter-mode-e-copy` | `KIN_PAR_LAYERS_LOW_INPUTTING_A` | 5-1-2-1-1 Kinetic-parameter-layers-lo... | — | low |
| `2-1-4-1-1-3-kinetic-parameter-mode-e-copy-...` | `KIN_PAR_LAYERS_LOW_IN_A` | 5-1-2-1-2 Kinetic-parameter-layers-lo... | — | low |
| `2-1-4-1-1-3-kinetic-parameter-mode-e-copy-...` | `KIN_PAR_LAYERS_HIGH_INPUTTING_A` | 5-1-2-1-3 Kinetic-parameter-layers-hi... | — | low |
| `2-1-4-1-1-3-kinetic-parameter-mode-e-copy-...` | `KIN_PAR_LAYERS_LOW_INPUTTING_T` | 5-1-2-1-2-1 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-1-3-kinetic-parameter-mode-e-copy-...` | `KIN_PAR_LAYERS_HIGH_INPUTTING_T` | 5-1-2-1-2-2 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-2-7-kinetic-parameter-layers-high-...` | `KIN_PAR_LAYERS_HIGH_IN_T` | 5-1-2-1-2-3 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-2-8-kinetic-parameter-layers-high-...` | `KIN_PAR_LAYERS_LOW_INPUTTING_E` | 5-1-2-1-3-1 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-2-9-kinetic-parameter-layers-low-i...` | `KIN_PAR_LAYERS_LOW_IN_E` | 5-1-2-1-3-2 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-2-11-kinetic-parameter-layers-high...` | `KIN_PAR_LAYERS_HIGH_IN_E` | 5-1-2-1-3-3 Kinetic-parameter-layers-... | — | low |
| `2-1-4-1-2-9-kinetic-parameter-layers-high-...` | `KIN_PAR_TIME_INPUTTING_TIMESTEP` | 5-1-3-1 Kinetic-parameter-time-inputt... | — | low |
| `2-1-4-1-2-9-kinetic-parameter-layers-high-...` | `KIN_PAR_TIME_IN_TIMESTEP` | 5-1-3-2 Kinetic-parameter-time-inpute... | — | low |
| `2-1-4-1-2-9-kinetic-parameter-layers-high-...` | `KIN_PAR_TIME_IN_TIME_ALL` | 5-1-3-3 Kinetic-parameter-time-inpute... | — | low |
| `4-1-2-2-quantitative-submode-curves-load-g...` | `KIN_MEAS_RES_GRAPHICS_A_F_T` | 2-1-4-2-4-1 Kinetic-measurement-resul... | — | low |
| `2-1-4-2-4-1-kinetic-measurement-result-gra...` | `KIN_MEAS_RES_GRAPHICS_T_F_T` | 2-1-4-2-4-2 Kinetic-measurement-resul... | — | low |
| `2-1-4-1-3-3-kinetic-parameter-time-inputed...` | `KIN_MEAS_RES_TABLE` | 5-3-2 Kinetic-measurement-result-table | — | low |
| `5-3-2-kinetic-measurement-result-table-copy` | `MUTLIWAVELENGTH_PAR_MODE` | 6-1-1 Mutliwavelength-parameter-mode | — | low |
| `6-1-1-mutliwavelength-parameter-mode-copy-...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL` | 6-1-2 Mutliwavelength-parameter-numbe... | — | low |
| `6-1-2-mutliwavelength-parameter-number-wl-...` | `MUTLIWAVELENGTH_PAR_NEXT` | 6-1-3 Mutliwavelength-parameter-next | — | low |
| `6-1-2-mutliwavelength-parameter-number-wl-...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN` | 6-1-2-1-1 Mutliwavelength-parameter-n... | — | low |
| `6-1-2-1-1-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK` | 6-1-2-1-2 Mutliwavelength-parameter-n... | — | low |
| `6-1-1-mutliwavelength-parameter-mode-copy` | `MUTLIWAVELENGTH_PAR_MODE_A` | 6-1-1-1 Mutliwavelength-parameter-mode-A | — | low |
| `6-1-1-1-mutliwavelength-parameter-mode-cop...` | `MUTLIWAVELENGTH_PAR_MODE_T` | 6-1-1-2 Mutliwavelength-parameter-mod... | — | low |
| `6-1-1-1-mutliwavelength-parameter-mode-cop...` | `MUTLIWAVELENGTH_PAR_MODE_E` | 6-1-1-3 Mutliwavelength-parameter-mode_E | — | low |
| `6-1-2-1-2-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1` | 6-1-2-2-1 Mutliwavelength-parameter-n... | — | low |
| `6-1-2-2-1-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2` | 6-1-2-2-2 Mutliwavelength-parameter-n... | — | low |
| `6-1-2-2-2-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3` | 6-1-2-2-3 Mutliwavelength-parameter-n... | — | low |
| `6-1-2-2-2-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4` | 6-1-2-2-4 Mutliwavelength-parameter-n... | — | low |
| `6-1-2-2-1-mutliwavelength-parameter-number...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL` | 6-1-2-2-1-1 Mutliwavelength-parameter... | — | low |
| `6-1-2-2-1-1-mutliwavelength-parameter-numb...` | `MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK` | 6-1-2-2-1-2 Mutliwavelength-parameter... | — | low |
| `6-1-3-mutliwavelength-parameter-next-copy` | `MUTLIWAVELENGTH_MEAS_ZERO_262_2` | 6-2-1 Mutliwavelength-measurement_zer... | — | low |
| `6-2-1-mutliwavelength-measurement-zori-copy` | `MUTLIWAVELENGTH_MEAS_ZERO_SET_WL` | 6-2-2 Mutliwavelength-measurement_zer... | — | low |
| `6-2-2-mutliwavelength-measurement-zori-cop...` | `MUTLIWAVELENGTH_MEAS_ZERO_431_4` | 6-2-3 Mutliwavelength-measurement_zer... | — | low |
| `6-2-3-mutliwavelength-measurement-zero-431...` | `MUTLIWAVELENGTH_MEAS_ZERO_585_6` | 6-2-4 Mutliwavelength-measurement_zer... | — | low |
| `6-2-4-mutliwavelength-measurement-zero-431...` | `MUTLIWAVELENGTH_MEAS_ZERO_685_5` | 6-2-5 Mutliwavelength-measurement_zer... | — | low |
| `6-2-5-mutliwavelength-measurement-zero-685...` | `MUTLIWAVELENGTH_MEAS_262_2` | 6-2-6 Mutliwavelength-measurement_mea... | — | low |
| `6-2-5-mutliwavelength-measurement-zero-685...` | `MUTLIWAVELENGTH_MEAS_ZERO_WL_TRANSIT` | 6-2-7 Mutliwavelength-measurement_zer... | — | low |
| `6-2-5-mutliwavelength-measurement-zero-685...` | `MUTLIWAVELENGTH_MEAS_431_4` | 6-2-8 Mutliwavelength-measurement_mea... | — | low |
| `6-2-9-mutliwavelength-measurement-zero-685...` | `MUTLIWAVELENGTH_MEAS_585_5_MEAS` | 6-2-9 Mutliwavelength-measurement_585... | — | low |
| `6-2-10-mutliwavelength-measurement-zero-68...` | `MUTLIWAVELENGTH_MEAS_685_5` | 6-2-10 Mutliwavelength-measurement_me... | — | low |

## Ambiguous (User Decision Required)
### 7-1-1-7-settings-dark-current-measured-copy-copy-copy-copy-copy-copy
- Title: 7-1-1-7 Settings-Dark_current_measured Copy Copy Copy Copy Copy Copy
- Proposed: `SET_DARKCURR_MEASURED_2`
- Conflict: ID collision: "SET_DARKCURR_MEASURED" already claimed by "7-1-1-1-settings-dark-current-measur-process-copy". Auto-suffixed to "SET_DARKCURR_MEASURED_2". Both num-prefix and type-suffix strategies exhausted.
- Evidence: origin:user, title-derived, collision-numeric-suffix-from:SET_DARKCURR_MEASURED

# Semantic Screen Index

| Screen | Name | Role | States | Mode | Phase | Operation | Objects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DIAG_FILTER_PROC | 1-1-1 Diagnostic-filter-process | unknown | DIAG_FILTER_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_FILTER_OK | 1-1-2 Diagnostic-filter-success | unknown | DIAG_FILTER_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_FILTER_FAIL | 1-1-3 Diagnostic-filter-fail | unknown | DIAG_FILTER_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_LAMP_PROC | 1-2-1 Diagnostic-lamps-process | unknown | DIAG_LAMP_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_LAMP_OK | 1-2-2 Diagnostic-lamps-success | unknown | DIAG_LAMP_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_LAMP_FAIL | 1-2-3 Diagnostic-lamps-fail | unknown | DIAG_LAMP_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DET_PROC | 1-3-1 Diagnostic-detector-process | unknown | DIAG_DET_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DET_OK | 1-3-2 Diagnostic-detector-success | unknown | DIAG_DET_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DET_FAIL | 1-3-3 Diagnostic-detector-fail | unknown | DIAG_DET_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_W_LAMP_PROC | 1-4-1 Diagnostic-W-lamp-process | unknown | DIAG_W_LAMP_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_W_LAMP_OK | 1-4-2 Diagnostic-W-lamp-success | unknown | DIAG_W_LAMP_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_W_LAMP_FAIL | 1-4-3 Diagnostic-W-lamp-fail | unknown | DIAG_W_LAMP_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_D2_LAMP_PROC | 1-5-1 Diagnostic-D2-lamp-process | unknown | DIAG_D2_LAMP_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_D2_LAMP_OK | 1-5-2 Diagnostic-D2-lamp-success | unknown | DIAG_D2_LAMP_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_D2_LAMP_FAIL | 1-5-3 Diagnostic-D2-lamp-fail | unknown | DIAG_D2_LAMP_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_CALIBR_WL_PROC | 1-6-1 Diagnostic-calibr wl-process | unknown | DIAG_CALIBR_WL_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_CALIBR_WL_OK | 1-6-2 Diagnostic-calibr wl-success | unknown | DIAG_CALIBR_WL_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_CALIBR_WL_FAIL | 1-6-3 Diagnostic-calibr wl-fail | unknown | DIAG_CALIBR_WL_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_SYS_PROC | 1-7-1 Diagnostic-system-process | unknown | DIAG_SYS_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_SYS_OK | 1-7-2 Diagnostic-system-success | unknown | DIAG_SYS_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_SYS_FAIL | 1-7-3 Diagnostic-system-fail | unknown | DIAG_SYS_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DARKCURR_PROC | 1-8-1 Diagnostic-dark_current-proccess | unknown | DIAG_DARKCURR_PROC |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DARKCURR_OK | 1-8-2 Diagnostic-dark_current-success | unknown | DIAG_DARKCURR_OK |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_DARKCURR_FAIL | 1-8-3 Diagnostic-dark_current-fail | unknown | DIAG_DARKCURR_FAIL |  | diagnostic | startup.self_diagnostic | 19 |
| DIAG_WARM | 1-9-1 Diagnostic-warming | unknown | DIAG_WARM |  | warmup | startup.warmup | 9 |
| WAITING | 1-9-2 Waiting | unknown | WAITING |  | warmup | startup.warmup | 2 |
| MAINMNU_SEL_PHOT | 2-1-1 Main menu-select-photometry | unknown | MAINMNU_SEL_PHOT | photometry | navigation | measurement.ready | 17 |
| MAINMNU_SEL_QUANT | 2-1-2 Main menu-select-quantitative | unknown | MAINMNU_SEL_QUANT | quantitative | navigation | measurement.ready | 19 |
| MAINMNU_SEL_MW | 2-1-3 Main menu-select-multiwavelength | unknown | MAINMNU_SEL_MW | multiwave | navigation | input.wavelength | 19 |
| MAINMNU_SEL_KIN | 2-1-4 Main menu-select-kinetics | unknown | MAINMNU_SEL_KIN | kinetics | navigation | measurement.ready | 19 |
| MAINMNU_SEL_SET | 2-1-5 Main menu-select-setup | unknown | MAINMNU_SEL_SET |  | navigation | unknown | 18 |
| FILE_GRP_KIN | 8-4 File_group-Kinetics | unknown | FILE_GRP_KIN | kinetics | file | files.navigate | 15 |
| FILE_GRP_QUANT_ANALYSIS | 8-2 File_group-Quantitative_analysis | unknown | FILE_GRP_QUANT_ANALYSIS | quantitative | file | files.navigate | 17 |
| 8-2-file-group-quantitative-analysis-copy | 8-3 File_group-Multiwavelenth | unknown | 8-2-file-group-quantitative-analysis-copy | quantitative | navigation | measurement.ready | 17 |
| FILE_GRP_PHOT | 8-1 File_group-Photometry | unknown | FILE_GRP_PHOT | photometry | file | files.navigate | 14 |
| FILE_GRP_PHOT_MN_SEL | 8-1-1 File_group-Photometry-Mn-select | unknown | FILE_GRP_PHOT_MN_SEL | photometry | file | files.navigate | 13 |
| 8_1_EDIT_FILE_GRP_PHOT_MN_SEL | 8-1-1-edit File_group-Photometry-Mn-select Copy | unknown | 8_1_EDIT_FILE_GRP_PHOT_MN_SEL | photometry | navigation | measurement.ready | 13 |
| FILE_GRP_PHOT_WATER_SEL | 8-1-2 File_group-Photometry-water-select | unknown | FILE_GRP_PHOT_WATER_SEL | photometry | file | files.navigate | 13 |
| FILE_GRP_QUANT_ANALYSIS_COEF | 8-2-3 File_group-Quantitative_analysis-coefficients | unknown | FILE_GRP_QUANT_ANALYSIS_COEF | quantitative | file | input.coefficient | 15 |
| FILE_GRP_QUANT_ANALYSIS_RES | 8-2-2 File_group-Quantitative_analysis-results | unknown | FILE_GRP_QUANT_ANALYSIS_RES | quantitative | results | result.view | 17 |
| FILE_GRP_QUANT_ANALYSIS_CRV | 8-2-1 File_group-Quantitative_analysis-curves | unknown | FILE_GRP_QUANT_ANALYSIS_CRV | quantitative | file | files.navigate | 15 |
| FILE_PHOT_MN_OPEN | 8-1-1-1 File_Photometry_Mn_open | unknown | FILE_PHOT_MN_OPEN | photometry | file | files.navigate | 18 |
| FILE_PHOT_MN_REN_N112 | 8-1-1-2 File_Photometry_Mn_rename | unknown | FILE_PHOT_MN_REN_N112 | photometry | file | files.navigate | 20 |
| FILE_PHOT_MN_DEL | 8-1-1-3 File_Photometry_Mn_delete | unknown | FILE_PHOT_MN_DEL | photometry | file | files.navigate | 20 |
| FILE_PHOT_MN_IMP | 8-1-1-4 File_Photometry_Mn_load to device | unknown | FILE_PHOT_MN_IMP | photometry | file | files.navigate | 20 |
| FILE_PHOT_MN_IMP_N116 | 8-1-1-5 File_Photometry_Mn_export USB | unknown | FILE_PHOT_MN_IMP_N116 | photometry | file | files.navigate | 20 |
| FILE_PHOT_MN_EXP_USB | 8-1-1-4 File_Photometry_Mn_export-USB Copy | unknown | FILE_PHOT_MN_EXP_USB | photometry | file | files.navigate | 18 |
| FILE_PHOT_MN_INFO | 8-1-1-6 File_Photometry_Mn_info | unknown | FILE_PHOT_MN_INFO | photometry | file | files.navigate | 18 |
| FILE_PHOT_MN_REN | 8-1-1-2-1 File_Photometry_Mn_renaming | unknown | FILE_PHOT_MN_REN | photometry | file | files.navigate | 10 |
| FILE_PHOT_MN_REN_N122 | 8-1-1-2-2 File_Photometry_Mn_renaming | unknown | FILE_PHOT_MN_REN_N122 | photometry | file | files.navigate | 10 |
| FILE_PHOT_MN_DELETING_NO | 8-1-1-3-1 File_Photometry_Mn_deleting-No | unknown | FILE_PHOT_MN_DELETING_NO | photometry | file | files.navigate | 14 |
| FILE_PHOT_MN_DELETING_YES | 8-1-1-3-2 File_Photometry_Mn_deleting-Yes | unknown | FILE_PHOT_MN_DELETING_YES | photometry | file | files.navigate | 13 |
| 8_FILE_STOR_NAVIGATOR | 8-Files-storage navigator | unknown | 8_FILE_STOR_NAVIGATOR |  | save | result.save | 14 |
| PHOT_A_MAIN_PREZERO | 3-1-1 Photometry-A-Main-before zero | unknown | PHOT_A_MAIN_PREZERO | photometry | zeroing | measurement.zero | 7 |
| 3_1_EDIT_N3_PHOT_A_MAIN_PREZERO | 3-1-1-edit n=3 Photometry-A-Main-before zero | unknown | 3_1_EDIT_N3_PHOT_A_MAIN_PREZERO | photometry | zeroing | measurement.zero | 7 |
| PHOT_A_MAIN_ZERO_DONE | 3-1-3 Photometry-A-Main-zero-done | unknown | PHOT_A_MAIN_ZERO_DONE | photometry | zeroing | measurement.zero | 7 |
| PHOT_A_MAIN_ZERO_PROC | 3-1-2 Photometry-A-Main-zero-process | unknown | PHOT_A_MAIN_ZERO_PROC | photometry | zeroing | measurement.zero | 7 |
| PHOT_E_MAIN_PREZERO | 3-2-1 Photometry-E-Main-before zero | unknown | PHOT_E_MAIN_PREZERO | photometry | zeroing | measurement.zero | 8 |
| PHOT_E_MAIN_ZERO_DONE | 3-2-3 Photometry-E-Main-zero-done | unknown | PHOT_E_MAIN_ZERO_DONE | photometry | zeroing | measurement.zero | 8 |
| PHOT_E_MAIN_ZERO_PROC | 3-2-2 Photometry-E-Main-zero-process | unknown | PHOT_E_MAIN_ZERO_PROC | photometry | zeroing | measurement.zero | 8 |
| PHOT_T_MAIN_PREZERO | 3-3-1 Photometry-T-Main-before zero | unknown | PHOT_T_MAIN_PREZERO | photometry | zeroing | measurement.zero | 7 |
| PHOT_T_MAIN_ZERO_DONE | 3-3-3 Photometry-T-Main-zero-done | unknown | PHOT_T_MAIN_ZERO_DONE | photometry | zeroing | measurement.zero | 7 |
| PHOT_T_MAIN_ZERO_PROC | 3-3-2 Photometry-T-Main-zero-process | unknown | PHOT_T_MAIN_ZERO_PROC | photometry | zeroing | measurement.zero | 7 |
| PHOT_IN_WL_PROC | 3-4-1 Photometry-input_wl_process | unknown | PHOT_IN_WL_PROC | photometry | configuration | input.wavelength | 7 |
| PHOT_IN_WL_IN | 3-4-2 Photometry-input_wl_inputing | unknown | PHOT_IN_WL_IN | photometry | configuration | input.wavelength | 7 |
| 3-4-2-photometry-input-wl-inputing-copy | 3-4-3 Photometry-moving-wl | unknown | 3-4-2-photometry-input-wl-inputing-copy | photometry | configuration | input.wavelength | 6 |
| PHOT_PAR_MODE | 3-5-1 Photometry-parameters-mode | unknown | PHOT_PAR_MODE | photometry | configuration | parameters.configure | 12 |
| PHOT_PAR_PARLL_MEAS | 3-5-2 Photometry-parameters-parall measurements | unknown | PHOT_PAR_PARLL_MEAS | photometry | measurement | measurement.measure | 12 |
| PHOT_PAR_MODE_A | 3-5-1-1 Photometry-parameters-mode-A | unknown | PHOT_PAR_MODE_A | photometry | configuration | parameters.configure | 14 |
| 3-5-1-1-photometry-parameters-mode-a-copy-2 | 3-5-1-2 Photometry-parameters-mode-T | unknown | 3-5-1-1-photometry-parameters-mode-a-copy-2 | photometry | configuration | parameters.configure | 16 |
| 3-5-1-1-photometry-parameters-mode-a-copy | 3-5-1-3 Photometry-parameters-mode-E | unknown | 3-5-1-1-photometry-parameters-mode-a-copy | photometry | configuration | parameters.configure | 14 |
| PHOT_PAR_MODE_E_IN_GAIN | 3-5-1-3-1 Photometry-parameters-mode-E-inputing gain | unknown | PHOT_PAR_MODE_E_IN_GAIN | photometry | configuration | input.gain | 14 |
| PHOT_PAR_MODE_E_IN_GAIN_OK | 3-5-1-3-2 Photometry-parameters-mode-E-inputed gain | unknown | PHOT_PAR_MODE_E_IN_GAIN_OK | photometry | configuration | input.gain | 14 |
| PHOT_PAR_PARLL_MEAS_IN | 3-5-2-1 Photometry-parameters-parall measurements-inputing | unknown | PHOT_PAR_PARLL_MEAS_IN | photometry | measurement | measurement.measure | 9 |
| PHOT_PAR_PARLL_MEAS_IN_OK | 3-5-2-2 Photometry-parameters-parall measurements-inputed | unknown | PHOT_PAR_PARLL_MEAS_IN_OK | photometry | measurement | measurement.measure | 9 |
| PHOT_A_MEAS_N1_UNFIXED | 3-6-1-1 Photometry-A-n-1-measurement-zero | unknown | PHOT_A_MEAS_N1_UNFIXED | photometry | zeroing | measurement.zero | 19 |
| PHOT_T_MEAS_N1_UNFIXED | 3-6-2-1 Photometry-T-n-1-measurement-not fixed | unknown | PHOT_T_MEAS_N1_UNFIXED | photometry | measurement | measurement.measure | 19 |
| PHOT_E_MEAS_N3_FXD | 3-6-3-4 Photometry-E-n-3-measurement-fixed | unknown | PHOT_E_MEAS_N3_FXD | photometry | measurement | measurement.measure | 33 |
| PHOT_E_MEAS_N2_FXD | 3-6-3-3 Photometry-E-n-2-measurement-fixed | unknown | PHOT_E_MEAS_N2_FXD | photometry | measurement | measurement.measure | 31 |
| PHOT_E_MEAS_N1_FXD | 3-6-3-1 Photometry-E-n-1-blanking | unknown | PHOT_E_MEAS_N1_FXD | photometry | navigation | measurement.ready | 7 |
| PHOT_A_MEAS_N1_FXD | 3-6-1-2 Photometry-A-n-1-measurement-fixed | unknown | PHOT_A_MEAS_N1_FXD | photometry | measurement | measurement.measure | 27 |
| PHOT_T_MEAS_N1_FXD | 3-6-2-2 Photometry-T-n-1-measurement-fixed | unknown | PHOT_T_MEAS_N1_FXD | photometry | measurement | measurement.measure | 27 |
| PHOT_A_MEAS_N2_FXD | 3-6-1-3 Photometry-A-n-2-measurement-fixed | unknown | PHOT_A_MEAS_N2_FXD | photometry | measurement | measurement.measure | 30 |
| PHOT_T_MEAS_N2_FXD | 3-6-2-3 Photometry-T-n-2-measurement-fixed | unknown | PHOT_T_MEAS_N2_FXD | photometry | measurement | measurement.measure | 31 |
| PHOT_T_MEAS_N3_FXD | 3-6-2-4 Photometry-T-n-3-measurement-fixed | unknown | PHOT_T_MEAS_N3_FXD | photometry | measurement | measurement.measure | 31 |
| PHOT_A_MEAS_N3_FXD | 3-6-1-4 Photometry-A-n-3-measurement-fixed | unknown | PHOT_A_MEAS_N3_FXD | photometry | measurement | measurement.measure | 31 |
| PHOT_A_MEAS_N3_FXD_SEL | 3-6-1-4-1 Photometry-A-n-3-measurement-fixed-selected | unknown | PHOT_A_MEAS_N3_FXD_SEL | photometry | measurement | measurement.measure | 32 |
| PHOT_A_MEAS_N9_FXD_SEL | 3-6-1-4-2 Photometry-A-n-9-measurement-fixed-selected | unknown | PHOT_A_MEAS_N9_FXD_SEL | photometry | measurement | measurement.measure | 36 |
| PHOT_MEAS_N9_SEL_REMEASURE | 3-6-4-2-1 Photometry-n-9-measurement-selected-remeasure | unknown | PHOT_MEAS_N9_SEL_REMEASURE | photometry | measurement | measurement.measure | 16 |
| PHOT_MEAS_N9_SEL_DEL | 3-6-4-2-2 Photometry-n-9-measurement-selected-delete | unknown | PHOT_MEAS_N9_SEL_DEL | photometry | measurement | measurement.measure | 16 |
| PHOT_MEAS_N9_SEL_DEL_ALL_NO | 3-6-4-3-1 Photometry-n-9-measurement-selected-delete_all-no | unknown | PHOT_MEAS_N9_SEL_DEL_ALL_NO | photometry | measurement | measurement.measure | 12 |
| PHOT_MEAS_N9_SEL_DEL_ALL_YES | 3-6-4-3-2 Photometry-n-9-measurement-selected-delete_all-yes | unknown | PHOT_MEAS_N9_SEL_DEL_ALL_YES | photometry | measurement | measurement.measure | 12 |
| PHOT_SAVE_RES_NO | 3-6-5-1-1 Photometry-save results-no | unknown | PHOT_SAVE_RES_NO | photometry | results | result.view | 12 |
| PHOT_SAVE_RES_YES | 3-6-5-1-2 Photometry-save results-yes | unknown | PHOT_SAVE_RES_YES | photometry | results | result.view | 12 |
| PHOT_STOR_LOC_STOR | 3-6-5-2-1 Photometry-storage location-storage | unknown | PHOT_STOR_LOC_STOR | photometry | save | result.save | 12 |
| PHOT_STOR_LOC_USB | 3-6-5-2-2 Photometry-storage location-usb | unknown | PHOT_STOR_LOC_USB | photometry | save | result.save | 12 |
| PHOT_NAMED_FILE | 3-6-5-3-2 Photometry-named_file | unknown | PHOT_NAMED_FILE | photometry | navigation | measurement.ready | 7 |
| PHOT_NAME_FILE | 3-6-5-3-1 Photometry-naming_file | unknown | PHOT_NAME_FILE | photometry | configuration | input.filename | 7 |
| PHOT_PRNT_YES | 3-6-5-4-1 Photometry-print-yes | unknown | PHOT_PRNT_YES | photometry | print | result.print | 12 |
| PHOT_PRNT_NO | 3-6-5-4-2 Photometry-print-no | unknown | PHOT_PRNT_NO | photometry | print | result.print | 12 |
| QUANT_CRV_MAIN | 4-1 Quantitative-submode-curves | unknown | QUANT_CRV_MAIN | quantitative | navigation | measurement.ready | 11 |
| 4-1-quantitative-submode-curves-copy | 4-2 Quantitative-submode-coefficients | unknown | 4-1-quantitative-submode-curves-copy | quantitative | configuration | input.coefficient | 11 |
| QUANT_SMODE_CRV_NEW | 4-1-1 Quantitative-submode-curves-new | unknown | QUANT_SMODE_CRV_NEW | quantitative | navigation | measurement.ready | 11 |
| QUANT_SMODE_COEF_NEW_TYPE_REG | 4-2-1-1 Quantitative-submode-coefficients-wl | unknown | QUANT_SMODE_COEF_NEW_TYPE_REG | quantitative | configuration | input.coefficient | 19 |
| 4-2-1-1-1-quantitative-submode-coefficients-new-type-regression-copy | 4-2-1-2 Quantitative-submode-coefficients-cuvettes | unknown | 4-2-1-1-1-quantitative-submode-coefficients-new-type-regression-copy | quantitative | configuration | input.coefficient | 21 |
| 4-2-1-2-quantitative-submode-coefficients-cuvettes-copy | 4-2-1-3 Quantitative-submode-coefficients-new-type_regression | unknown | 4-2-1-2-quantitative-submode-coefficients-cuvettes-copy | quantitative | configuration | input.coefficient | 21 |
| 4-2-1-3-quantitative-submode-coefficients-new-type-regression-copy | 4-2-1-4 Quantitative-submode-coefficients-new-units | unknown | 4-2-1-3-quantitative-submode-coefficients-new-type-regression-copy-2 | quantitative | configuration | input.coefficient | 21 |
| 4-2-1-5-n-2-quantitative-submode-coefficients-new-units-copy-copy-copy | 4-2-1-6 Quantitative-submode-coefficients-next | unknown | 4-2-1-5-n-2-quantitative-submode-coefficients-new-units-copy-copy-copy | quantitative | configuration | input.coefficient | 18 |
| QUANT_SMODE_COEF_NEW_MODE_LIN | 4-2-1-3-1 Quantitative-submode-coefficients-new-modes- | unknown | QUANT_SMODE_COEF_NEW_MODE_LIN | quantitative | configuration | input.coefficient | 12 |
| 4-2-1-3-1-quantitative-submode-coefficients-new-modes-copy | 4-2-1-3-2 Quantitative-submode-coefficients-new-modes-C-f(A) | unknown | 4-2-1-3-1-quantitative-submode-coefficients-new-modes-copy | quantitative | configuration | input.coefficient | 12 |
| QUANT_SMODE_COEF_IN_COEFF_A_LIN | 4-2-1-3-1-1 Quantitative-submode-coefficients-inputing_coeff-A-linear | unknown | QUANT_SMODE_COEF_IN_COEFF_A_LIN | quantitative | configuration | input.coefficient | 15 |
| 4-2-1-2-1-1-quantitative-submode-coefficients-inputing-coeff-a-linear-copy | 4-2-1-3-1-2 Quantitative-submode-coefficients-inputing_coeff-A-linear Copy | unknown | 4-2-1-2-1-1-quantitative-submode-coefficients-inputing-coeff-a-linear-copy | quantitative | configuration | input.coefficient | 15 |
| QUANT_SMODE_COEF_IN_COEFF_A_LIN_OK | 4-2-1-3-1-3 Quantitative-submode-coefficients-inputed_coeff-A-linear | unknown | QUANT_SMODE_COEF_IN_COEFF_A_LIN_OK | quantitative | configuration | input.coefficient | 15 |
| QUANT_SMODE_COEF_IN_COEFF_A_LIN_0 | 4-2-1-3-2-1 Quantitative-submode-coefficients-inputing_coeff-A-linear_0 | unknown | QUANT_SMODE_COEF_IN_COEFF_A_LIN_0 | quantitative | configuration | input.coefficient | 15 |
| 4-2-1-3-2-1-quantitative-submode-coefficients-inputing-coeff-a-linear-0-copy | 4-2-1-3-2-2 Quantitative-submode-coefficients-inputing_coeff-A-linear_0 Copy | unknown | 4-2-1-3-2-1-quantitative-submode-coefficients-inputing-coeff-a-linear-0-copy | quantitative | configuration | input.coefficient | 15 |
| 4-2-1-3-2-1-quantitative-submode-coefficients-inputing-coeff-a-linear-0-copy-copy | 4-2-1-3-2-3 Quantitative-submode-coefficients-inputing_coeff-A-linear_0 Copy Copy | unknown | 4-2-1-3-2-1-quantitative-submode-coefficients-inputing-coeff-a-linear-0-copy-copy | quantitative | configuration | input.coefficient | 15 |
| QUANT_SMODE_COEF_PARR_MEAS_IN | 4-2-1-5-1 Quantitative-submode-coefficients-parr_meas_inputing | unknown | QUANT_SMODE_COEF_PARR_MEAS_IN | quantitative | configuration | input.coefficient | 14 |
| 4-2-1-3-1-quantitative-submode-coefficients-parr-meas-inputing-copy | 4-2-1-5-2 Quantitative-submode-coefficients-parr_meas_inputed | unknown | 4-2-1-3-1-quantitative-submode-coefficients-parr-meas-inputing-copy | quantitative | configuration | input.coefficient | 14 |
| QUANT_SMODE_COEF_LOAD | 4-2-1 Quantitative-submode-coefficients-add | unknown | QUANT_SMODE_COEF_LOAD | quantitative | configuration | input.coefficient | 11 |
| 4-2-1-quantitative-submode-coefficients-add-copy | 4-2-2 Quantitative-submode-coefficients-load | unknown | 4-2-1-quantitative-submode-coefficients-add-copy | quantitative | configuration | input.coefficient | 11 |
| QUANT_SMODE_CRV_LOAD | 4-1-2 Quantitative-submode-curves-load | unknown | QUANT_SMODE_CRV_LOAD | quantitative | navigation | measurement.ready | 11 |
| QUANT_SMODE_CRV_LOAD_N211 | 4-2-2-1 Quantitative-submode-curves-load | unknown | QUANT_SMODE_CRV_LOAD_N211 | quantitative | navigation | measurement.ready | 22 |
| QUANT_SMODE_COEFF_LOAD | 4-2-2-2 Quantitative-submode-coeff-load Copy | unknown | QUANT_SMODE_COEFF_LOAD | quantitative | configuration | input.coefficient | 22 |
| QUANT_SMODE_CRV_LOAD_N212 | 4-1-2-1-2 Quantitative-submode-curves-load Copy | unknown | QUANT_SMODE_CRV_LOAD_N212 | quantitative | navigation | measurement.ready | 15 |
| QUANT_SMODE_CRV_NEW_WL | 4-1-1-1 Quantitative-submode-curves-new-wl | unknown | QUANT_SMODE_CRV_NEW_WL | quantitative | navigation | measurement.ready | 16 |
| QUANT_SMODE_CRV_NEW_IN | 4-1-1-1-1 Quantitative-submode-curves-new-inputing | unknown | QUANT_SMODE_CRV_NEW_IN | quantitative | configuration | measurement.ready | 9 |
| QUANT_SMODE_CRV_NEW_IN_OK | 4-1-1-1-2 Quantitative-submode-curves-new-inputed | unknown | QUANT_SMODE_CRV_NEW_IN_OK | quantitative | configuration | measurement.ready | 9 |
| 4-1-1-1-2-quantitative-submode-curves-new-inputed-copy | 4-1-1-1-3 Quantitative-submode-curves-new-moving-wl_process | unknown | 4-1-1-1-2-quantitative-submode-curves-new-inputed-copy | quantitative | configuration | measurement.ready | 8 |
| QUANT_SMODE_CRV_NEW_CUVETTE | 4-1-1-2 Quantitative-submode-curves-new-cuvette | unknown | QUANT_SMODE_CRV_NEW_CUVETTE | quantitative | navigation | measurement.ready | 18 |
| QUANT_SMODE_CRV_NEW_CUVETTE_IN | 4-1-1-2-1 Quantitative-submode-curves-new-cuvette-inputing | unknown | QUANT_SMODE_CRV_NEW_CUVETTE_IN | quantitative | configuration | measurement.ready | 9 |
| QUANT_SMODE_CRV_NEW_CUVETTE_IN_OK | 4-1-1-2-2 Quantitative-submode-curves-new-cuvette-inputed | unknown | QUANT_SMODE_CRV_NEW_CUVETTE_IN_OK | quantitative | configuration | measurement.ready | 9 |
| QUANT_SMODE_CRV_NEW_VALUE | 4-1-1-3 Quantitative-submode-curves-new-value | unknown | QUANT_SMODE_CRV_NEW_VALUE | quantitative | navigation | measurement.ready | 18 |
| QUANT_SMODE_CRV_NEW_STD | 4-1-1-4 Quantitative-submode-curves-new-standard | unknown | QUANT_SMODE_CRV_NEW_STD | quantitative | navigation | measurement.ready | 18 |
| QUANT_SMODE_CRV_NEW_STD_N114 | 4-1-1-5 n=1 Quantitative-submode-curves-new-standard Copy | unknown | QUANT_SMODE_CRV_NEW_STD_N114 | quantitative | navigation | measurement.ready | 18 |
| QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY | 4-1-1-4-1 Quantitative-submode-curves-new-standard-num_quantity | unknown | QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY | quantitative | navigation | measurement.ready | 13 |
| 4-1-1-4-1-quantitative-submode-curves-new-standard-num-quantity-copy | 4-1-1-4-2 Quantitative-submode-curves-number of parl meas | unknown | 4-1-1-4-1-quantitative-submode-curves-new-standard-num-quantity-copy | quantitative | navigation | measurement.ready | 13 |
| QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_IN | 4-1-1-4-1-2 Quantitative-submode-curves-new-standard-num_quantity-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_IN | quantitative | configuration | measurement.ready | 11 |
| QUANT_SMODE_CRV_NEW_STD_1_INPUTTING | 4-1-1-4-1-3  Quantitative-submode-curves-new-standard-С1-inputting | unknown | QUANT_SMODE_CRV_NEW_STD_1_INPUTTING | quantitative | configuration | measurement.ready | 23 |
| QUANT_SMODE_CRV_NEW_STD_1_IN | 4-1-1-4-1-4  Quantitative-submode-curves-new-standard-С1-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_1_IN | quantitative | configuration | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_2_IN | 4-1-1-4-1-5  Quantitative-submode-curves-new-standard-С2-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_2_IN | quantitative | configuration | measurement.ready | 26 |
| QUANT_SMODE_CRV_NEW_STD_C3_IN | 4-1-1-4-1-6  Quantitative-submode-curves-new-standard-C3-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_C3_IN | quantitative | configuration | measurement.ready | 27 |
| QUANT_SMODE_CRV_NEW_STD_4_IN | 4-1-1-4-1-7  Quantitative-submode-curves-new-standard-С4-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_4_IN | quantitative | configuration | measurement.ready | 23 |
| QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_INPUTTING | 4-1-1-4-1-1 Quantitative-submode-curves-new-standard-num_quantity-inputting | unknown | QUANT_SMODE_CRV_NEW_STD_NUM_QUANTITY_INPUTTING | quantitative | configuration | measurement.ready | 10 |
| QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN | 4-1-1-4-2-1 Quantitative-submode-curves-new-standard-num_parall-inputing | unknown | QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN | quantitative | configuration | input.parallel_count | 9 |
| QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN_OK | 4-1-1-4-2-2 Quantitative-submode-curves-new-standard-num_parall-inputed | unknown | QUANT_SMODE_CRV_NEW_STD_NUM_PARALL_IN_OK | quantitative | configuration | input.parallel_count | 9 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N431 | 4-1-1-5-1 Quantitative-submode-curves-new-standard-unit-моль/л | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N431 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N432 | 4-1-1-5-2 Quantitative-submode-curves-new-standard-unit-% | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N432 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N433 | 4-1-1-5-3 Quantitative-submode-curves-new-standard-unit-мкг/л | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N433 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N434 | 4-1-1-5-4 Quantitative-submode-curves-new-standard-unit-мг/л | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N434 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N435 | 4-1-1-5-5 Quantitative-submode-curves-new-standard-unit-мл/л | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N435 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N436 | 4-1-1-5-6 Quantitative-submode-curves-new-standard-unit-мг/мл | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N436 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N437 | 4-1-1-5-7 Quantitative-submode-curves-new-standard-unit-г | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N437 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_TCU | 4-1-1-5-8 Quantitative-submode-curves-new-standard-unit-TCU | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_TCU | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_UNIT_N439 | 4-1-1-5-9 Quantitative-submode-curves-new-standard-unit-усл_ед | unknown | QUANT_SMODE_CRV_NEW_STD_UNIT_N439 | quantitative | navigation | measurement.ready | 25 |
| QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH | 4-1-1-5 n=3 Quantitative-submode-curves-new-standard-calc_graphic | unknown | QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH | quantitative | navigation | measurement.ready | 18 |
| QUANT_SMODE_CRV_NEW_NEXT | 4-1-1-6 Quantitative-submode-curves-new-next | unknown | QUANT_SMODE_CRV_NEW_NEXT | quantitative | navigation | measurement.ready | 16 |
| QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_TYPE_REG_LIN | 4-1-1-3-1 Quantitative-submode-curves-new-standard-calc_graphic-type_regression-linear | unknown | QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_TYPE_REG_LIN | quantitative | navigation | measurement.ready | 13 |
| QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_AF_C | 4-1-1-3-1-1 Quantitative-submode-curves-new-standard-calc_graphic_function regression-A=f(C) | unknown | QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_AF_C | quantitative | navigation | measurement.ready | 11 |
| QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_CF_A | 4-1-1-3-1-2 Quantitative-submode-curves-new-standard-calc_graphic_function regression C=f(A) | unknown | QUANT_SMODE_CRV_NEW_STD_CALC_GRAPH_FUNCTION_REG_CF_A | quantitative | navigation | measurement.ready | 11 |
| QUANT_SMODE_CRV_NEW_ZERO | 4-1-1-6-1-1 Quantitative-submode-curves-new-zeroing | unknown | QUANT_SMODE_CRV_NEW_ZERO | quantitative | zeroing | measurement.zero | 34 |
| QUANT_SMODE_CRV_NEW_ST_1_PAR_1_MEAS | 4-1-1-6-1-2 Quantitative-submode-curves-new-st_1-par_1-meas | unknown | QUANT_SMODE_CRV_NEW_ST_1_PAR_1_MEAS | quantitative | navigation | measurement.ready | 37 |
| QUANT_SMODE_CRV_NEW_ST_2_PAR_1_MEAS | 4-1-1-6-1-3 Quantitative-submode-curves-new-st_2-par_1-meas | unknown | QUANT_SMODE_CRV_NEW_ST_2_PAR_1_MEAS | quantitative | navigation | measurement.ready | 40 |
| QUANT_SMODE_CRV_NEW_ST_3_PAR_1_MEAS | 4-1-1-6-1-4 Quantitative-submode-curves-new-st_3-par_1-meas | unknown | QUANT_SMODE_CRV_NEW_ST_3_PAR_1_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_4_PAR_1_MEAS | 4-1-1-6-1-5 Quantitative-submode-curves-new-st_4-par_1-meas | unknown | QUANT_SMODE_CRV_NEW_ST_4_PAR_1_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_1_PAR_2_MEAS | 4-1-1-6-1-6 Quantitative-submode-curves-new-st_1-par_2-meas | unknown | QUANT_SMODE_CRV_NEW_ST_1_PAR_2_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_2_PAR_2_MEAS | 4-1-1-6-1-7 Quantitative-submode-curves-new-st_2-par_2-meas | unknown | QUANT_SMODE_CRV_NEW_ST_2_PAR_2_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_3_PAR_2_MEAS | 4-1-1-6-1-8 Quantitative-submode-curves-new-st_3-par_2-meas | unknown | QUANT_SMODE_CRV_NEW_ST_3_PAR_2_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_4_PAR_2_MEAS | 4-1-1-6-1-9 Quantitative-submode-curves-new-st_4-par_2-meas | unknown | QUANT_SMODE_CRV_NEW_ST_4_PAR_2_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_1_PAR_3_MEAS | 4-1-1-6-1-10 Quantitative-submode-curves-new-st_1-par_3-meas | unknown | QUANT_SMODE_CRV_NEW_ST_1_PAR_3_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_2_PAR_3_MEAS | 4-1-1-6-1-11 Quantitative-submode-curves-new-st_2-par_3-meas | unknown | QUANT_SMODE_CRV_NEW_ST_2_PAR_3_MEAS | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_ST_3_PAR_3_MEAS | 4-1-1-6-1-12 Quantitative-submode-curves-new-st_3-par_3-meas | unknown | QUANT_SMODE_CRV_NEW_ST_3_PAR_3_MEAS | quantitative | navigation | measurement.ready | 43 |
| 4-1-1-6-1-12-quantitative-submode-curves-new-st-3-par-3-meas-copy | 4-1-1-6-1-13 Quantitative-submode-curves-new-st_3-par_4-meas | unknown | 4-1-1-6-1-12-quantitative-submode-curves-new-st-3-par-3-meas-copy | quantitative | navigation | measurement.ready | 43 |
| QUANT_SMODE_CRV_NEW_GRAPH_A_F_C | 4-1-1-6-1-graphic Quantitative-submode-curves-new-graphic-A_f(C) | unknown | QUANT_SMODE_CRV_NEW_GRAPH_A_F_C | quantitative | navigation | measurement.ready | 34 |
| 4-1-1-6-1-13-quantitative-submode-curves-new-graphic-a-f-c-copy | 4-1-1-6-1-graphic Quantitative-submode-curves-new-graphic-C_f(A) | unknown | 4-1-1-6-1-13-quantitative-submode-curves-new-graphic-a-f-c-copy | quantitative | navigation | measurement.ready | 34 |
| KIN_MEAS_RES_GRAPHICS_A_F_T | 2-1-4-2-4-1 Kinetic-measurement-result-graphics-A-f(t) | unknown | KIN_MEAS_RES_GRAPHICS_A_F_T | kinetics | measurement | measurement.measure | 17 |
| KIN_MEAS_RES_GRAPHICS_T_F_T | 2-1-4-2-4-2 Kinetic-measurement-result-graphics-T-f(t) | unknown | KIN_MEAS_RES_GRAPHICS_T_F_T | kinetics | measurement | measurement.measure | 17 |
| QUANT_SMODE_CRV_NEW_SAVE_YES | 4-1-1-6-2-1 Quantitative-submode-curves-new-save-yes | unknown | QUANT_SMODE_CRV_NEW_SAVE_YES | quantitative | save | result.save | 15 |
| QUANT_SMODE_CRV_NEW_SAVE_NO | 4-1-1-6-2-2 Quantitative-submode-curves-new-save-no | unknown | QUANT_SMODE_CRV_NEW_SAVE_NO | quantitative | save | result.save | 15 |
| QUANT_SMODE_CRV_NEW_SAVE_YES_STOR | 4-1-1-6-3-1 Quantitative-submode-curves-new-save-yes-storage | unknown | QUANT_SMODE_CRV_NEW_SAVE_YES_STOR | quantitative | save | result.save | 15 |
| QUANT_SMODE_CRV_NEW_SAVE_YES_USB | 4-1-1-6-3-2 Quantitative-submode-curves-new-save-yes-USB | unknown | QUANT_SMODE_CRV_NEW_SAVE_YES_USB | quantitative | save | result.save | 15 |
| QUANT_SMODE_CRV_NEW_SAVE_YES_NAME | 4-1-1-6-4-1 Quantitative-submode-curves-new-save-yes-naming | unknown | QUANT_SMODE_CRV_NEW_SAVE_YES_NAME | quantitative | save | input.filename | 11 |
| QUANT_SMODE_CRV_NEW_SAVE_YES_NAMED | 4-1-1-6-4-2 Quantitative-submode-curves-new-save-yes-named | unknown | QUANT_SMODE_CRV_NEW_SAVE_YES_NAMED | quantitative | save | result.save | 11 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEAS | 4-1-1-7-1 Quantitative-submode-curves-new-analys_parameter_para-meas | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEAS | quantitative | configuration | parameters.configure | 17 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES | 4-1-1-7-2 Quantitative-submode-curves-new-analys_parameter_analys_result | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES | quantitative | results | result.view | 19 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_OK | 4-1-1-7-3 Quantitative-submode-curves-new-analys_parameter_analys_result Copy | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_OK | quantitative | results | result.view | 17 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN | 4-1-1-7-1-1 Quantitative-submode-curves-new-analys_parameter_para-mea-inputing | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN | quantitative | configuration | parameters.configure | 13 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN_N723 | 4-1-1-7-1-2 Quantitative-submode-curves-new-analys_parameter_para-mea-inputing Copy | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_PARA_MEA_IN_N723 | quantitative | configuration | parameters.configure | 13 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_STATIS | 4-1-1-7-2-2 Quantitative-submode-curves-new-analys_parameter_analys_result-statis | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_STATIS | quantitative | results | result.view | 15 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_NO | 4-1-1-7-2-1 Quantitative-submode-curves-new-analys_parameter_analys_result-no | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_ANALYS_RES_NO | quantitative | results | result.view | 15 |
| QUANT_SMODE_CRV_NEW_ANALYS_PAR_MEAS_PARAL_1 | 4-1-1-8-3 Quantitative-submode-curves-new-analys_parameter_meas_paral-1 | unknown | QUANT_SMODE_CRV_NEW_ANALYS_PAR_MEAS_PARAL_1 | quantitative | configuration | parameters.configure | 39 |
| 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-4 | 4-1-1-8-2 Quantitative-submode-curves-new-analys_parameter_zeroed | unknown | 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-4 | quantitative | zeroing | measurement.zero | 37 |
| 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-3 | 4-1-1-8-1 Quantitative-submode-curves-new-analys_parameter_meas_zeroing | unknown | 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-3 | quantitative | zeroing | measurement.zero | 36 |
| 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-copy | 4-1-1-8-4 Quantitative-submode-curves-new-analys_parameter_meas_paral-1 Copy Copy | unknown | 4-1-1-8-2-quantitative-submode-curves-new-analys-parameter-meas-paral-1-copy-copy | quantitative | configuration | parameters.configure | 45 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES | 4-1-1-9-1 Quantitative-submode-curves-new-analys_save_result-yes | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES | quantitative | results | result.view | 10 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_NO | 4-1-1-9-2 Quantitative-submode-curves-new-analys_save_result-no | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_NO | quantitative | results | result.view | 12 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_USB | 4-1-1-10-2 Quantitative-submode-curves-new-analys_save_result-yes-USB | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_USB | quantitative | results | result.view | 12 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR | 4-1-1-10-1 Quantitative-submode-curves-new-analys_save_result-yes-storage | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR | quantitative | results | result.view | 12 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAME | 4-1-1-11-1 Quantitative-submode-curves-new-analys_save_result-yes-storage/USB-naming | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAME | quantitative | results | input.filename | 7 |
| QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAMED | 4-1-1-11-2 Quantitative-submode-curves-new-analys_save_result-yes-storage/USB-named | unknown | QUANT_SMODE_CRV_NEW_ANALYS_SAVE_RES_YES_STOR_USB_NAMED | quantitative | results | result.view | 7 |
| SET_DARK_MAIN | 7-1-1 Settings-Dark_current | unknown | SET_DARK_MAIN |  | settings | settings.configure | 15 |
| SET_DARKCURR_MEASUR_PROC | 7-1-1-1 Settings-Dark_current_measur_process | unknown | SET_DARKCURR_MEASUR_PROC |  | settings | settings.configure | 7 |
| SET_DARKCURR_MEASURED | 7-1-1-2 Settings-Dark_current_measured | unknown | SET_DARKCURR_MEASURED |  | measurement | measurement.measure | 17 |
| SET_DARKCURR_MEASURED_OK | 7-1-1-3 Settings-Dark_current_measured Copy | unknown | SET_DARKCURR_MEASURED_OK |  | measurement | measurement.measure | 19 |
| SET_DARKCURR_MEASURED_N114 | 7-1-1-4 Settings-Dark_current_measured Copy Copy | unknown | SET_DARKCURR_MEASURED_N114 |  | measurement | measurement.measure | 19 |
| SET_DARKCURR_MEASURED_N115 | 7-1-1-5 Settings-Dark_current_measured Copy Copy Copy | unknown | SET_DARKCURR_MEASURED_N115 |  | measurement | measurement.measure | 19 |
| SET_DARKCURR_MEASURED_N116 | 7-1-1-6 Settings-Dark_current_measured Copy Copy Copy Copy | unknown | SET_DARKCURR_MEASURED_N116 |  | measurement | measurement.measure | 19 |
| SET_DARKCURR_MEASURED_N117 | 7-1-1-7 Settings-Dark_current_measured Copy Copy Copy Copy Copy | unknown | SET_DARKCURR_MEASURED_N117 |  | measurement | measurement.measure | 17 |
| 7-1-1-7-settings-dark-current-measured-copy-copy-copy-copy-copy-copy | 7-1-1-7 Settings-Dark_current_measured Copy Copy Copy Copy Copy Copy | unknown | 7-1-1-7-settings-dark-current-measured-copy-copy-copy-copy-copy-copy |  | measurement | measurement.measure | 15 |
| SET_W_LAMP | 7-1-2 Settings-W_lamp | unknown | SET_W_LAMP |  | settings | settings.configure | 17 |
| SET_W_LAMP_ON | 7-1-2-1 Settings-W_lamp-on | unknown | SET_W_LAMP_ON |  | settings | settings.configure | 11 |
| SET_W_LAMP_OFF | 7-1-2-1 Settings-W_lamp-off | unknown | SET_W_LAMP_OFF |  | settings | settings.configure | 11 |
| SET_D2_LAMP | 7-1-3 Settings-D2_lamp | unknown | SET_D2_LAMP |  | settings | settings.configure | 17 |
| SET_D2_LAMP_ON | 7-1-3-1 Settings-D2_lamp-on | unknown | SET_D2_LAMP_ON |  | settings | settings.configure | 11 |
| SET_D2_LAMP_OFF | 7-1-3-2 Settings-D2_lamp-off | unknown | SET_D2_LAMP_OFF |  | settings | settings.configure | 11 |
| SET_FILE_SYS | 7-1-4 Settings-Files_system | unknown | SET_FILE_SYS |  | settings | settings.configure | 17 |
| SET_FILE_SYS_N141 | 7-1-4-1 Settings-Files_system | unknown | SET_FILE_SYS_N141 |  | settings | settings.configure | 18 |
| SET_DATA_TIME_IN_MONDAY | 7-1-6-1 Settings-Data_Time-inputing-monday | unknown | SET_DATA_TIME_IN_MONDAY |  | settings | settings.configure | 15 |
| SET_DATA_TIME_IN_TUESDAY | 7-1-6-2 Settings-Data_Time-inputing-tuesday | unknown | SET_DATA_TIME_IN_TUESDAY |  | settings | settings.configure | 14 |
| SET_DATA_TIME_IN_WESNESDAY | 7-1-6-3 Settings-Data_Time-inputing-wesnesday | unknown | SET_DATA_TIME_IN_WESNESDAY |  | settings | settings.configure | 15 |
| SET_DATA_TIME_IN_THURSDAY | 7-1-6-4 Settings-Data_Time-inputing-thursday | unknown | SET_DATA_TIME_IN_THURSDAY |  | settings | settings.configure | 14 |
| SET_DATA_TIME_IN_FRIDAY | 7-1-6-5 Settings-Data_Time-inputing-friday | unknown | SET_DATA_TIME_IN_FRIDAY |  | settings | settings.configure | 15 |
| SET_DATA_TIME_IN_SATURDAY | 7-1-6-6 Settings-Data_Time-inputing-saturday | unknown | SET_DATA_TIME_IN_SATURDAY |  | settings | settings.configure | 15 |
| SET_DATA_TIME_IN | 7-1-6-7 Settings-Data_Time-inputing Copy Copy Copy Copy Copy Copy | unknown | SET_DATA_TIME_IN |  | settings | settings.configure | 14 |
| SET_CHANGE_LAMP | 7-1-5 Settings-Change_lamp | unknown | SET_CHANGE_LAMP |  | settings | settings.configure | 17 |
| SET_CHANGE_LAMP_IN | 7-1-5-1 Settings-Change_lamp-inputing | unknown | SET_CHANGE_LAMP_IN |  | settings | settings.configure | 9 |
| SET_DATA_TIME | 7-1-6 Settings-Data_Time | unknown | SET_DATA_TIME |  | settings | settings.configure | 17 |
| SET_CAL | 7-1-7 Settings-Calibration_λ | unknown | SET_CAL | quantitative | settings | input.wavelength | 17 |
| SET_CAL_PROC | 7-1-7-1 Settings-Calibration_λ-process | unknown | SET_CAL_PROC | quantitative | settings | input.wavelength | 5 |
| SET_CAL_OK | 7-1-7-2 Settings-Calibration_λ-success | unknown | SET_CAL_OK | quantitative | settings | input.wavelength | 5 |
| SET_CAL_MISTAKE | 7-1-7-3 Settings-Calibration_λ-mistake | unknown | SET_CAL_MISTAKE | quantitative | settings | input.wavelength | 5 |
| SET_ABOUT_SYS | 7-1-9 Settings-About_system | unknown | SET_ABOUT_SYS |  | settings | settings.configure | 17 |
| SET_ABOUT_SYS_N191 | 7-1-9-1 Settings-About_system | unknown | SET_ABOUT_SYS_N191 |  | settings | settings.configure | 14 |
| SET_SYS_DEFAULT | 7-1-8 Settings-System_Default | unknown | SET_SYS_DEFAULT |  | settings | settings.configure | 17 |
| SET_SYS_DEFAULT_YES | 7-1-8-1 Settings-System_Default_yes | unknown | SET_SYS_DEFAULT_YES |  | settings | settings.configure | 11 |
| SET_SYS_DEFAULT_YES_N182 | 7-1-8-2 Settings-System_Default_yes Copy | unknown | SET_SYS_DEFAULT_YES_N182 |  | settings | settings.configure | 11 |
| SHARED_PRNT_CONN | Printer connected | unknown | SHARED_PRNT_CONN |  | print | result.print | 2 |
| SHARED_PRNT_DISC | Printer disconnected | unknown | SHARED_PRNT_DISC |  | print | result.print | 2 |
| SHARED_PC_CONN | PC connected | unknown | SHARED_PC_CONN |  | unknown | unknown | 2 |
| PC_DISCONN | PC disconnected | unknown | PC_DISCONN |  | unknown | unknown | 2 |
| SHARED_USB_NO_DET | USB-storage connected | unknown | SHARED_USB_NO_DET |  | save | result.save | 3 |
| USB_STOR_DISCONN | USB-storage disconnected | unknown | USB_STOR_DISCONN |  | save | result.save | 3 |
| SHARED_PRNT_NO_DET | Printer not connected | unknown | SHARED_PRNT_NO_DET |  | print | result.print | 2 |
| screen | 5-1-1 Kinetic-parameter-mode | unknown | KIN_PAR_MODE | kinetics | configuration | parameters.configure | 13 |
| KIN_PAR_LAYERS | 5-1-2 Kinetic-parameter-layers | unknown | KIN_PAR_LAYERS | kinetics | configuration | parameters.configure | 15 |
| KIN_PAR_TIME | 5-1-3 Kinetic-parameter-time | unknown | KIN_PAR_TIME | kinetics | configuration | parameters.configure | 15 |
| KIN_PAR_NEXT | 5-1-4 Kinetic-parameter-next | unknown | KIN_PAR_NEXT | kinetics | configuration | parameters.configure | 13 |
| KIN_PAR_MODE_A | 5-1-1-1 Kinetic-parameter-mode-A | unknown | KIN_PAR_MODE_A | kinetics | configuration | parameters.configure | 11 |
| KIN_PAR_MODE_T | 5-1-1-2 Kinetic-parameter-mode-T | unknown | KIN_PAR_MODE_T | kinetics | configuration | parameters.configure | 11 |
| KIN_PAR_LAYERS_LOW_INPUTTING_A | 5-1-2-1-1 Kinetic-parameter-layers-low-inputting-A | unknown | KIN_PAR_LAYERS_LOW_INPUTTING_A | kinetics | configuration | parameters.configure | 13 |
| 5-1-2-1-1-kinetic-parameter-layers-low-inputting-a-copy-2 | 5-1-2-2-1 Kinetic-parameter-layers-low-inputting-%T | unknown | 5-1-2-1-1-kinetic-parameter-layers-low-inputting-a-copy-2 | kinetics | configuration | parameters.configure | 13 |
| 5-1-2-1-1-kinetic-parameter-layers-low-inputting-a-copy | 5-1-2-1-2 Kinetic-parameter-layers-low-inputed-A | unknown | 5-1-2-1-1-kinetic-parameter-layers-low-inputting-a-copy | kinetics | configuration | parameters.configure | 13 |
| 5-1-2-1-2-kinetic-parameter-layers-low-inputed-a-copy-2 | 5-1-2-2-2 Kinetic-parameter-layers-low-inputed-%T | unknown | 5-1-2-1-2-kinetic-parameter-layers-low-inputed-a-copy-2 | kinetics | configuration | parameters.configure | 13 |
| 5-1-2-1-2-kinetic-parameter-layers-low-inputed-a-copy | 5-1-2-1-3 Kinetic-parameter-layers-high-inputting-A | unknown | 5-1-2-1-2-kinetic-parameter-layers-low-inputed-a-copy | kinetics | configuration | parameters.configure | 13 |
| 5-1-2-1-3-kinetic-parameter-layers-high-inputting-a-copy | 5-1-2-2-3 Kinetic-parameter-layers-high-inputed-%T | unknown | 5-1-2-1-3-kinetic-parameter-layers-high-inputting-a-copy | kinetics | configuration | parameters.configure | 13 |
| KIN_PAR_TIME_INPUTTING_TIMESTEP | 5-1-3-1 Kinetic-parameter-time-inputting-timestep | unknown | KIN_PAR_TIME_INPUTTING_TIMESTEP | kinetics | configuration | parameters.configure | 11 |
| 5-1-3-1-kinetic-parameter-time-inputting-timestep-copy | 5-1-3-2 Kinetic-parameter-time-inputed-timestep | unknown | 5-1-3-1-kinetic-parameter-time-inputting-timestep-copy | kinetics | configuration | parameters.configure | 11 |
| 5-1-3-2-kinetic-parameter-time-inputed-timestep-copy | 5-1-3-3 Kinetic-parameter-time-inputed-time_all | unknown | 5-1-3-2-kinetic-parameter-time-inputed-timestep-copy | kinetics | configuration | parameters.configure | 11 |
| KIN_MEAS_RES_TABLE | 5-3-2 Kinetic-measurement-result-table | unknown | KIN_MEAS_RES_TABLE | kinetics | measurement | measurement.measure | 19 |
| MUTLIWAVELENGTH_PAR_MODE | 6-1-1 Mutliwavelength-parameter-mode | unknown | MUTLIWAVELENGTH_PAR_MODE | multiwave | configuration | input.wavelength | 13 |
| MUTLIWAVELENGTH_PAR_MODE_A | 6-1-1-1 Mutliwavelength-parameter-mode-A | unknown | MUTLIWAVELENGTH_PAR_MODE_A | multiwave | configuration | input.wavelength | 11 |
| MUTLIWAVELENGTH_PAR_MODE_T | 6-1-1-2 Mutliwavelength-parameter-mode-%T | unknown | MUTLIWAVELENGTH_PAR_MODE_T | multiwave | configuration | input.wavelength | 11 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL | 6-1-2 Mutliwavelength-parameter-number_wl | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL | multiwave | configuration | input.wavelength | 13 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN | 6-1-2-1-1 Mutliwavelength-parameter-number_wl-inputing | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN | multiwave | configuration | input.wavelength | 8 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK | 6-1-2-1-2 Mutliwavelength-parameter-number_wl-inputed | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_OK | multiwave | configuration | input.wavelength | 8 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1 | 6-1-2-2-1 Mutliwavelength-parameter-number_wl-inputed_1 | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_1 | multiwave | configuration | input.wavelength | 17 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL | 6-1-2-2-1-1 Mutliwavelength-parameter-number_wl-inputing_wl | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL | multiwave | configuration | input.wavelength | 11 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK | 6-1-2-2-1-2 Mutliwavelength-parameter-number_wl-inputed_wl | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_WL_OK | multiwave | configuration | input.wavelength | 11 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2 | 6-1-2-2-2 Mutliwavelength-parameter-number_wl-inputed_2 | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_2 | multiwave | configuration | input.wavelength | 21 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3 | 6-1-2-2-3 Mutliwavelength-parameter-number_wl-inputed_3 | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_3 | multiwave | configuration | input.wavelength | 21 |
| MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4 | 6-1-2-2-4 Mutliwavelength-parameter-number_wl-inputed_4 | unknown | MUTLIWAVELENGTH_PAR_NUMBER_WL_IN_4 | multiwave | configuration | input.wavelength | 19 |
| MUTLIWAVELENGTH_PAR_NEXT | 6-1-3 Mutliwavelength-parameter-next | unknown | MUTLIWAVELENGTH_PAR_NEXT | multiwave | configuration | input.wavelength | 11 |
| MUTLIWAVELENGTH_MEAS_ZERO_262_2 | 6-2-1 Mutliwavelength-measurement_zero_262.2 | unknown | MUTLIWAVELENGTH_MEAS_ZERO_262_2 | multiwave | zeroing | measurement.zero | 21 |
| MUTLIWAVELENGTH_MEAS_ZERO_SET_WL | 6-2-2 Mutliwavelength-measurement_zero_set wl | unknown | MUTLIWAVELENGTH_MEAS_ZERO_SET_WL | multiwave | zeroing | measurement.zero | 21 |
| MUTLIWAVELENGTH_MEAS_ZERO_431_4 | 6-2-3 Mutliwavelength-measurement_zero_431.4 | unknown | MUTLIWAVELENGTH_MEAS_ZERO_431_4 | multiwave | zeroing | measurement.zero | 21 |
| MUTLIWAVELENGTH_MEAS_ZERO_585_6 | 6-2-4 Mutliwavelength-measurement_zero_585.6 | unknown | MUTLIWAVELENGTH_MEAS_ZERO_585_6 | multiwave | zeroing | measurement.zero | 23 |
| MUTLIWAVELENGTH_MEAS_ZERO_685_5 | 6-2-5 Mutliwavelength-measurement_zero_685.5 | unknown | MUTLIWAVELENGTH_MEAS_ZERO_685_5 | multiwave | zeroing | measurement.zero | 23 |
| MUTLIWAVELENGTH_MEAS_262_2 | 6-2-6 Mutliwavelength-measurement_meas_262.2 | unknown | MUTLIWAVELENGTH_MEAS_262_2 | multiwave | measurement | measurement.measure | 26 |
| MUTLIWAVELENGTH_MEAS_ZERO_WL_TRANSIT | 6-2-7 Mutliwavelength-measurement_zero_wl_transit | unknown | MUTLIWAVELENGTH_MEAS_ZERO_WL_TRANSIT | multiwave | zeroing | measurement.zero | 24 |
| MUTLIWAVELENGTH_MEAS_431_4 | 6-2-8 Mutliwavelength-measurement_meas_431.4 | unknown | MUTLIWAVELENGTH_MEAS_431_4 | multiwave | measurement | measurement.measure | 29 |
| 6-2-8-mutliwavelength-measurement-meas-431-4-copy | 6-2-8 Mutliwavelength-measurement_meas_431.4 Copy | unknown | 6-2-8-mutliwavelength-measurement-meas-431-4-copy | multiwave | measurement | measurement.measure | 27 |
| MUTLIWAVELENGTH_MEAS_585_5_MEAS | 6-2-9 Mutliwavelength-measurement_585.5_meas | unknown | MUTLIWAVELENGTH_MEAS_585_5_MEAS | multiwave | measurement | measurement.measure | 32 |
| MUTLIWAVELENGTH_MEAS_685_5 | 6-2-10 Mutliwavelength-measurement_meas 685,5 | unknown | MUTLIWAVELENGTH_MEAS_685_5 | multiwave | measurement | measurement.measure | 32 |

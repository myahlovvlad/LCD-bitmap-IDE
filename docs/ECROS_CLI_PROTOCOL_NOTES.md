# ECROS-5300VI/5310 CLI Contract Notes

Source: operator-provided terminal specification, reviewed 2026-07-29.

## Confirmed transport

- 115200 baud, 8 data bits, no parity, 1 stop bit.
- No flow control.
- ISO-8859-1 (`latin1`) byte decoding.
- CR command terminator.
- Synchronous single-command execution; maximum concurrency is one.
- All commands except `connect` require a successful protocol connection.

## Corrected interpretation

The single-beam equations used by the simulator and C generator are:

```text
%T = 100 * (E_sample - E_dark) / (E_100 - E_dark)
A  = log10((E_100 - E_dark) / (E_sample - E_dark))
```

The supplied absorbance text omitted parentheses around the denominator.

## Protocol ambiguities requiring firmware confirmation

1. The `getsoftver` example labels its input as `gettype`; the implementation
   uses `getsoftver`.
2. The `setsn` section labels its example input as `getsn ECROS5310-001`; the
   implementation uses `setsn <serial>`.
3. Response contracts for `getsample`, `getslip`, and `ud` are undocumented.
   They are retained as free-text commands and must not drive measurement
   validity until examples are supplied.
4. The end marker for variable-length text responses is not documented.
   The serial adapter uses a 120 ms quiet interval after received data.
5. `quit`, `sa`, and `boot` are documented with empty responses. The adapter
   completes them after the same quiet interval.
6. The valid maximum argument of `ge N` is not documented.
7. The specification says `E_100` is in the range 0–65035; confirm whether
   65035 is intentional or a typo for 65535.
8. The exact calibration convention for coefficients `m` and `k` must be
   confirmed. The current configurable default is `A = m*C + k`.
9. The mathematical definition of repeatability `r, %` must be supplied.

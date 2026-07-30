# ECROS CLI And HMI Operational Contract

Sources: operator-provided ECROS-5300VI/5310 and ECROS-5501 terminal
specifications plus the ECROS-5501 session log from 2025-12-17. Reviewed
2026-07-30.

## Confirmed transport

- 115200 baud, 8 data bits, no parity, 1 stop bit.
- No flow control.
- ISO-8859-1 (`latin1`) byte decoding.
- CR command terminator.
- Synchronous single-command execution; maximum concurrency is one.
- All commands except `connect` require a successful protocol connection.
- Commands are serialized by both desktop adapters; a second command is not
  written while the previous one is waiting for its terminating response.

## ECROS-5501 operational state

The HMI simulator uses one stateful ECROS-5501 model instead of returning
`ok.` for every procedure step. It tracks:

- CLI connection;
- working wavelength and physical grating position separately;
- filter-wheel position;
- sample and reference gain;
- lamp switch wavelength, lamp power and selected optical path;
- fixed 1.8 nm slit;
- optional automatic cuvette holder and its position;
- reference, sample and per-gain dark-current ADC values.

### Wavelength and filter-wheel policy

`swl` changes both the grating and the filter wheel:

| Wavelength | Filter position | Meaning |
| --- | ---: | --- |
| 190 to <320 nm | 4 | open path, no filter |
| 320 to <370 nm | 2 | violet |
| 370 to <450 nm | 1 | blue |
| 450 to <585 nm | 8 | green |
| 585 to <850 nm | 7 | yellow |
| 850 to 1100 nm | 6 | red |

`swm` changes only the grating position. It intentionally does not change the
working wavelength or filter-wheel position.

`resetdark` temporarily moves the filter wheel to position 3 (shutter), reads
dark current for gain 1 through 8, and restores the previous filter.

`adjustwl` models the observed calibration sequence: turn on the deuterium
lamp, open the filter path, find the 651.1 nm reference line, then return to
546 nm and select the green filter at position 8.

### Capability gates

- ECROS-5501 is single-beam with a fixed 1.8 nm slit, so `setslit` must fail.
- `setsampler 1..8` is valid only when an automatic holder is installed.
- Holder position 1 is the reference/blank; positions 2–8 are analysis samples.
- Model, beam mode and slit options are derived from `gettype`/`getsn`, not
  selected independently on a measurement screen.

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
3. The end marker for variable-length text responses is not documented.
   The serial adapter uses a 120 ms quiet interval after received data.
4. Empty-result commands appear to emit a terminating CR/LF after the physical
   operation. The adapters wait for that byte so a motor command cannot overlap
   the next command.
5. The firmware accepts `ge 20`, but its actual maximum is not documented. The
   authoring contract uses a conservative maximum of 1000.
6. The specification says `E_100` is in the range 0–65035; confirm whether
   65035 is intentional or a typo for 65535.
7. The exact calibration convention for coefficients `m` and `k` must be
   confirmed. The current configurable default is `A = m*C + k`.
8. The mathematical definition of repeatability `r, %` must be supplied.
9. ECROS-5501 filter position 5 is described only as an unfiltered/reserved
   position. Automatic `swl` selection therefore uses position 4 for the open
   190–319 nm range.

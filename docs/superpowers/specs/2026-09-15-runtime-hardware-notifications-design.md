# Runtime hardware notifications

## Purpose

Model USB, printer and PC connect/disconnect screens as transient runtime
notifications. They must not require ordinary FSM arrows from arbitrary LCD
screens and must return the operator to the exact screen that was visible
before the notification.

## Design

The runtime session owns a nullable `hardwareNotification` record containing
the equipment kind, the present/absent value, the mapped LCD screen ID and the
interrupted FSM state ID. Project FSM states and transition data remain
unchanged.

When a monitored tag changes (`io.usb_present`, `io.printer_present`, or
`io.pc_present`), the runtime maps it to the corresponding project screen and
opens an overlay. It does not change `currentStateId` or execute a normal FSM
transition. Acknowledge, timeout, stop and reset clear the overlay and resume
the saved state. A second hardware change replaces the existing notification
without losing the interrupted state.

## UI and automation

The runtime workspace renders the notification screen above the active LCD
screen, exposes its equipment/status and the return target, and offers an
acknowledge action. Runtime automation reports the active notification so
scenario tests can assert it. Tags remain the single source of truth.

## Safety and validation

The feature is runtime-only: it neither changes exported firmware data nor
adds misleading regular edges to the FSM graph. Validation will classify
configured hardware notification screens as externally reachable, while still
reporting missing screen mappings or missing `io.*_present` tags.

## Verification

Unit tests will cover mapping, interruption, acknowledgement, replacement,
timeout and reset. Runtime/UI tests will verify that a normal user transition
continues from the pre-notification state. Existing FSM validation and export
tests must remain green.

# Data Model Draft

## Core

- `tenant`
- `organization_unit`
- `user`
- `membership`
- `role`
- `permission`
- `role_assignment`
- `audit_event`

## Groupware

- `calendar_event`
- `facility`
- `facility_reservation`
- `notice`
- `notice_read_receipt`
- `workflow_template`
- `workflow_request`
- `workflow_step`
- `document`
- `document_version`
- `notification`

## Required Columns

Most tables should include:

- `id`
- `tenant_id`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`

Security-sensitive tables should include immutable event records instead of destructive updates.


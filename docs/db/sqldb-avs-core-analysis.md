# sqldb-avs-core Usage Analysis

Date: 2026-03-26

## Scope
This analysis covers the backlog items:
- T3285 `sqldb-avs-core` usage analysis
- T3286 remove if unused
- US3284 Azure SQL cleanup
- T3289 database change

## Findings
- Current frontend app uses mock in-memory API (`src/services/api.ts`) and does not include a runtime SQL client.
- Required identity model for implemented stories needs a `users` table with Microsoft-email login mapping, roles, and permission metadata.
- Support and guest RFQ ownership now relies on user id; schema should persist `created_by_user_id` for authorization stability.

## Proposed SQL objects
- `dbo.users`
- `dbo.user_permissions`
- `dbo.support_tickets`
- `dbo.guest_rfqs`

## Cleanup recommendation
1. Backup legacy tables and export DDL.
2. Run usage checks for dependencies (FK/proc/view/index).
3. Drop confirmed unused legacy objects only after dependency check passes.

## Delivered artifacts in this repo
- `sql/001_create_identity_and_support.sql`
- `sql/002_analyze_and_cleanup_legacy.sql`

These scripts are prepared for Azure SQL and can be adapted in release pipeline.

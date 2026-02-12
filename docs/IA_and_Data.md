# Information Architecture & Data Model

## URL Structure
- `/` - Home (Trending bills, claims).
- `/bills` - Index of all bills (filterable).
- `/bill/[congress]/[type]/[number]` - Bill Detail (e.g., `/bill/118/hr/1234`).
  - Tabs embedded as query params or sub-routes (e.g., `?view=text`).
- `/claims` - Index of fact-checks.
- `/claim/[id]` - specific claim fact-check page.
- `/search` - Search results.
- `/methodology` - Trust & Process.

## Data Model (ERD Concept)

### Bill
- **ID**: UUID
- **ExternalID**: (congress + type + number)
- **Metadata**: Title, Sponsor, Intro Date, Status.
- **Resources**: Link to Congress.gov.
- **Versions**: One-to-Many relation to BillVersion.
- **Actions**: One-to-Many relation to BillAction.

### BillVersion
- **ID**: UUID
- **BillID**: FK
- **VersionCode**: (e.g., "ih", "enr")
- **TextHash**: SHA256 of content.
- **FullText**: Text (or stored in blob storage/file).
- **ParsedSections**: JSON (structured breakdown).
- **Summary**: JSON (computed AI summary).
- **CreatedAt**: Timestamp.

### BillAction
- **ID**: UUID
- **BillID**: FK
- **Date**: DateTime
- **Description**: String.

### Claim
- **ID**: UUID
- **BillID**: FK (Optional, if linked)
- **SourceText**: String (the viral claim).
- **SourceUrl**: String.
- **Verdict**: Enum (Accurate, False, etc.)
- **Evidence**: JSON (Quotes, Section IDs).
- **Explanation**: String.
- **Confidence**: Int/Enum.

### JobLog
- **ID**: UUID
- **JobType**: String (Ingest, Diff, Summary).
- **Status**: Success/Fail.
- **Output**: JSON log.

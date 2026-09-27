# Report resolution audit follow-up

Report resolution currently records `status` and `resolved_at` in
`resource_reports`. The checked-in historical schema does not define that table,
and no checked-in runtime schema script provides a reviewer identity column or
an audit mechanism for report resolution. The live database schema has not been
inspected.

The API therefore does not persist a reviewer identity. It does not accept one
from the request body. Access to the resolution route remains protected by the
shared authenticated-admin middleware, which derives administrator access from
the verified Firebase token and the corresponding active administrator record.

Before enabling report-resolution auditing in a deployment, reconcile the
actual schema and review a separate schema proposal for persisting the verified
Firebase UID and an append-only resolution event. Any future implementation
must source reviewer identity from `req.auth.uid`, never caller input. No
migration is included or executed as part of this work.

from pathlib import Path
import collections
import hashlib
import html
import json
import subprocess

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
findings = json.loads((OUT / 'findings.json').read_text())
improvements = [
    ('First', 'Lock a shift once attendance starts', 'Keep the shift assignment, date and scheduled hours fixed after clock-in, including after clock-out. Check both sides of an interchange or peer swap. Apply the rule to requests, approval and bulk scheduling. Future unrelated shifts should remain editable.', 'An employee who has started today’s 10:00 shift cannot move it to 12:00 or exchange that worked day. A manager sees why it is locked. A historical correction uses a separate audited workflow.', ['F01','F02','F03','F04','F05']),
    ('First', 'Make clock-in and clock-out safe to retry', 'Use a unique operation ID and an exact attendance session for each swipe. Enforce one active session in the database, reject failed eligibility reads, and confirm saved state after an uncertain network response. Do not wait for push delivery before acknowledging attendance.', 'If a phone loses its connection after a swipe, reopening or retrying shows the saved result instead of creating another attendance row or closing a newer session.', ['F06','F07','F09','F10','F32']),
    ('First', 'Improve location feedback and verification', 'Keep the existing quick-location/refinement flow, but validate finite coordinates and store configuration on the server too. Give clear permission, accuracy and timeout messages. Add a bounded attendance-save timeout with reconciliation. Provide a reasoned manager-assisted exception when legitimate staff cannot obtain GPS.', 'Staff see whether the app is finding a location or saving attendance. Missing store coordinates cannot silently produce a verified clock-in. Clock-out remains available without GPS.', ['F08','F09','F32']),
    ('First', 'Make re-entry and corrections explicit', 'Keep original attendance events, link each request to an exact attendance record, require a reason and single-use approval, and preserve who approved it. Distinguish correcting an accidental checkout from returning after an actual off-duty break.', 'Approving an accidental-checkout correction cannot reopen an unrelated day or be reused repeatedly. Real break time is not silently paid as continuous work.', ['F11','F12']),
    ('First', 'Use one store clock and reliable time calculations', 'Use Asia/Kolkata for business dates and convert event times consistently. Handle overnight shifts, half-open day/month boundaries and cross-month leave. Share calculation helpers between attendance, payroll and reports.', 'Manual 10:00 entry means 10:00 IST everywhere. A shift ending after midnight belongs to the correct shift day. Reports agree regardless of the server or viewer timezone.', ['F12','F13','F14','F18']),
    ('First', 'Make payroll period-based and reviewable', 'Calculate amounts on the server, check payroll authorization, use precise worked minutes, filter payments by month and year, and prevent duplicate settlement. Show regular hours, overtime, rate, advances, adjustments and net pay. Confirm whether overtime is a total 1.5x rate or an additional premium.', 'A prior-year November advance does not reduce this November’s pay. The current formula pays overtime hours at a combined 2.5x rate when Auto OT is added; the app should apply your chosen policy explicitly.', ['F15','F16','F17','F18']),
    ('Next', 'Turn shift and leave requests into clear workflows', 'Store request type, target preset/date and affected shift IDs as structured data. Show a before/after preview, current status, decision reason and timeline. Prevent duplicates and reject stale approvals. Check worked shifts, overlapping leave and staffing conflicts.', 'Employees select “change time” or “move day off” without ambiguous generated messages. A request cancelled or invalidated by clock-in cannot later be approved from an old browser tab.', ['F02','F03','F04','F05','F14']),
    ('Next', 'Repair checklist setup and trustworthy completion', 'Separate reusable template items from daily run items. Create one appropriate checklist per store/day/type, support staff collaboration, require mandatory items/photo proof before completion, and freeze completed runs unless explicitly reopened.', 'Opening and closing checklists contain the intended template items. A colleague can finish their assigned item, and an empty checklist cannot count as a completed opening.', ['F23','F24']),
    ('Next', 'Make task and audit actions match employee responsibilities', 'Let employees complete authorized assigned work with an explicit Complete action. Keep cancelled work closed. Restrict audit execution to managers/admins, validate scores, preserve template versions, and fix audit links plus record deletion.', 'Repeating a completion request does not undo a task. A five-point audit question cannot receive 999 points. Starting an audit opens its actual detail page.', ['F25','F26','F27','F28']),
    ('Next', 'Keep photos and forms reliable on phones', 'Fix multi-image selection, accumulate uploaded URLs correctly, compress images, validate files on the server, save drafts, and clean up cancelled uploads. Save each report and its child records atomically or with an explicit resumable state.', 'Selecting three photos keeps all three. An interrupted upload does not silently lose proof or leave duplicate empty damage/restock reports.', ['F29','F30']),
    ('Next', 'Enforce role, store and privacy rules in the database', 'Bind authorship to the signed-in user, restrict approvals to authorized reviewers, preserve store ownership, scope manager access, and limit private report/notification reads. Reconcile migrations before applying new policies. Use a generic offline shell for private HR pages on shared devices.', 'Employee, manager and admin permissions are consistent even when someone bypasses the screen. Signing out does not leave the previous user’s private page available through offline navigation.', ['F19','F20','F21','F22','F31','F33']),
    ('Later', 'Show actionable alerts and accurate operations reports', 'Prioritize today’s active shift, pending approvals and due tasks. Deliver notifications to the intended person after the business transaction. Add real period filters and compliance metrics, avoid penalizing cancelled/override requests as unreliability, and verify recurring tasks, expiry reminders and auto-checkout jobs. Test Android login, GPS, reconnect and report saving on a real device.', 'Managers can distinguish an overdue task from a completed one, see last successful automation runs, and reconcile dashboard numbers with actual records. Alerts are useful rather than noisy.', ['F18','F31','F32','F34','F35']),
]

intro = '''THE MAKEUP STORE HRM — IMPROVEMENT REVIEW
24 November 2026 · Local source assessment · No product changes or production writes

Your shift concern is correct: an employee’s ordinary change request should be blocked once attendance begins for that shift, and the lock should remain after clock-out. Future unworked shifts should still be eligible. A manager/admin correction should be an explicit audited exception.

The highest-value improvements are consistent business rules, dependable retries, accurate time/pay calculations, and simpler completion/approval workflows. The current app has useful foundations: attendance identity checks, server-generated attendance event times, an admin-only helper for privileged corrections, cancellable GPS refinement, and visible loading/retry states. Several rules currently stop at the screen rather than being enforced end to end.

This review provides 12 improvement groups and a technical appendix of 35 findings. Priorities are proposed implementation order, not promises about effort or claims that every possible defect has been found. No fixes have been applied; existing uncommitted product changes were preserved.
'''

rules = [
    ('Future shift with no attendance', 'Allow an otherwise valid request, with conflict and eligibility checks.'),
    ('Today, before clock-in', 'Allow if your request cutoff policy permits it; recheck when approving.'),
    ('Clocked in / attendance active', 'Block ordinary changes to that shift’s employee, date and scheduled hours.'),
    ('Clocked out / auto-checked out', 'Keep the ordinary shift-change lock. Checkout does not erase that the shift was worked.'),
    ('Two-day interchange or peer swap', 'Block if either affected shift has attendance or otherwise conflicts.'),
    ('Request pending when employee clocks in', 'Allow attendance under the current valid schedule; invalidate/expire the incompatible request atomically or reject its later approval.'),
    ('Unrelated future shift while employee is clocked in today', 'Continue allowing eligible requests for that future shift.'),
    ('Accidental checkout / historical correction', 'Use an exact attendance ID, single-use approval, reason and preserved original events; keep it separate from ordinary shift change.'),
]

verification = '''WHAT WAS VERIFIED
• 25 isolated checks execute actual TypeScript handlers or extracted UI handlers against fictional in-memory data: 24 characterize defects and one checks that cross-user attendance/request identity is rejected. Passing these checks confirms the observed behavior; it does not mean the behavior is correct or that production lacks extra database protection.
• 11 PostgreSQL checks used the actual 002/003/004 migration files against a temporary PostgreSQL 17 database with minimal fictional profiles/stores and an auth.uid fixture. The temporary server used a local Unix socket with TCP disabled and was stopped afterward.
• Unmodified 002/003 policy behavior, checklist FK failure, 004 migration failure and 003 rerun failure were reproduced. For a separate test of intended 004 policies, notification_log was explicitly excluded from a temporary string copy of its failing policy block. Those adjusted-fixture results do not prove that unmodified 004 applies or that those policies exist in production.
• Anonymous-read tests explicitly granted table SELECT in the fixture. Real exposure depends on deployed grants, Data API settings and RLS.
• Existing attendance-location tests: 10/10 pass. TypeScript: npm run typecheck passes.
• Source-only ESLint over app, components, lib, proxy.ts and next.config.ts: 216 errors, 29 warnings across 196 scanned files. Full npm run lint: 26,503 errors and 31 warnings, including generated Android/build/service-worker artifacts. The source-only result confirms this is not solely generated-file noise. These are current workspace results, not a claimed regression caused by this audit.

LIMITS AND DEPLOYMENT DISTINCTION
The review examined the local worktree, not a verified production deployment. Live pg_policies, base attendance/profile/payroll constraints, triggers, grants, storage bucket rules, Auth settings, Realtime publications, cron jobs and external functions were not inspected. A service-role application key is not a substitute for read-only PostgreSQL catalog access. No employee records were queried and no exploit was sent to production. Missing server checks are confirmed; additional live database protection is explicitly unknown.

Only store-operations migrations 002–004 are present. Core auth/attendance/scheduling/payroll schema definitions and the manual_trigger_checkout implementation are not versioned here. The Android APK is an online wrapper around the deployed HTTPS site: rebuilding it does not deploy local Next.js fixes. The wrapper’s device-level login, location, reconnect, push and document saving need separate real-device acceptance tests. No production build was rerun for this report-only task, avoiding generated product asset changes.
'''

next_steps = '''RECOMMENDED DELIVERY ORDER
1. Attendance and shift integrity: shift locks, structured requests, transaction/state checks, idempotent attendance and audited corrections. Add focused regression tests for both ordinary and concurrent flows.
2. Time and payroll: one timezone model, manual-entry fix, precise hours, explicit overtime policy, period ledger and duplicate-payment protection. Reconcile sample payslips before enabling changes.
3. Operational completion: checklist schema repair, task assignment transitions, audit routes/scoring, atomic report creation and phone uploads. Deliver and verify one module at a time.
4. Permissions and operational readiness: reconcile deployed schema/policies, apply reviewed forward migrations, verify alerts/automation, exclude private pages from offline caching and run Android acceptance checks. Permission exposure checks should be prioritized immediately if live policies match the permissive repository definitions.

READ-ONLY LIVE FOLLOW-UP NEEDED
Inspect policies/grants for profiles (especially role, hourly_rate and store_id updates), attendance, shifts, requests, payroll, push subscriptions and operations tables. Verify partial unique/overlap constraints for attendance, shift-mutation guard triggers, request status constraints and payroll idempotency. Check manual_trigger_checkout function privileges/SECURITY DEFINER configuration, actual cron schedule, storage.objects policies and bucket privacy, Realtime publication, Auth signup/rate-limit/session settings, proxy handling of forwarded IP, and the deployed web revision. The companion live-inspection.sql contains catalog-only queries; it does not call business functions or change data.

ACCEPTANCE SCENARIOS FOR THE FIRST IMPLEMENTATION
• Clock in, then attempt a time change, date move, peer swap and bulk schedule change: all ordinary mutations affecting the worked shift are rejected consistently.
• Submit a request, then clock in before approval; approving the stale request returns a clear conflict.
• Clock out and attempt the same changes: the shift remains locked. Another future shift is still requestable.
• Source is unworked but target/peer shift was worked: the exchange is blocked.
• Double swipe, two phones, delayed/replayed requests and failed response after a successful commit produce one intended attendance outcome.
• GPS permission denied, slow, inaccurate or missing store location produces clear feedback without false verification. Clock-out still works without GPS.
• Correct an accidental checkout once with reason/approver; preserve original events and reject replay. A real break remains excluded from worked time.
• Manually enter 10:00 IST and verify the identical business time in logs, reports and payroll. Verify overnight and month/year boundaries.
• Two simultaneous settlements and a network retry create one intended payment operation; a prior-year payment does not reduce this period’s balance.
• Employee direct API/database attempts cannot self-approve reports, alter another store’s work, or read another user’s private notifications.
'''

refs = [
    ('Supabase: row-level security and role-based policies', 'https://supabase.com/docs/guides/database/postgres/row-level-security'),
    ('Next.js: securing Server Actions and data access', 'https://nextjs.org/docs/app/guides/data-security'),
    ('Next.js: useRouter and unsafe untrusted URLs', 'https://nextjs.org/docs/app/api-reference/functions/use-router'),
]

lines = [intro, '\nPRIORITIZED IMPROVEMENTS\n']
for n, (phase, title, change, outcome, ids) in enumerate(improvements, 1):
    lines.extend([f'\n{n}. [{phase}] {title}\n', change+'\n', 'Expected experience: '+outcome+'\n', 'Technical references: '+', '.join(ids)+'\n'])
lines.append('\nEXPECTED SHIFT-CHANGE RULES\n')
lines.extend(f'• {state}: {rule}\n' for state, rule in rules)
lines.extend(['\n'+verification, '\n'+next_steps, '\nTECHNICAL APPENDIX — DETAILED FINDINGS\n'])
for f in findings:
    lines.extend([f'\n{f["id"]} [{f["priority"]}] {f["title"]}\n', 'Area: '+f['area']+'\n', 'Verification: '+f['certainty']+'\n', 'Observed behavior: '+f['behavior']+'\n', 'Reproduction: '+f['reproduction']+'\n', 'Business impact: '+f['impact']+'\n', 'Improvement: '+f['fix']+'\n', 'Evidence:\n'])
    lines.extend('  '+x+'\n' for x in f['evidence'])
lines.extend(['\nREFERENCE DOCUMENTATION\n', *[f'{title}: {url}\n' for title,url in refs]])
(OUT/'improvement-review.txt').write_text(''.join(lines))

esc = html.escape
def paragraphs(text):
    return ''.join('<p>'+esc(p).replace('\n','<br>')+'</p>' for p in text.strip().split('\n\n'))

parts = ['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>THE MAKEUP STORE HRM — Improvement review</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f4f1;color:#252923;font:16px/1.65 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:48px 28px}h1{font-size:34px;line-height:1.2;max-width:760px}h2{margin-top:48px;font-size:24px}h3{font-size:20px;line-height:1.35}a{color:#704858}p{max-width:95ch}.muted{color:#5c6259}.lead{font-size:19px;border-left:4px solid #704858;padding-left:20px}article{background:#fff;border:1px solid #dedfd9;border-radius:12px;padding:24px;margin:18px 0;break-inside:avoid}.badge{display:inline-block;font-size:13px;padding:2px 9px;background:#eee8e9;border-radius:20px;margin-right:8px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:13px 15px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{font-size:14px}code{font-size:13px;overflow-wrap:anywhere}.evidence{font-size:14px}.label{font-weight:650}details{margin:14px 0}summary{cursor:pointer;font-weight:650}nav a{display:inline-block;margin:5px 20px 5px 0}@media print{body{background:white}main{max-width:none;padding:0}article{border-radius:0}nav{display:none}details{display:block}a{color:inherit;text-decoration:none}}@media(max-width:600px){main{padding:24px 16px}h1{font-size:28px}article{padding:18px}td,th{padding:10px;font-size:14px}}
</style></head><body><main><p class="muted">24 November 2026 · Local source review · No product changes</p><h1>Practical improvements for THE MAKEUP STORE HRM</h1><p class="lead">Once an employee clocks in, ordinary changes to that worked shift should be blocked—even after clock-out. Future unworked shifts should remain eligible.</p><nav><a href="#improvements">12 priorities</a><a href="#rules">Shift rules</a><a href="#verification">Verification and limits</a><a href="#delivery">Delivery order</a><a href="#appendix">35 detailed findings</a></nav>''', paragraphs(intro.split('\n\n',2)[2]), '<h2 id="improvements">Prioritized improvements</h2>']
for n,(phase,title,change,outcome,ids) in enumerate(improvements,1):
    links=' · '.join(f'<a href="#{i}">{i}</a>' for i in ids)
    parts.append(f'<article><span class="badge">{esc(phase)}</span><h3>{n}. {esc(title)}</h3><p>{esc(change)}</p><p><span class="label">Expected experience:</span> {esc(outcome)}</p><p class="evidence">{links}</p></article>')
parts.append('<h2 id="rules">Expected shift-change rules</h2><table><thead><tr><th>Situation</th><th>Expected behavior</th></tr></thead><tbody>')
parts.extend(f'<tr><td>{esc(state)}</td><td>{esc(rule)}</td></tr>' for state,rule in rules)
parts.extend(['</tbody></table><h2 id="verification">Verification and limits</h2>',paragraphs(verification),'<h2 id="delivery">Delivery order and acceptance checks</h2>',paragraphs(next_steps),'<h2 id="appendix">Technical appendix</h2><p>P1: high-priority integrity/privacy risk. P2: material workflow/reliability improvement. Conditional exposure is explicitly labeled; no live exploit is claimed.</p>'])
for f in findings:
    parts.append(f'<article id="{f["id"]}"><span class="badge">{esc(f["priority"])}</span><span class="muted">{esc(f["area"])}</span><h3>{f["id"]}. {esc(f["title"])}</h3><p class="muted">{esc(f["certainty"])}</p>')
    for key,label in [('behavior','Observed behavior'),('reproduction','Reproduction'),('impact','Business impact'),('fix','Improvement')]:
        parts.append(f'<p><span class="label">{label}:</span> {esc(f[key])}</p>')
    parts.append('<p class="evidence"><span class="label">Code evidence:</span><br>'+ '<br>'.join('<code>'+esc(e)+'</code>' for e in f['evidence'])+'</p></article>')
parts.append('<h2>Evidence artifacts</h2><ul>')
for file,label in [('reproduce-logic.mjs','Handler reproduction source'),('application-reproductions.tap','25 handler-check results'),('reproduce-database.py','PostgreSQL reproduction source'),('database-reproductions.json','11 database-check results'),('location-tests.tap','10 existing GPS tests'),('typecheck.txt','TypeScript result'),('eslint-source-summary.json','Source ESLint summary'),('live-inspection.sql','Read-only live follow-up queries'),('source-snapshot.json','Reviewed source hashes'),('improvement-review.txt','Plain-text report')]:
    parts.append(f'<li><a href="{file}">{label}</a></li>')
parts.append('</ul><h2>Reference documentation</h2><ul>')
parts.extend(f'<li><a href="{esc(url)}">{esc(title)}</a></li>' for title,url in refs)
parts.append('</ul></main></body></html>')
(OUT/'improvement-review.html').write_text(''.join(parts))

lint=json.loads((OUT/'eslint-source.json').read_text())
(OUT/'eslint-source-summary.json').write_text(json.dumps({'scope':'app components lib proxy.ts next.config.ts','scanned_files':len(lint),'errors':sum(x['errorCount'] for x in lint),'warnings':sum(x['warningCount'] for x in lint),'files':[{'file':str(Path(x['filePath']).relative_to(ROOT)),'errors':x['errorCount'],'warnings':x['warningCount']} for x in lint if x['errorCount'] or x['warningCount']]},indent=2)+'\n')
sources={e.rsplit(':',1)[0] for f in findings for e in f['evidence']}
missing=[p for p in sources if not (ROOT/p).is_file()]
assert not missing, missing
manifest={'date':'2026-11-24','git_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'basis':'Local worktree including preexisting uncommitted changes; no deployed revision verified','source_sha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(sources)}}
(OUT/'source-snapshot.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'improvement_groups':len(improvements),'findings':len(findings),'priorities':dict(collections.Counter(f['priority'] for f in findings)),'source_files_referenced':len(sources),'report':str(OUT/'improvement-review.html')},indent=2))

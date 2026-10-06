// GENERADO por `pnpm --filter @pluma/db introspect` + scripts/postprocess-schema.mjs. No editar a mano.
import { pgTable, foreignKey, check, uuid, text, integer, boolean, timestamp, char, unique, date, bigint, inet, bigserial, numeric, index, jsonb, uniqueIndex, primaryKey, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { citext, bytea, tsvector } from "./custom-types"

export const aiDeclaration = pgEnum("ai_declaration", ['none', 'ai_assisted', 'ai_generated'])
export const appRole = pgEnum("app_role", ['writer', 'ar_guest', 'sync_buyer', 'operator', 'approver', 'super_admin'])
export const applicationStatus = pgEnum("application_status", ['pending', 'accepted', 'declined', 'expired', 'withdrawn'])
export const disputeStatus = pgEnum("dispute_status", ['open', 'in_review', 'resolved', 'withdrawn'])
export const distributionStatus = pgEnum("distribution_status", ['payable', 'held_dispute', 'suspense'])
export const holdStatus = pgEnum("hold_status", ['requested', 'approved', 'rejected', 'active', 'expired', 'released'])
export const incomeType = pgEnum("income_type", ['performance', 'mechanical', 'youtube_ugc', 'sync', 'other'])
export const kycStatus = pgEnum("kyc_status", ['not_started', 'pending', 'approved', 'rejected', 'needs_review'])
export const ledgerEntryType = pgEnum("ledger_entry_type", ['statement_credit', 'payout_debit', 'payout_reversal', 'adjustment', 'opening_carry'])
export const licenseStatus = pgEnum("license_status", ['submitted', 'awaiting_writers', 'writers_approved', 'writers_rejected', 'negotiating', 'issued', 'canceled'])
export const licenseUsage = pgEnum("license_usage", ['social_media', 'digital_ads', 'tv_film', 'videogame', 'other'])
export const localeCode = pgEnum("locale_code", ['es', 'en', 'pt-BR'])
export const matchStatus = pgEnum("match_status", ['unmatched', 'auto_matched', 'suggested', 'manual_matched', 'suspense'])
export const membershipStatus = pgEnum("membership_status", ['pending_payment', 'active', 'past_due', 'suspended', 'canceled'])
export const modality = pgEnum("modality", ['remote', 'in_person', 'hybrid'])
export const notifChannel = pgEnum("notif_channel", ['email', 'push', 'whatsapp', 'in_app'])
export const notifStatus = pgEnum("notif_status", ['queued', 'scheduled', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'suppressed'])
export const payoutStatus = pgEnum("payout_status", ['requested', 'approved', 'sent', 'paid', 'failed', 'canceled'])
export const planCode = pgEnum("plan_code", ['socio', 'pro'])
export const requestStatus = pgEnum("request_status", ['open', 'filled', 'closed', 'expired'])
export const requestType = pgEnum("request_type", ['beat_seeks_topliner', 'seeks_producer', 'seeks_verse_or_hook', 'session_or_camp'])
export const runStatus = pgEnum("run_status", ['draft', 'calculating', 'calculated', 'reconciled', 'unbalanced', 'approved', 'scheduled', 'published', 'invalidated'])
export const shareStatus = pgEnum("share_status", ['pending', 'signed', 'rejected'])
export const splitVersionStatus = pgEnum("split_version_status", ['draft', 'pending_signatures', 'signed', 'rejected', 'superseded'])
export const statementFileStatus = pgEnum("statement_file_status", ['uploaded', 'parsing', 'parsed', 'normalized', 'failed', 'superseded'])
export const workStatus = pgEnum("work_status", ['draft', 'awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered', 'disputed'])
export const writerRole = pgEnum("writer_role", ['composer', 'lyricist', 'composer_lyricist', 'arranger', 'translator'])


export const splitShares = pgTable("split_shares", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	splitVersionId: uuid("split_version_id").notNull(),
	writerUserId: uuid("writer_user_id"),
	externalName: text("external_name"),
	externalEmail: citext("external_email"),
	externalIpi: text("external_ipi"),
	externalSociety: text("external_society"),
	role: writerRole().notNull(),
	shareBps: integer("share_bps").notNull(),
	administered: boolean().notNull(),
	status: shareStatus().default('pending').notNull(),
	invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'string' }),
	signatureId: uuid("signature_id"),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }),
	signTokenHash: char("sign_token_hash", { length: 64 }),
	signTokenExpiresAt: timestamp("sign_token_expires_at", { withTimezone: true, mode: 'string' }),
	lastReminderAt: timestamp("last_reminder_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.splitVersionId],
			foreignColumns: [splitVersions.id],
			name: "split_shares_split_version_id_fkey"
		}),
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "split_shares_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.signatureId],
			foreignColumns: [signatures.id],
			name: "split_shares_signature_id_fkey"
		}),
	check("split_shares_share_bps_check", sql`(share_bps > 0) AND (share_bps <= 10000)`),
	check("split_shares_check", sql`(writer_user_id IS NOT NULL) <> (external_email IS NOT NULL)`),
]);

export const statementPeriods = pgTable("statement_periods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	publisherId: uuid("publisher_id").notNull(),
	provider: text().notNull(),
	code: text().notNull(),
	payDate: date("pay_date").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishers.id],
			name: "statement_periods_publisher_id_fkey"
		}),
	unique("statement_periods_provider_code_key").on(table.provider, table.code),
]);

export const advances = pgTable("advances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recoupedCents: bigint("recouped_cents", { mode: "number" }).default(0).notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "advances_writer_user_id_fkey"
		}),
]);

export const signatures = pgTable("signatures", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentSha256: char("document_sha256", { length: 64 }).notNull(),
	documentKind: text("document_kind").notNull(),
	documentRef: uuid("document_ref").notNull(),
	signerUserId: uuid("signer_user_id"),
	signerName: text("signer_name").notNull(),
	signerEmail: citext("signer_email").notNull(),
	onBehalfOfUserId: uuid("on_behalf_of_user_id"),
	method: text().notNull(),
	otpVerifiedAt: timestamp("otp_verified_at", { withTimezone: true, mode: 'string' }).notNull(),
	ip: inet().notNull(),
	userAgent: text("user_agent").notNull(),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tsaToken: bytea("tsa_token"),
}, (table) => [
	foreignKey({
			columns: [table.signerUserId],
			foreignColumns: [users.id],
			name: "signatures_signer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.onBehalfOfUserId],
			foreignColumns: [users.id],
			name: "signatures_on_behalf_of_user_id_fkey"
		}),
]);

export const agreements = pgTable("agreements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legalDocumentId: uuid("legal_document_id").notNull(),
	signatureId: uuid("signature_id").notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: 'string' }),
	terminationReason: text("termination_reason"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agreements_user_id_fkey"
		}),
	foreignKey({
			columns: [table.legalDocumentId],
			foreignColumns: [legalDocuments.id],
			name: "agreements_legal_document_id_fkey"
		}),
	foreignKey({
			columns: [table.signatureId],
			foreignColumns: [signatures.id],
			name: "agreements_signature_id_fkey"
		}),
]);

export const legalDocuments = pgTable("legal_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: text().notNull(),
	version: text().notNull(),
	locale: localeCode().notNull(),
	storagePath: text("storage_path").notNull(),
	sha256: char({ length: 64 }).notNull(),
	effectiveFrom: date("effective_from").notNull(),
}, (table) => [
	unique("legal_documents_kind_version_locale_key").on(table.kind, table.version, table.locale),
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	email: citext("email").notNull(),
	locale: localeCode().default('es').notNull(),
	kycStatus: kycStatus("kyc_status").default('not_started').notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: 'string' }),
	mfaRequired: boolean("mfa_required").default(false).notNull(),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	phoneE164: text("phone_e164"),
	whatsappOptInAt: timestamp("whatsapp_opt_in_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("users_email_key").on(table.email),
	check("users_phone_e164_check", sql`phone_e164 ~ '^\+[1-9]\d{7,14}$'::text`),
]);

export const membershipPayments = pgTable("membership_payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	amountCents: integer("amount_cents").notNull(),
	currency: char({ length: 3 }).notNull(),
	stripeInvoiceId: text("stripe_invoice_id").notNull(),
	status: text().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "membership_payments_user_id_fkey"
		}),
	unique("membership_payments_stripe_invoice_id_key").on(table.stripeInvoiceId),
]);

export const splitVersions = pgTable("split_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	version: integer().notNull(),
	status: splitVersionStatus().default('draft').notNull(),
	effectiveFrom: date("effective_from"),
	splitSheetSha256: char("split_sheet_sha256", { length: 64 }),
	evidencePath: text("evidence_path"),
	changeReason: text("change_reason"),
	createdBy: uuid("created_by").notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "split_versions_work_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "split_versions_created_by_fkey"
		}),
	unique("split_versions_work_id_version_key").on(table.workId, table.version),
]);

export const workStatusHistory = pgTable("work_status_history", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	fromStatus: workStatus("from_status"),
	toStatus: workStatus("to_status").notNull(),
	actorId: uuid("actor_id"),
	note: text(),
	at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "work_status_history_work_id_fkey"
		}),
]);

export const workConflicts = pgTable("work_conflicts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	conflictingWorkId: uuid("conflicting_work_id").notNull(),
	reason: text().notNull(),
	score: numeric({ precision: 4, scale:  3 }).notNull(),
	status: text().default('open').notNull(),
	reviewedBy: uuid("reviewed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "work_conflicts_work_id_fkey"
		}),
	foreignKey({
			columns: [table.conflictingWorkId],
			foreignColumns: [works.id],
			name: "work_conflicts_conflicting_work_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "work_conflicts_reviewed_by_fkey"
		}),
]);

export const disputes = pgTable("disputes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	splitVersionId: uuid("split_version_id"),
	raisedByUserId: uuid("raised_by_user_id"),
	raisedByEmail: citext("raised_by_email"),
	reason: text().notNull(),
	status: disputeStatus().default('open').notNull(),
	resolution: text(),
	resolvedBy: uuid("resolved_by"),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "disputes_work_id_fkey"
		}),
	foreignKey({
			columns: [table.splitVersionId],
			foreignColumns: [splitVersions.id],
			name: "disputes_split_version_id_fkey"
		}),
	foreignKey({
			columns: [table.raisedByUserId],
			foreignColumns: [users.id],
			name: "disputes_raised_by_user_id_fkey"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "disputes_resolved_by_fkey"
		}),
]);

export const publisherSubmissions = pgTable("publisher_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	filePath: text("file_path").notNull(),
	sha256: char({ length: 64 }).notNull(),
	workIds: uuid("work_ids").array().notNull(),
	createdBy: uuid("created_by").notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "publisher_submissions_created_by_fkey"
		}),
]);

export const writerTerminations = pgTable("writer_terminations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	effectiveAt: date("effective_at"),
	catalogTransferTo: text("catalog_transfer_to"),
	finalSettlementRunId: uuid("final_settlement_run_id"),
	status: text().default('requested').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "writer_terminations_user_id_fkey"
		}),
]);

export const beneficiaryChanges = pgTable("beneficiary_changes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	beneficiaryName: text("beneficiary_name").notNull(),
	beneficiaryEmail: citext("beneficiary_email").notNull(),
	shareBps: integer("share_bps").default(10000).notNull(),
	documents: text().array().notNull(),
	status: text().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	effectiveFrom: date("effective_from"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "beneficiary_changes_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "beneficiary_changes_approved_by_fkey"
		}),
]);

export const taxWithholdingRules = pgTable("tax_withholding_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	residenceCountry: char("residence_country", { length: 2 }).notNull(),
	incomeType: incomeType("income_type"),
	rateBps: integer("rate_bps").notNull(),
	legalReference: text("legal_reference").notNull(),
	validFrom: date("valid_from").notNull(),
	validTo: date("valid_to"),
});

export const statementLines = pgTable("statement_lines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fileId: uuid("file_id").notNull(),
	lineNo: integer("line_no").notNull(),
	raw: jsonb().notNull(),
	providerWorkCode: text("provider_work_code"),
	workTitle: text("work_title"),
	iswc: text(),
	writerIpi: text("writer_ipi"),
	isrc: text(),
	source: text().notNull(),
	incomeType: incomeType("income_type").notNull(),
	territory: char({ length: 2 }),
	exploitationStart: date("exploitation_start"),
	exploitationEnd: date("exploitation_end"),
	payPeriod: text("pay_period").notNull(),
	currency: char({ length: 3 }).notNull(),
	gross: numeric({ precision: 20, scale:  6 }).notNull(),
	providerFee: numeric("provider_fee", { precision: 20, scale:  6 }).default('0').notNull(),
	net: numeric({ precision: 20, scale:  6 }).notNull(),
	isAdjustment: boolean("is_adjustment").default(false).notNull(),
	adjustsPeriod: text("adjusts_period"),
	matchStatus: matchStatus("match_status").default('unmatched').notNull(),
	matchedWorkId: uuid("matched_work_id"),
	matchMethod: text("match_method"),
	matchConfidence: numeric("match_confidence", { precision: 4, scale:  3 }),
	matchedBy: uuid("matched_by"),
}, (table) => [
	index("statement_lines_match").using("btree", table.fileId.asc().nullsLast().op("uuid_ops"), table.matchStatus.asc().nullsLast().op("enum_ops")),
	index("statement_lines_work").using("btree", table.matchedWorkId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [statementFiles.id],
			name: "statement_lines_file_id_fkey"
		}),
	foreignKey({
			columns: [table.matchedWorkId],
			foreignColumns: [works.id],
			name: "statement_lines_matched_work_id_fkey"
		}),
	foreignKey({
			columns: [table.matchedBy],
			foreignColumns: [users.id],
			name: "statement_lines_matched_by_fkey"
		}),
	unique("statement_lines_file_id_line_no_key").on(table.fileId, table.lineNo),
]);

export const writerLedgerEntries = pgTable("writer_ledger_entries", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	type: ledgerEntryType().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	writerStatementId: uuid("writer_statement_id"),
	payoutId: uuid("payout_id"),
	memo: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "writer_ledger_entries_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.writerStatementId],
			foreignColumns: [writerStatements.id],
			name: "writer_ledger_entries_writer_statement_id_fkey"
		}),
]);

export const taxCertificates = pgTable("tax_certificates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	fiscalYear: integer("fiscal_year").notNull(),
	country: char({ length: 2 }).notNull(),
	pdfPath: text("pdf_path").notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "tax_certificates_writer_user_id_fkey"
		}),
	unique("tax_certificates_writer_user_id_fiscal_year_country_key").on(table.writerUserId, table.fiscalYear, table.country),
]);

export const payouts = pgTable("payouts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	payoutMethodId: uuid("payout_method_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
	currency: char({ length: 3 }).notNull(),
	status: payoutStatus().default('requested').notNull(),
	batchId: uuid("batch_id"),
	preparedBy: uuid("prepared_by"),
	approvedBy: uuid("approved_by"),
	providerRef: text("provider_ref"),
	failureReason: text("failure_reason"),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "payouts_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.payoutMethodId],
			foreignColumns: [payoutMethods.id],
			name: "payouts_payout_method_id_fkey"
		}),
	foreignKey({
			columns: [table.preparedBy],
			foreignColumns: [users.id],
			name: "payouts_prepared_by_fkey"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "payouts_approved_by_fkey"
		}),
	check("payouts_amount_cents_check", sql`amount_cents > 0`),
	check("payouts_check", sql`(approved_by IS NULL) OR (approved_by <> prepared_by)`),
]);

export const arInvitations = pgTable("ar_invitations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: citext("email").notNull(),
	company: text().notNull(),
	invitedBy: uuid("invited_by").notNull(),
	tokenHash: char("token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	acceptedUserId: uuid("accepted_user_id"),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "ar_invitations_invited_by_fkey"
		}),
	foreignKey({
			columns: [table.acceptedUserId],
			foreignColumns: [users.id],
			name: "ar_invitations_accepted_user_id_fkey"
		}),
	unique("ar_invitations_token_hash_key").on(table.tokenHash),
]);

export const licenseRequests = pgTable("license_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buyerUserId: uuid("buyer_user_id").notNull(),
	workId: uuid("work_id").notNull(),
	briefId: uuid("brief_id"),
	usage: licenseUsage().notNull(),
	territory: text().notNull(),
	termMonths: integer("term_months").notNull(),
	projectDescription: text("project_description").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	quoteMinCents: bigint("quote_min_cents", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	quoteMaxCents: bigint("quote_max_cents", { mode: "number" }),
	rateCardId: uuid("rate_card_id"),
	oneStopRequested: boolean("one_stop_requested").default(false).notNull(),
	status: licenseStatus().default('submitted').notNull(),
	operatorId: uuid("operator_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	finalFeeCents: bigint("final_fee_cents", { mode: "number" }),
	plumaCommissionBps: integer("pluma_commission_bps"),
	licenseDocPath: text("license_doc_path"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.buyerUserId],
			foreignColumns: [users.id],
			name: "license_requests_buyer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "license_requests_work_id_fkey"
		}),
	foreignKey({
			columns: [table.briefId],
			foreignColumns: [syncBriefs.id],
			name: "license_requests_brief_id_fkey"
		}),
	foreignKey({
			columns: [table.rateCardId],
			foreignColumns: [syncRateCard.id],
			name: "license_requests_rate_card_id_fkey"
		}),
	foreignKey({
			columns: [table.operatorId],
			foreignColumns: [users.id],
			name: "license_requests_operator_id_fkey"
		}),
]);

export const syncRateCard = pgTable("sync_rate_card", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	usage: licenseUsage().notNull(),
	territory: text().notNull(),
	termMonths: integer("term_months").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	minCents: bigint("min_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	maxCents: bigint("max_cents", { mode: "number" }).notNull(),
	currency: char({ length: 3 }).default('USD').notNull(),
	validFrom: date("valid_from").notNull(),
	validTo: date("valid_to"),
});

export const notificationDeliveries = pgTable("notification_deliveries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	notificationId: uuid("notification_id").notNull(),
	channel: notifChannel().notNull(),
	status: notifStatus().default('queued').notNull(),
	providerMessageId: text("provider_message_id"),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }),
	bouncedAt: timestamp("bounced_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	attempts: integer().default(0).notNull(),
}, (table) => [
	index("notification_deliveries_provider").using("btree", table.providerMessageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notifications.id],
			name: "notification_deliveries_notification_id_fkey"
		}),
	unique("notification_deliveries_notification_id_channel_key").on(table.notificationId, table.channel),
]);

export const distributions = pgTable("distributions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: uuid("run_id").notNull(),
	lineId: uuid("line_id").notNull(),
	splitShareId: uuid("split_share_id"),
	writerUserId: uuid("writer_user_id"),
	shareBps: integer("share_bps").notNull(),
	status: distributionStatus().notNull(),
	gross: numeric({ precision: 20, scale:  6 }).notNull(),
	fxRateId: uuid("fx_rate_id"),
	grossPayoutCcy: numeric("gross_payout_ccy", { precision: 20, scale:  6 }).notNull(),
	commissionBps: integer("commission_bps").notNull(),
	commission: numeric({ precision: 20, scale:  6 }).notNull(),
	withholdingBps: integer("withholding_bps").default(0).notNull(),
	withholding: numeric({ precision: 20, scale:  6 }).default('0').notNull(),
	recoupment: numeric({ precision: 20, scale:  6 }).default('0').notNull(),
	net: numeric({ precision: 20, scale:  6 }).notNull(),
	holdReason: text("hold_reason"),
}, (table) => [
	index("distributions_line").using("btree", table.lineId.asc().nullsLast().op("uuid_ops")),
	index("distributions_run_writer").using("btree", table.runId.asc().nullsLast().op("uuid_ops"), table.writerUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [distributionRuns.id],
			name: "distributions_run_id_fkey"
		}),
	foreignKey({
			columns: [table.lineId],
			foreignColumns: [statementLines.id],
			name: "distributions_line_id_fkey"
		}),
	foreignKey({
			columns: [table.splitShareId],
			foreignColumns: [splitShares.id],
			name: "distributions_split_share_id_fkey"
		}),
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "distributions_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.fxRateId],
			foreignColumns: [fxRates.id],
			name: "distributions_fx_rate_id_fkey"
		}),
]);

export const fxRates = pgTable("fx_rates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	base: char({ length: 3 }).notNull(),
	quote: char({ length: 3 }).notNull(),
	rate: numeric({ precision: 20, scale:  10 }).notNull(),
	source: text().notNull(),
	asOf: timestamp("as_of", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("fx_rates_base_quote_source_as_of_key").on(table.base, table.quote, table.source, table.asOf),
]);

export const reconciliations = pgTable("reconciliations", {
	runId: uuid("run_id").primaryKey().notNull(),
	currency: char({ length: 3 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receivedCents: bigint("received_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	controlTotalCents: bigint("control_total_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	parsedTotalCents: bigint("parsed_total_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	writersNetCents: bigint("writers_net_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	commissionCents: bigint("commission_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	withholdingCents: bigint("withholding_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recoupmentCents: bigint("recoupment_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	heldCents: bigint("held_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	suspenseCents: bigint("suspense_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roundingCents: bigint("rounding_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	differenceCents: bigint("difference_cents", { mode: "number" }).generatedAlwaysAs(sql`(received_cents - ((((((writers_net_cents + commission_cents) + withholding_cents) + recoupment_cents) + held_cents) + suspense_cents) + rounding_cents))`),
	balanced: boolean().generatedAlwaysAs(sql`((received_cents = ((((((writers_net_cents + commission_cents) + withholding_cents) + recoupment_cents) + held_cents) + suspense_cents) + rounding_cents)) AND (parsed_total_cents = control_total_cents))`),
	computedAt: timestamp("computed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.runId],
			foreignColumns: [distributionRuns.id],
			name: "reconciliations_run_id_fkey"
		}),
]);

export const writerStatements = pgTable("writer_statements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: uuid("run_id").notNull(),
	periodId: uuid("period_id").notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	currency: char({ length: 3 }).notNull(),
	planCodeApplied: planCode("plan_code_applied").notNull(),
	commissionBpsApplied: integer("commission_bps_applied").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	openingBalanceCents: bigint("opening_balance_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	grossCents: bigint("gross_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	commissionCents: bigint("commission_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	withholdingCents: bigint("withholding_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recoupmentCents: bigint("recoupment_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	adjustmentsCents: bigint("adjustments_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	heldCents: bigint("held_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	netCents: bigint("net_cents", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	closingBalanceCents: bigint("closing_balance_cents", { mode: "number" }).notNull(),
	topWorkId: uuid("top_work_id"),
	pdfPath: text("pdf_path"),
	pdfSha256: char("pdf_sha256", { length: 64 }),
	csvPath: text("csv_path"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.runId],
			foreignColumns: [distributionRuns.id],
			name: "writer_statements_run_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [statementPeriods.id],
			name: "writer_statements_period_id_fkey"
		}),
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "writer_statements_writer_user_id_fkey"
		}),
	foreignKey({
			columns: [table.topWorkId],
			foreignColumns: [works.id],
			name: "writer_statements_top_work_id_fkey"
		}),
	unique("writer_statements_period_id_writer_user_id_key").on(table.periodId, table.writerUserId),
]);

export const audioPlays = pgTable("audio_plays", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	fileId: uuid("file_id").notNull(),
	listenerUserId: uuid("listener_user_id"),
	context: text().notNull(),
	ipHash: char("ip_hash", { length: 64 }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	listenedMs: integer("listened_ms"),
}, (table) => [
	index("audio_plays_file").using("btree", table.fileId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [workFiles.id],
			name: "audio_plays_file_id_fkey"
		}),
	foreignKey({
			columns: [table.listenerUserId],
			foreignColumns: [users.id],
			name: "audio_plays_listener_user_id_fkey"
		}),
]);

export const arInterests = pgTable("ar_interests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	arUserId: uuid("ar_user_id").notNull(),
	message: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "ar_interests_work_id_fkey"
		}),
	foreignKey({
			columns: [table.arUserId],
			foreignColumns: [users.id],
			name: "ar_interests_ar_user_id_fkey"
		}),
]);

export const holds = pgTable("holds", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	requesterUserId: uuid("requester_user_id").notNull(),
	durationDays: integer("duration_days").notNull(),
	status: holdStatus().default('requested').notNull(),
	decidedBy: uuid("decided_by"),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	feeCents: bigint("fee_cents", { mode: "number" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("one_active_hold_per_work").using("btree", table.workId.asc().nullsLast().op("uuid_ops")).where(sql`(status = ANY (ARRAY['approved'::hold_status, 'active'::hold_status]))`),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "holds_work_id_fkey"
		}),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [users.id],
			name: "holds_requester_user_id_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [users.id],
			name: "holds_decided_by_fkey"
		}),
	check("holds_duration_days_check", sql`duration_days = ANY (ARRAY[30, 60, 90])`),
]);

export const syncBuyers = pgTable("sync_buyers", {
	userId: uuid("user_id").primaryKey().notNull(),
	company: text().notNull(),
	companyType: text("company_type").notNull(),
	country: char({ length: 2 }).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sync_buyers_user_id_fkey"
		}),
]);

export const guardians = pgTable("guardians", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	legalName: text("legal_name").notNull(),
	email: citext("email").notNull(),
	relationship: text().notNull(),
	idDocumentPath: text("id_document_path").notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [writerProfiles.userId],
			name: "guardians_writer_user_id_fkey"
		}),
]);

export const syncBriefs = pgTable("sync_briefs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	buyerUserId: uuid("buyer_user_id"),
	title: text().notNull(),
	description: text().notNull(),
	moods: text().array().default(sql`'{}'`).notNull(),
	genres: text().array().default(sql`'{}'`).notNull(),
	languages: text().array().default(sql`'{}'`).notNull(),
	usage: licenseUsage().notNull(),
	territory: text().notNull(),
	termMonths: integer("term_months"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	budgetMinCents: bigint("budget_min_cents", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	budgetMaxCents: bigint("budget_max_cents", { mode: "number" }),
	deadline: timestamp({ withTimezone: true, mode: 'string' }),
	status: text().default('open').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.buyerUserId],
			foreignColumns: [users.id],
			name: "sync_briefs_buyer_user_id_fkey"
		}),
]);

export const briefSubmissions = pgTable("brief_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	briefId: uuid("brief_id").notNull(),
	workId: uuid("work_id").notNull(),
	submittedBy: uuid("submitted_by").notNull(),
	note: text(),
	status: text().default('submitted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.briefId],
			foreignColumns: [syncBriefs.id],
			name: "brief_submissions_brief_id_fkey"
		}),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "brief_submissions_work_id_fkey"
		}),
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [users.id],
			name: "brief_submissions_submitted_by_fkey"
		}),
	unique("brief_submissions_brief_id_work_id_key").on(table.briefId, table.workId),
]);

export const auditLog = pgTable("audit_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	actorRole: text("actor_role"),
	action: text().notNull(),
	command: text(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	before: jsonb(),
	after: jsonb(),
	ip: inet(),
	userAgent: text("user_agent"),
	at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	prevHash: char("prev_hash", { length: 64 }),
	hash: char({ length: 64 }).notNull(),
});

export const domainEvents = pgTable("domain_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	type: text().notNull(),
	aggregateType: text("aggregate_type").notNull(),
	aggregateId: uuid("aggregate_id").notNull(),
	payload: jsonb().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	dispatchedAt: timestamp("dispatched_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("domain_events_pending").using("btree", table.occurredAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(dispatched_at IS NULL)`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	eventId: uuid("event_id").notNull(),
	recipientUserId: uuid("recipient_user_id"),
	recipientEmail: citext("recipient_email"),
	locale: localeCode().notNull(),
	template: text().notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	data: jsonb().notNull(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }),
	isTest: boolean("is_test").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	category: text().default('general').notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("notifications_inbox").using("btree", table.recipientUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [domainEvents.id],
			name: "notifications_event_id_fkey"
		}),
	foreignKey({
			columns: [table.recipientUserId],
			foreignColumns: [users.id],
			name: "notifications_recipient_user_id_fkey"
		}),
	unique("notifications_idempotency_key_key").on(table.idempotencyKey),
]);

export const networkRequests = pgTable("network_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authorUserId: uuid("author_user_id").notNull(),
	type: requestType().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	genre: text().notNull(),
	languages: text().array().notNull(),
	bpm: integer(),
	city: text(),
	modality: modality().notNull(),
	offeredShareBps: integer("offered_share_bps").notNull(),
	demoFileId: uuid("demo_file_id"),
	status: requestStatus().default('open').notNull(),
	featured: boolean().default(false).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	hiddenAt: timestamp("hidden_at", { withTimezone: true, mode: 'string' }),
	hiddenReason: text("hidden_reason"),
	hiddenBy: uuid("hidden_by"),
	renewedAt: timestamp("renewed_at", { withTimezone: true, mode: 'string' }),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("network_requests_author").using("btree", table.authorUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("network_requests_board").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.expiresAt.desc().nullsFirst().op("enum_ops")).where(sql`(hidden_at IS NULL)`),
	foreignKey({
			columns: [table.hiddenBy],
			foreignColumns: [users.id],
			name: "network_requests_hidden_by_fkey"
		}),
	foreignKey({
			columns: [table.authorUserId],
			foreignColumns: [users.id],
			name: "network_requests_author_user_id_fkey"
		}),
	foreignKey({
			columns: [table.demoFileId],
			foreignColumns: [workFiles.id],
			name: "network_requests_demo_file_id_fkey"
		}),
	check("network_requests_offered_share_bps_check", sql`(offered_share_bps >= 1) AND (offered_share_bps <= 9999)`),
	check("network_requests_title_len", sql`(char_length(title) >= 3) AND (char_length(title) <= 120)`),
	check("network_requests_desc_len", sql`(char_length(description) >= 10) AND (char_length(description) <= 2000)`),
]);

export const applications = pgTable("applications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	requestId: uuid("request_id").notNull(),
	applicantUserId: uuid("applicant_user_id").notNull(),
	message: text().notNull(),
	acceptedShareBps: integer("accepted_share_bps").notNull(),
	sampleFileId: uuid("sample_file_id"),
	status: applicationStatus().default('pending').notNull(),
	reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("applications_quota").using("btree", table.applicantUserId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("applications_request").using("btree", table.requestId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [networkRequests.id],
			name: "applications_request_id_fkey"
		}),
	foreignKey({
			columns: [table.applicantUserId],
			foreignColumns: [users.id],
			name: "applications_applicant_user_id_fkey"
		}),
	foreignKey({
			columns: [table.sampleFileId],
			foreignColumns: [workFiles.id],
			name: "applications_sample_file_id_fkey"
		}),
	unique("applications_request_id_applicant_user_id_key").on(table.requestId, table.applicantUserId),
	check("applications_message_len", sql`(char_length(message) >= 10) AND (char_length(message) <= 1000)`),
]);

export const collaborations = pgTable("collaborations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	requestId: uuid("request_id").notNull(),
	applicationId: uuid("application_id").notNull(),
	preAgreedShares: jsonb("pre_agreed_shares").notNull(),
	sessionUrl: text("session_url"),
	workId: uuid("work_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
	closedBy: uuid("closed_by"),
}, (table) => [
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [networkRequests.id],
			name: "collaborations_request_id_fkey"
		}),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "collaborations_application_id_fkey"
		}),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "collaborations_work_id_fkey"
		}),
	foreignKey({
			columns: [table.closedBy],
			foreignColumns: [users.id],
			name: "collaborations_closed_by_fkey"
		}),
	unique("collaborations_application_id_key").on(table.applicationId),
]);

export const credits = pgTable("credits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	workId: uuid("work_id"),
	title: text().notNull(),
	artist: text(),
	role: text().notNull(),
	dspUrl: text("dsp_url"),
	verified: boolean().default(false).notNull(),
	verifiedSource: text("verified_source"),
	strength: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	rejectedReason: text("rejected_reason"),
}, (table) => [
	index("credits_pending").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((NOT verified) AND (reviewed_at IS NULL))`),
	index("credits_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "credits_user_id_fkey"
		}),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "credits_work_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "credits_reviewed_by_fkey"
		}),
]);

export const writerProfiles = pgTable("writer_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	publisherId: uuid("publisher_id").notNull(),
	legalName: text("legal_name").notNull(),
	artistName: text("artist_name"),
	country: char({ length: 2 }).notNull(),
	city: text(),
	languages: localeCode().array().default(sql`'{}'`).notNull(),
	spokenLanguages: text("spoken_languages").array().default(sql`'{}'`).notNull(),
	birthDate: date("birth_date").notNull(),
	societyCode: text("society_code"),
	societyOther: text("society_other"),
	ipi: text(),
	publicSlug: citext("public_slug"),
	bio: text(),
	dspLinks: jsonb("dsp_links").default({}).notNull(),
	networkVisible: boolean("network_visible").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	mainRole: writerRole("main_role"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "writer_profiles_user_id_fkey"
		}),
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishers.id],
			name: "writer_profiles_publisher_id_fkey"
		}),
	foreignKey({
			columns: [table.societyCode],
			foreignColumns: [proSocieties.code],
			name: "writer_profiles_society_code_fkey"
		}),
	unique("writer_profiles_public_slug_key").on(table.publicSlug),
	check("writer_profiles_ipi_check", sql`ipi ~ '^\d{9,11}$'::text`),
]);

export const signatureChallenges = pgTable("signature_challenges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: citext("email").notNull(),
	purpose: text().notNull(),
	refId: uuid("ref_id").notNull(),
	codeHash: char("code_hash", { length: 64 }).notNull(),
	attempts: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("signature_challenges_ref").using("btree", table.refId.asc().nullsLast().op("text_ops"), table.purpose.asc().nullsLast().op("text_ops")),
]);

export const plans = pgTable("plans", {
	code: planCode().primaryKey().notNull(),
	publisherId: uuid("publisher_id").notNull(),
	commissionBps: integer("commission_bps").notNull(),
	features: jsonb().notNull(),
	active: boolean().default(true).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishers.id],
			name: "plans_publisher_id_fkey"
		}),
	check("plans_commission_bps_check", sql`(commission_bps >= 0) AND (commission_bps <= 10000)`),
]);

export const planPrices = pgTable("plan_prices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	planCode: planCode("plan_code").notNull(),
	region: text().default('GLOBAL').notNull(),
	amountCents: integer("amount_cents").notNull(),
	currency: char({ length: 3 }).default('USD').notNull(),
	stripePriceId: text("stripe_price_id").notNull(),
	validFrom: date("valid_from").notNull(),
	validTo: date("valid_to"),
}, (table) => [
	foreignKey({
			columns: [table.planCode],
			foreignColumns: [plans.code],
			name: "plan_prices_plan_code_fkey"
		}),
	unique("plan_prices_plan_code_region_valid_from_key").on(table.planCode, table.region, table.validFrom),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	endpoint: text().notNull(),
	keys: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "push_subscriptions_user_id_fkey"
		}),
	unique("push_subscriptions_endpoint_key").on(table.endpoint),
]);

export const dataSubjectRequests = pgTable("data_subject_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	status: text().default('open').notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "data_subject_requests_user_id_fkey"
		}),
]);

export const settings = pgTable("settings", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	updatedBy: uuid("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const publishers = pgTable("publishers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const taxProfiles = pgTable("tax_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	taxCountry: char("tax_country", { length: 2 }).notNull(),
	taxIdEnc: bytea("tax_id_enc").notNull(),
	taxIdLast4: text("tax_id_last4"),
	entityType: text("entity_type").default('individual').notNull(),
	forms: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "tax_profiles_user_id_fkey"
		}),
]);

export const payoutMethods = pgTable("payout_methods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	currency: char({ length: 3 }).notNull(),
	detailsEnc: bytea("details_enc").notNull(),
	label: text().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payout_methods_user_id_fkey"
		}),
]);

export const kycChecks = pgTable("kyc_checks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	providerRef: text("provider_ref").notNull(),
	status: kycStatus().notNull(),
	riskFlags: jsonb("risk_flags").default([]).notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "kyc_checks_user_id_fkey"
		}),
]);

export const memberships = pgTable("memberships", {
	userId: uuid("user_id").primaryKey().notNull(),
	planCode: planCode("plan_code").notNull(),
	status: membershipStatus().notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	graceEndsAt: timestamp("grace_ends_at", { withTimezone: true, mode: 'string' }),
	scheduledPlanCode: planCode("scheduled_plan_code"),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "memberships_user_id_fkey"
		}),
	foreignKey({
			columns: [table.planCode],
			foreignColumns: [plans.code],
			name: "memberships_plan_code_fkey"
		}),
	unique("memberships_stripe_customer_id_key").on(table.stripeCustomerId),
	unique("memberships_stripe_subscription_id_key").on(table.stripeSubscriptionId),
]);

export const membershipPlanPeriods = pgTable("membership_plan_periods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	planCode: planCode("plan_code").notNull(),
	commissionBps: integer("commission_bps").notNull(),
	validFrom: timestamp("valid_from", { withTimezone: true, mode: 'string' }).notNull(),
	validTo: timestamp("valid_to", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "membership_plan_periods_user_id_fkey"
		}),
]);

export const proSocieties = pgTable("pro_societies", {
	code: text().primaryKey().notNull(),
	name: text().notNull(),
	country: char({ length: 2 }).notNull(),
});

export const works = pgTable("works", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	publisherId: uuid("publisher_id").notNull(),
	title: text().notNull(),
	titleNormalized: text("title_normalized").default('').notNull(),
	altTitles: text("alt_titles").array().default(sql`'{}'`).notNull(),
	language: text().notNull(),
	genre: text().notNull(),
	lyrics: text(),
	iswc: text(),
	publisherWorkCode: text("publisher_work_code"),
	status: workStatus().default('draft').notNull(),
	aiDeclaration: aiDeclaration("ai_declaration").notNull(),
	aiTrainingOptIn: boolean("ai_training_opt_in").default(false).notNull(),
	audioSha256: char("audio_sha256", { length: 64 }),
	lyricsSha256: char("lyrics_sha256", { length: 64 }),
	authorshipSealedAt: timestamp("authorship_sealed_at", { withTimezone: true, mode: 'string' }),
	authorshipTsaToken: bytea("authorship_tsa_token"),
	syncOptIn: boolean("sync_opt_in").default(false).notNull(),
	arOptIn: boolean("ar_opt_in").default(false).notNull(),
	oneStop: boolean("one_stop").default(false).notNull(),
	optInsSuspended: boolean("opt_ins_suspended").default(false).notNull(),
	bpm: integer(),
	musicalKey: text("musical_key"),
	moods: text().array().default(sql`'{}'`).notNull(),
	vocals: text(),
	instrumentalAvailable: boolean("instrumental_available").default(false).notNull(),
	catalogDescription: text("catalog_description"),
	searchTsv: tsvector("search_tsv"),
	originRequestId: uuid("origin_request_id"),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("works_search_tsv").using("gin", table.searchTsv.asc().nullsLast().op("tsvector_ops")),
	index("works_title_trgm").using("gin", table.titleNormalized.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.publisherId],
			foreignColumns: [publishers.id],
			name: "works_publisher_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "works_created_by_fkey"
		}),
	unique("works_iswc_key").on(table.iswc),
	unique("works_publisher_work_code_key").on(table.publisherWorkCode),
	check("works_iswc_check", sql`iswc ~ '^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$'::text`),
	check("works_bpm_check", sql`(bpm >= 30) AND (bpm <= 300)`),
]);

export const workFiles = pgTable("work_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id"),
	ownerUserId: uuid("owner_user_id").notNull(),
	kind: text().notNull(),
	storagePath: text("storage_path").notNull(),
	sha256: char({ length: 64 }).notNull(),
	durationMs: integer("duration_ms"),
	watermarkId: text("watermark_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "work_files_work_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "work_files_owner_user_id_fkey"
		}),
	unique("work_files_storage_path_key").on(table.storagePath),
]);

export const recordings = pgTable("recordings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workId: uuid("work_id").notNull(),
	isrc: text().notNull(),
	title: text().notNull(),
	artist: text().notNull(),
	masterOwner: text("master_owner"),
	masterControlledByWriter: boolean("master_controlled_by_writer").default(false).notNull(),
}, (table) => [
	index("recordings_isrc").using("btree", table.isrc.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "recordings_work_id_fkey"
		}),
	unique("recordings_work_id_isrc_key").on(table.workId, table.isrc),
	check("recordings_isrc_check", sql`isrc ~ '^[A-Z]{2}[A-Z0-9]{3}\d{7}$'::text`),
]);

export const statementFiles = pgTable("statement_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	periodId: uuid("period_id").notNull(),
	provider: text().notNull(),
	version: integer().notNull(),
	storagePath: text("storage_path").notNull(),
	sha256: char({ length: 64 }).notNull(),
	originalName: text("original_name").notNull(),
	mappingVersion: text("mapping_version").notNull(),
	controlTotal: numeric("control_total", { precision: 20, scale:  6 }),
	receivedAmount: numeric("received_amount", { precision: 20, scale:  6 }).notNull(),
	receivedCurrency: char("received_currency", { length: 3 }).notNull(),
	status: statementFileStatus().default('uploaded').notNull(),
	supersedesId: uuid("supersedes_id"),
	uploadedBy: uuid("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	controlTotals: jsonb("control_totals").default({}).notNull(),
	parseErrors: jsonb("parse_errors").default([]).notNull(),
	lineCount: integer("line_count").default(0).notNull(),
}, (table) => [
	uniqueIndex("statement_files_period_sha").using("btree", table.periodId.asc().nullsLast().op("bpchar_ops"), table.sha256.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [statementPeriods.id],
			name: "statement_files_period_id_fkey"
		}),
	foreignKey({
			columns: [table.supersedesId],
			foreignColumns: [table.id],
			name: "statement_files_supersedes_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "statement_files_uploaded_by_fkey"
		}),
	unique("statement_files_period_id_version_key").on(table.periodId, table.version),
	unique("statement_files_storage_path_key").on(table.storagePath),
]);

export const distributionRuns = pgTable("distribution_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	periodId: uuid("period_id").notNull(),
	fileIds: uuid("file_ids").array().notNull(),
	status: runStatus().default('draft').notNull(),
	paramsSnapshot: jsonb("params_snapshot").notNull(),
	paramsSha256: char("params_sha256", { length: 64 }).notNull(),
	calculatedBy: uuid("calculated_by"),
	calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: 'string' }),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }),
	publishedBy: uuid("published_by"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	receivedCents: bigint("received_cents", { mode: "number" }),
	testSentAt: timestamp("test_sent_at", { withTimezone: true, mode: 'string' }),
	invalidatedReason: text("invalidated_reason"),
}, (table) => [
	uniqueIndex("distribution_runs_one_live").using("btree", table.periodId.asc().nullsLast().op("uuid_ops")).where(sql`(status = ANY (ARRAY['draft'::run_status, 'calculating'::run_status, 'calculated'::run_status, 'reconciled'::run_status, 'unbalanced'::run_status, 'approved'::run_status, 'scheduled'::run_status]))`),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [statementPeriods.id],
			name: "distribution_runs_period_id_fkey"
		}),
	foreignKey({
			columns: [table.calculatedBy],
			foreignColumns: [users.id],
			name: "distribution_runs_calculated_by_fkey"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "distribution_runs_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.publishedBy],
			foreignColumns: [users.id],
			name: "distribution_runs_published_by_fkey"
		}),
	check("distribution_runs_check", sql`(approved_by IS NULL) OR (approved_by <> calculated_by)`),
]);

export const emailSuppressions = pgTable("email_suppressions", {
	email: citext("email").primaryKey().notNull(),
	reason: text().notNull(),
	detail: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const matchSuggestions = pgTable("match_suggestions", {
	lineId: uuid("line_id").notNull(),
	workId: uuid("work_id").notNull(),
	score: numeric({ precision: 4, scale:  3 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.lineId],
			foreignColumns: [statementLines.id],
			name: "match_suggestions_line_id_fkey"
		}),
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "match_suggestions_work_id_fkey"
		}),
	primaryKey({ columns: [table.lineId, table.workId], name: "match_suggestions_pkey"}),
]);

export const workAliases = pgTable("work_aliases", {
	provider: text().notNull(),
	aliasKey: text("alias_key").notNull(),
	workId: uuid("work_id").notNull(),
	createdBy: uuid("created_by").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workId],
			foreignColumns: [works.id],
			name: "work_aliases_work_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "work_aliases_created_by_fkey"
		}),
	primaryKey({ columns: [table.provider, table.aliasKey], name: "work_aliases_pkey"}),
]);

export const licenseApprovals = pgTable("license_approvals", {
	licenseRequestId: uuid("license_request_id").notNull(),
	writerUserId: uuid("writer_user_id").notNull(),
	decision: text(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.licenseRequestId],
			foreignColumns: [licenseRequests.id],
			name: "license_approvals_license_request_id_fkey"
		}),
	foreignKey({
			columns: [table.writerUserId],
			foreignColumns: [users.id],
			name: "license_approvals_writer_user_id_fkey"
		}),
	primaryKey({ columns: [table.licenseRequestId, table.writerUserId], name: "license_approvals_pkey"}),
]);

export const notificationPreferences = pgTable("notification_preferences", {
	userId: uuid("user_id").notNull(),
	category: text().notNull(),
	channel: notifChannel().notNull(),
	enabled: boolean().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_preferences_user_id_fkey"
		}),
	primaryKey({ columns: [table.userId, table.category, table.channel], name: "notification_preferences_pkey"}),
]);

export const userRoles = pgTable("user_roles", {
	userId: uuid("user_id").notNull(),
	role: appRole().notNull(),
	grantedBy: uuid("granted_by"),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [users.id],
			name: "user_roles_granted_by_fkey"
		}),
	primaryKey({ columns: [table.userId, table.role], name: "user_roles_pkey"}),
]);
export const writerBalances = pgView("writer_balances", {	writerUserId: uuid("writer_user_id"),
	currency: char({ length: 3 }),
	balanceCents: numeric("balance_cents"),
}).with({"securityInvoker":true}).as(sql`SELECT writer_user_id, currency, sum(amount_cents) AS balance_cents FROM writer_ledger_entries GROUP BY writer_user_id, currency`);

export const arCatalogV = pgView("ar_catalog_v", {	id: uuid(),
	title: text(),
	language: text(),
	genre: text(),
	bpm: integer(),
	moods: text(),
	vocals: text(),
	lyricsExcerpt: text("lyrics_excerpt"),
	artistName: text("artist_name"),
}).with({"securityBarrier":true}).as(sql`SELECT w.id, w.title, w.language, w.genre, w.bpm, w.moods, w.vocals, "left"(w.lyrics, 280) AS lyrics_excerpt, wp.artist_name FROM works w JOIN writer_profiles wp ON wp.user_id = w.created_by WHERE w.ar_opt_in AND NOT w.opt_ins_suspended AND (w.status = ANY (ARRAY['splits_signed'::work_status, 'sent_to_publisher'::work_status, 'registered'::work_status])) AND NOT (EXISTS ( SELECT 1 FROM recordings r WHERE r.work_id = w.id))`);

export const syncCatalogV = pgView("sync_catalog_v", {	id: uuid(),
	title: text(),
	language: text(),
	genre: text(),
	bpm: integer(),
	musicalKey: text("musical_key"),
	moods: text(),
	vocals: text(),
	instrumentalAvailable: boolean("instrumental_available"),
	oneStop: boolean("one_stop"),
	catalogDescription: text("catalog_description"),
}).with({"securityBarrier":true}).as(sql`SELECT id, title, language, genre, bpm, musical_key, moods, vocals, instrumental_available, one_stop, catalog_description FROM works w WHERE sync_opt_in AND NOT opt_ins_suspended AND (status = ANY (ARRAY['splits_signed'::work_status, 'sent_to_publisher'::work_status, 'registered'::work_status]))`);
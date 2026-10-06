// GENERADO. No editar a mano.
import { relations } from "drizzle-orm/relations";
import { users, kycChecks, dataSubjectRequests, signatures, legalDocuments, agreements, publishers, writerProfiles, proSocieties, guardians, taxProfiles, works, recordings, publisherSubmissions, plans, memberships, membershipPlanPeriods, membershipPayments, workFiles, splitVersions, splitShares, workStatusHistory, workConflicts, disputes, beneficiaryChanges, statementPeriods, statementFiles, statementLines, advances, fxRates, distributions, distributionRuns, reconciliations, taxCertificates, payouts, payoutMethods, networkRequests, applications, collaborations, credits, arInvitations, arInterests, holds, syncBuyers, syncBriefs, briefSubmissions, licenseRequests, syncRateCard, domainEvents, notifications, notificationDeliveries, writerTerminations, writerStatements, writerLedgerEntries, audioPlays, pushSubscriptions, planPrices, matchSuggestions, userRoles, licenseApprovals, workAliases, notificationPreferences } from "./schema";

export const kycChecksRelations = relations(kycChecks, ({one}) => ({
	user: one(users, {
		fields: [kycChecks.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	kycChecks: many(kycChecks),
	dataSubjectRequests: many(dataSubjectRequests),
	signatures_onBehalfOfUserId: many(signatures, {
		relationName: "signatures_onBehalfOfUserId_users_id"
	}),
	signatures_signerUserId: many(signatures, {
		relationName: "signatures_signerUserId_users_id"
	}),
	agreements: many(agreements),
	writerProfiles: many(writerProfiles),
	taxProfiles: many(taxProfiles),
	publisherSubmissions: many(publisherSubmissions),
	memberships: many(memberships),
	membershipPlanPeriods: many(membershipPlanPeriods),
	membershipPayments: many(membershipPayments),
	works: many(works),
	workFiles: many(workFiles),
	splitVersions: many(splitVersions),
	splitShares: many(splitShares),
	workConflicts: many(workConflicts),
	disputes_raisedByUserId: many(disputes, {
		relationName: "disputes_raisedByUserId_users_id"
	}),
	disputes_resolvedBy: many(disputes, {
		relationName: "disputes_resolvedBy_users_id"
	}),
	beneficiaryChanges_approvedBy: many(beneficiaryChanges, {
		relationName: "beneficiaryChanges_approvedBy_users_id"
	}),
	beneficiaryChanges_writerUserId: many(beneficiaryChanges, {
		relationName: "beneficiaryChanges_writerUserId_users_id"
	}),
	statementLines: many(statementLines),
	advances: many(advances),
	distributions: many(distributions),
	taxCertificates: many(taxCertificates),
	payouts_approvedBy: many(payouts, {
		relationName: "payouts_approvedBy_users_id"
	}),
	payouts_preparedBy: many(payouts, {
		relationName: "payouts_preparedBy_users_id"
	}),
	payouts_writerUserId: many(payouts, {
		relationName: "payouts_writerUserId_users_id"
	}),
	networkRequests: many(networkRequests),
	applications: many(applications),
	credits: many(credits),
	arInvitations_acceptedUserId: many(arInvitations, {
		relationName: "arInvitations_acceptedUserId_users_id"
	}),
	arInvitations_invitedBy: many(arInvitations, {
		relationName: "arInvitations_invitedBy_users_id"
	}),
	arInterests: many(arInterests),
	holds_decidedBy: many(holds, {
		relationName: "holds_decidedBy_users_id"
	}),
	holds_requesterUserId: many(holds, {
		relationName: "holds_requesterUserId_users_id"
	}),
	syncBuyers: many(syncBuyers),
	syncBriefs: many(syncBriefs),
	briefSubmissions: many(briefSubmissions),
	licenseRequests_buyerUserId: many(licenseRequests, {
		relationName: "licenseRequests_buyerUserId_users_id"
	}),
	licenseRequests_operatorId: many(licenseRequests, {
		relationName: "licenseRequests_operatorId_users_id"
	}),
	notifications: many(notifications),
	writerTerminations: many(writerTerminations),
	writerStatements: many(writerStatements),
	writerLedgerEntries: many(writerLedgerEntries),
	audioPlays: many(audioPlays),
	pushSubscriptions: many(pushSubscriptions),
	payoutMethods: many(payoutMethods),
	distributionRuns_approvedBy: many(distributionRuns, {
		relationName: "distributionRuns_approvedBy_users_id"
	}),
	distributionRuns_calculatedBy: many(distributionRuns, {
		relationName: "distributionRuns_calculatedBy_users_id"
	}),
	distributionRuns_publishedBy: many(distributionRuns, {
		relationName: "distributionRuns_publishedBy_users_id"
	}),
	statementFiles: many(statementFiles),
	userRoles_grantedBy: many(userRoles, {
		relationName: "userRoles_grantedBy_users_id"
	}),
	userRoles_userId: many(userRoles, {
		relationName: "userRoles_userId_users_id"
	}),
	licenseApprovals: many(licenseApprovals),
	workAliases: many(workAliases),
	notificationPreferences: many(notificationPreferences),
}));

export const dataSubjectRequestsRelations = relations(dataSubjectRequests, ({one}) => ({
	user: one(users, {
		fields: [dataSubjectRequests.userId],
		references: [users.id]
	}),
}));

export const signaturesRelations = relations(signatures, ({one, many}) => ({
	user_onBehalfOfUserId: one(users, {
		fields: [signatures.onBehalfOfUserId],
		references: [users.id],
		relationName: "signatures_onBehalfOfUserId_users_id"
	}),
	user_signerUserId: one(users, {
		fields: [signatures.signerUserId],
		references: [users.id],
		relationName: "signatures_signerUserId_users_id"
	}),
	agreements: many(agreements),
	splitShares: many(splitShares),
}));

export const agreementsRelations = relations(agreements, ({one}) => ({
	legalDocument: one(legalDocuments, {
		fields: [agreements.legalDocumentId],
		references: [legalDocuments.id]
	}),
	signature: one(signatures, {
		fields: [agreements.signatureId],
		references: [signatures.id]
	}),
	user: one(users, {
		fields: [agreements.userId],
		references: [users.id]
	}),
}));

export const legalDocumentsRelations = relations(legalDocuments, ({many}) => ({
	agreements: many(agreements),
}));

export const writerProfilesRelations = relations(writerProfiles, ({one, many}) => ({
	publisher: one(publishers, {
		fields: [writerProfiles.publisherId],
		references: [publishers.id]
	}),
	proSociety: one(proSocieties, {
		fields: [writerProfiles.societyCode],
		references: [proSocieties.code]
	}),
	user: one(users, {
		fields: [writerProfiles.userId],
		references: [users.id]
	}),
	guardians: many(guardians),
}));

export const publishersRelations = relations(publishers, ({many}) => ({
	writerProfiles: many(writerProfiles),
	works: many(works),
	statementPeriods: many(statementPeriods),
	plans: many(plans),
}));

export const proSocietiesRelations = relations(proSocieties, ({many}) => ({
	writerProfiles: many(writerProfiles),
}));

export const guardiansRelations = relations(guardians, ({one}) => ({
	writerProfile: one(writerProfiles, {
		fields: [guardians.writerUserId],
		references: [writerProfiles.userId]
	}),
}));

export const taxProfilesRelations = relations(taxProfiles, ({one}) => ({
	user: one(users, {
		fields: [taxProfiles.userId],
		references: [users.id]
	}),
}));

export const recordingsRelations = relations(recordings, ({one}) => ({
	work: one(works, {
		fields: [recordings.workId],
		references: [works.id]
	}),
}));

export const worksRelations = relations(works, ({one, many}) => ({
	recordings: many(recordings),
	user: one(users, {
		fields: [works.createdBy],
		references: [users.id]
	}),
	publisher: one(publishers, {
		fields: [works.publisherId],
		references: [publishers.id]
	}),
	workFiles: many(workFiles),
	splitVersions: many(splitVersions),
	workStatusHistories: many(workStatusHistory),
	workConflicts_conflictingWorkId: many(workConflicts, {
		relationName: "workConflicts_conflictingWorkId_works_id"
	}),
	workConflicts_workId: many(workConflicts, {
		relationName: "workConflicts_workId_works_id"
	}),
	disputes: many(disputes),
	statementLines: many(statementLines),
	collaborations: many(collaborations),
	credits: many(credits),
	arInterests: many(arInterests),
	holds: many(holds),
	briefSubmissions: many(briefSubmissions),
	licenseRequests: many(licenseRequests),
	writerStatements: many(writerStatements),
	matchSuggestions: many(matchSuggestions),
	workAliases: many(workAliases),
}));

export const publisherSubmissionsRelations = relations(publisherSubmissions, ({one}) => ({
	user: one(users, {
		fields: [publisherSubmissions.createdBy],
		references: [users.id]
	}),
}));

export const membershipsRelations = relations(memberships, ({one}) => ({
	plan: one(plans, {
		fields: [memberships.planCode],
		references: [plans.code]
	}),
	user: one(users, {
		fields: [memberships.userId],
		references: [users.id]
	}),
}));

export const plansRelations = relations(plans, ({one, many}) => ({
	memberships: many(memberships),
	publisher: one(publishers, {
		fields: [plans.publisherId],
		references: [publishers.id]
	}),
	planPrices: many(planPrices),
}));

export const membershipPlanPeriodsRelations = relations(membershipPlanPeriods, ({one}) => ({
	user: one(users, {
		fields: [membershipPlanPeriods.userId],
		references: [users.id]
	}),
}));

export const membershipPaymentsRelations = relations(membershipPayments, ({one}) => ({
	user: one(users, {
		fields: [membershipPayments.userId],
		references: [users.id]
	}),
}));

export const workFilesRelations = relations(workFiles, ({one, many}) => ({
	user: one(users, {
		fields: [workFiles.ownerUserId],
		references: [users.id]
	}),
	work: one(works, {
		fields: [workFiles.workId],
		references: [works.id]
	}),
	networkRequests: many(networkRequests),
	applications: many(applications),
	audioPlays: many(audioPlays),
}));

export const splitVersionsRelations = relations(splitVersions, ({one, many}) => ({
	user: one(users, {
		fields: [splitVersions.createdBy],
		references: [users.id]
	}),
	work: one(works, {
		fields: [splitVersions.workId],
		references: [works.id]
	}),
	splitShares: many(splitShares),
	disputes: many(disputes),
}));

export const splitSharesRelations = relations(splitShares, ({one, many}) => ({
	signature: one(signatures, {
		fields: [splitShares.signatureId],
		references: [signatures.id]
	}),
	splitVersion: one(splitVersions, {
		fields: [splitShares.splitVersionId],
		references: [splitVersions.id]
	}),
	user: one(users, {
		fields: [splitShares.writerUserId],
		references: [users.id]
	}),
	distributions: many(distributions),
}));

export const workStatusHistoryRelations = relations(workStatusHistory, ({one}) => ({
	work: one(works, {
		fields: [workStatusHistory.workId],
		references: [works.id]
	}),
}));

export const workConflictsRelations = relations(workConflicts, ({one}) => ({
	work_conflictingWorkId: one(works, {
		fields: [workConflicts.conflictingWorkId],
		references: [works.id],
		relationName: "workConflicts_conflictingWorkId_works_id"
	}),
	user: one(users, {
		fields: [workConflicts.reviewedBy],
		references: [users.id]
	}),
	work_workId: one(works, {
		fields: [workConflicts.workId],
		references: [works.id],
		relationName: "workConflicts_workId_works_id"
	}),
}));

export const disputesRelations = relations(disputes, ({one}) => ({
	user_raisedByUserId: one(users, {
		fields: [disputes.raisedByUserId],
		references: [users.id],
		relationName: "disputes_raisedByUserId_users_id"
	}),
	user_resolvedBy: one(users, {
		fields: [disputes.resolvedBy],
		references: [users.id],
		relationName: "disputes_resolvedBy_users_id"
	}),
	splitVersion: one(splitVersions, {
		fields: [disputes.splitVersionId],
		references: [splitVersions.id]
	}),
	work: one(works, {
		fields: [disputes.workId],
		references: [works.id]
	}),
}));

export const beneficiaryChangesRelations = relations(beneficiaryChanges, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [beneficiaryChanges.approvedBy],
		references: [users.id],
		relationName: "beneficiaryChanges_approvedBy_users_id"
	}),
	user_writerUserId: one(users, {
		fields: [beneficiaryChanges.writerUserId],
		references: [users.id],
		relationName: "beneficiaryChanges_writerUserId_users_id"
	}),
}));

export const statementPeriodsRelations = relations(statementPeriods, ({one, many}) => ({
	publisher: one(publishers, {
		fields: [statementPeriods.publisherId],
		references: [publishers.id]
	}),
	writerStatements: many(writerStatements),
	distributionRuns: many(distributionRuns),
	statementFiles: many(statementFiles),
}));

export const statementLinesRelations = relations(statementLines, ({one, many}) => ({
	statementFile: one(statementFiles, {
		fields: [statementLines.fileId],
		references: [statementFiles.id]
	}),
	user: one(users, {
		fields: [statementLines.matchedBy],
		references: [users.id]
	}),
	work: one(works, {
		fields: [statementLines.matchedWorkId],
		references: [works.id]
	}),
	distributions: many(distributions),
	matchSuggestions: many(matchSuggestions),
}));

export const statementFilesRelations = relations(statementFiles, ({one, many}) => ({
	statementLines: many(statementLines),
	statementPeriod: one(statementPeriods, {
		fields: [statementFiles.periodId],
		references: [statementPeriods.id]
	}),
	statementFile: one(statementFiles, {
		fields: [statementFiles.supersedesId],
		references: [statementFiles.id],
		relationName: "statementFiles_supersedesId_statementFiles_id"
	}),
	statementFiles: many(statementFiles, {
		relationName: "statementFiles_supersedesId_statementFiles_id"
	}),
	user: one(users, {
		fields: [statementFiles.uploadedBy],
		references: [users.id]
	}),
}));

export const advancesRelations = relations(advances, ({one}) => ({
	user: one(users, {
		fields: [advances.writerUserId],
		references: [users.id]
	}),
}));

export const distributionsRelations = relations(distributions, ({one}) => ({
	fxRate: one(fxRates, {
		fields: [distributions.fxRateId],
		references: [fxRates.id]
	}),
	statementLine: one(statementLines, {
		fields: [distributions.lineId],
		references: [statementLines.id]
	}),
	distributionRun: one(distributionRuns, {
		fields: [distributions.runId],
		references: [distributionRuns.id]
	}),
	splitShare: one(splitShares, {
		fields: [distributions.splitShareId],
		references: [splitShares.id]
	}),
	user: one(users, {
		fields: [distributions.writerUserId],
		references: [users.id]
	}),
}));

export const fxRatesRelations = relations(fxRates, ({many}) => ({
	distributions: many(distributions),
}));

export const distributionRunsRelations = relations(distributionRuns, ({one, many}) => ({
	distributions: many(distributions),
	reconciliations: many(reconciliations),
	writerStatements: many(writerStatements),
	user_approvedBy: one(users, {
		fields: [distributionRuns.approvedBy],
		references: [users.id],
		relationName: "distributionRuns_approvedBy_users_id"
	}),
	user_calculatedBy: one(users, {
		fields: [distributionRuns.calculatedBy],
		references: [users.id],
		relationName: "distributionRuns_calculatedBy_users_id"
	}),
	statementPeriod: one(statementPeriods, {
		fields: [distributionRuns.periodId],
		references: [statementPeriods.id]
	}),
	user_publishedBy: one(users, {
		fields: [distributionRuns.publishedBy],
		references: [users.id],
		relationName: "distributionRuns_publishedBy_users_id"
	}),
}));

export const reconciliationsRelations = relations(reconciliations, ({one}) => ({
	distributionRun: one(distributionRuns, {
		fields: [reconciliations.runId],
		references: [distributionRuns.id]
	}),
}));

export const taxCertificatesRelations = relations(taxCertificates, ({one}) => ({
	user: one(users, {
		fields: [taxCertificates.writerUserId],
		references: [users.id]
	}),
}));

export const payoutsRelations = relations(payouts, ({one}) => ({
	user_approvedBy: one(users, {
		fields: [payouts.approvedBy],
		references: [users.id],
		relationName: "payouts_approvedBy_users_id"
	}),
	payoutMethod: one(payoutMethods, {
		fields: [payouts.payoutMethodId],
		references: [payoutMethods.id]
	}),
	user_preparedBy: one(users, {
		fields: [payouts.preparedBy],
		references: [users.id],
		relationName: "payouts_preparedBy_users_id"
	}),
	user_writerUserId: one(users, {
		fields: [payouts.writerUserId],
		references: [users.id],
		relationName: "payouts_writerUserId_users_id"
	}),
}));

export const payoutMethodsRelations = relations(payoutMethods, ({one, many}) => ({
	payouts: many(payouts),
	user: one(users, {
		fields: [payoutMethods.userId],
		references: [users.id]
	}),
}));

export const networkRequestsRelations = relations(networkRequests, ({one, many}) => ({
	user: one(users, {
		fields: [networkRequests.authorUserId],
		references: [users.id]
	}),
	workFile: one(workFiles, {
		fields: [networkRequests.demoFileId],
		references: [workFiles.id]
	}),
	applications: many(applications),
	collaborations: many(collaborations),
}));

export const applicationsRelations = relations(applications, ({one, many}) => ({
	user: one(users, {
		fields: [applications.applicantUserId],
		references: [users.id]
	}),
	networkRequest: one(networkRequests, {
		fields: [applications.requestId],
		references: [networkRequests.id]
	}),
	workFile: one(workFiles, {
		fields: [applications.sampleFileId],
		references: [workFiles.id]
	}),
	collaborations: many(collaborations),
}));

export const collaborationsRelations = relations(collaborations, ({one}) => ({
	application: one(applications, {
		fields: [collaborations.applicationId],
		references: [applications.id]
	}),
	networkRequest: one(networkRequests, {
		fields: [collaborations.requestId],
		references: [networkRequests.id]
	}),
	work: one(works, {
		fields: [collaborations.workId],
		references: [works.id]
	}),
}));

export const creditsRelations = relations(credits, ({one}) => ({
	user: one(users, {
		fields: [credits.userId],
		references: [users.id]
	}),
	work: one(works, {
		fields: [credits.workId],
		references: [works.id]
	}),
}));

export const arInvitationsRelations = relations(arInvitations, ({one}) => ({
	user_acceptedUserId: one(users, {
		fields: [arInvitations.acceptedUserId],
		references: [users.id],
		relationName: "arInvitations_acceptedUserId_users_id"
	}),
	user_invitedBy: one(users, {
		fields: [arInvitations.invitedBy],
		references: [users.id],
		relationName: "arInvitations_invitedBy_users_id"
	}),
}));

export const arInterestsRelations = relations(arInterests, ({one}) => ({
	user: one(users, {
		fields: [arInterests.arUserId],
		references: [users.id]
	}),
	work: one(works, {
		fields: [arInterests.workId],
		references: [works.id]
	}),
}));

export const holdsRelations = relations(holds, ({one}) => ({
	user_decidedBy: one(users, {
		fields: [holds.decidedBy],
		references: [users.id],
		relationName: "holds_decidedBy_users_id"
	}),
	user_requesterUserId: one(users, {
		fields: [holds.requesterUserId],
		references: [users.id],
		relationName: "holds_requesterUserId_users_id"
	}),
	work: one(works, {
		fields: [holds.workId],
		references: [works.id]
	}),
}));

export const syncBuyersRelations = relations(syncBuyers, ({one}) => ({
	user: one(users, {
		fields: [syncBuyers.userId],
		references: [users.id]
	}),
}));

export const syncBriefsRelations = relations(syncBriefs, ({one, many}) => ({
	user: one(users, {
		fields: [syncBriefs.buyerUserId],
		references: [users.id]
	}),
	briefSubmissions: many(briefSubmissions),
	licenseRequests: many(licenseRequests),
}));

export const briefSubmissionsRelations = relations(briefSubmissions, ({one}) => ({
	syncBrief: one(syncBriefs, {
		fields: [briefSubmissions.briefId],
		references: [syncBriefs.id]
	}),
	user: one(users, {
		fields: [briefSubmissions.submittedBy],
		references: [users.id]
	}),
	work: one(works, {
		fields: [briefSubmissions.workId],
		references: [works.id]
	}),
}));

export const licenseRequestsRelations = relations(licenseRequests, ({one, many}) => ({
	syncBrief: one(syncBriefs, {
		fields: [licenseRequests.briefId],
		references: [syncBriefs.id]
	}),
	user_buyerUserId: one(users, {
		fields: [licenseRequests.buyerUserId],
		references: [users.id],
		relationName: "licenseRequests_buyerUserId_users_id"
	}),
	user_operatorId: one(users, {
		fields: [licenseRequests.operatorId],
		references: [users.id],
		relationName: "licenseRequests_operatorId_users_id"
	}),
	syncRateCard: one(syncRateCard, {
		fields: [licenseRequests.rateCardId],
		references: [syncRateCard.id]
	}),
	work: one(works, {
		fields: [licenseRequests.workId],
		references: [works.id]
	}),
	licenseApprovals: many(licenseApprovals),
}));

export const syncRateCardRelations = relations(syncRateCard, ({many}) => ({
	licenseRequests: many(licenseRequests),
}));

export const notificationsRelations = relations(notifications, ({one, many}) => ({
	domainEvent: one(domainEvents, {
		fields: [notifications.eventId],
		references: [domainEvents.id]
	}),
	user: one(users, {
		fields: [notifications.recipientUserId],
		references: [users.id]
	}),
	notificationDeliveries: many(notificationDeliveries),
}));

export const domainEventsRelations = relations(domainEvents, ({many}) => ({
	notifications: many(notifications),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({one}) => ({
	notification: one(notifications, {
		fields: [notificationDeliveries.notificationId],
		references: [notifications.id]
	}),
}));

export const writerTerminationsRelations = relations(writerTerminations, ({one}) => ({
	user: one(users, {
		fields: [writerTerminations.userId],
		references: [users.id]
	}),
}));

export const writerStatementsRelations = relations(writerStatements, ({one, many}) => ({
	statementPeriod: one(statementPeriods, {
		fields: [writerStatements.periodId],
		references: [statementPeriods.id]
	}),
	distributionRun: one(distributionRuns, {
		fields: [writerStatements.runId],
		references: [distributionRuns.id]
	}),
	work: one(works, {
		fields: [writerStatements.topWorkId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [writerStatements.writerUserId],
		references: [users.id]
	}),
	writerLedgerEntries: many(writerLedgerEntries),
}));

export const writerLedgerEntriesRelations = relations(writerLedgerEntries, ({one}) => ({
	writerStatement: one(writerStatements, {
		fields: [writerLedgerEntries.writerStatementId],
		references: [writerStatements.id]
	}),
	user: one(users, {
		fields: [writerLedgerEntries.writerUserId],
		references: [users.id]
	}),
}));

export const audioPlaysRelations = relations(audioPlays, ({one}) => ({
	workFile: one(workFiles, {
		fields: [audioPlays.fileId],
		references: [workFiles.id]
	}),
	user: one(users, {
		fields: [audioPlays.listenerUserId],
		references: [users.id]
	}),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({one}) => ({
	user: one(users, {
		fields: [pushSubscriptions.userId],
		references: [users.id]
	}),
}));

export const planPricesRelations = relations(planPrices, ({one}) => ({
	plan: one(plans, {
		fields: [planPrices.planCode],
		references: [plans.code]
	}),
}));

export const matchSuggestionsRelations = relations(matchSuggestions, ({one}) => ({
	statementLine: one(statementLines, {
		fields: [matchSuggestions.lineId],
		references: [statementLines.id]
	}),
	work: one(works, {
		fields: [matchSuggestions.workId],
		references: [works.id]
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user_grantedBy: one(users, {
		fields: [userRoles.grantedBy],
		references: [users.id],
		relationName: "userRoles_grantedBy_users_id"
	}),
	user_userId: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
		relationName: "userRoles_userId_users_id"
	}),
}));

export const licenseApprovalsRelations = relations(licenseApprovals, ({one}) => ({
	licenseRequest: one(licenseRequests, {
		fields: [licenseApprovals.licenseRequestId],
		references: [licenseRequests.id]
	}),
	user: one(users, {
		fields: [licenseApprovals.writerUserId],
		references: [users.id]
	}),
}));

export const workAliasesRelations = relations(workAliases, ({one}) => ({
	user: one(users, {
		fields: [workAliases.createdBy],
		references: [users.id]
	}),
	work: one(works, {
		fields: [workAliases.workId],
		references: [works.id]
	}),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id]
	}),
}));
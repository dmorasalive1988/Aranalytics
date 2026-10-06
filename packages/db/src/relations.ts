// GENERADO. No editar a mano.
import { relations } from "drizzle-orm/relations";
import { splitVersions, splitShares, users, signatures, publishers, statementPeriods, advances, agreements, legalDocuments, membershipPayments, works, workStatusHistory, workConflicts, disputes, publisherSubmissions, writerTerminations, beneficiaryChanges, statementFiles, statementLines, writerLedgerEntries, writerStatements, taxCertificates, payouts, payoutMethods, arInvitations, licenseRequests, syncBriefs, syncRateCard, notifications, notificationDeliveries, distributionRuns, distributions, fxRates, reconciliations, workFiles, audioPlays, arInterests, holds, syncBuyers, writerProfiles, guardians, briefSubmissions, domainEvents, networkRequests, applications, collaborations, credits, proSocieties, plans, planPrices, pushSubscriptions, dataSubjectRequests, taxProfiles, kycChecks, memberships, membershipPlanPeriods, recordings, matchSuggestions, workAliases, licenseApprovals, notificationPreferences, userRoles } from "./schema";

export const splitSharesRelations = relations(splitShares, ({one, many}) => ({
	splitVersion: one(splitVersions, {
		fields: [splitShares.splitVersionId],
		references: [splitVersions.id]
	}),
	user: one(users, {
		fields: [splitShares.writerUserId],
		references: [users.id]
	}),
	signature: one(signatures, {
		fields: [splitShares.signatureId],
		references: [signatures.id]
	}),
	distributions: many(distributions),
}));

export const splitVersionsRelations = relations(splitVersions, ({one, many}) => ({
	splitShares: many(splitShares),
	work: one(works, {
		fields: [splitVersions.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [splitVersions.createdBy],
		references: [users.id]
	}),
	disputes: many(disputes),
}));

export const usersRelations = relations(users, ({many}) => ({
	splitShares: many(splitShares),
	advances: many(advances),
	signatures_signerUserId: many(signatures, {
		relationName: "signatures_signerUserId_users_id"
	}),
	signatures_onBehalfOfUserId: many(signatures, {
		relationName: "signatures_onBehalfOfUserId_users_id"
	}),
	agreements: many(agreements),
	membershipPayments: many(membershipPayments),
	splitVersions: many(splitVersions),
	workConflicts: many(workConflicts),
	disputes_raisedByUserId: many(disputes, {
		relationName: "disputes_raisedByUserId_users_id"
	}),
	disputes_resolvedBy: many(disputes, {
		relationName: "disputes_resolvedBy_users_id"
	}),
	publisherSubmissions: many(publisherSubmissions),
	writerTerminations: many(writerTerminations),
	beneficiaryChanges_writerUserId: many(beneficiaryChanges, {
		relationName: "beneficiaryChanges_writerUserId_users_id"
	}),
	beneficiaryChanges_approvedBy: many(beneficiaryChanges, {
		relationName: "beneficiaryChanges_approvedBy_users_id"
	}),
	statementLines: many(statementLines),
	writerLedgerEntries: many(writerLedgerEntries),
	taxCertificates: many(taxCertificates),
	payouts_writerUserId: many(payouts, {
		relationName: "payouts_writerUserId_users_id"
	}),
	payouts_preparedBy: many(payouts, {
		relationName: "payouts_preparedBy_users_id"
	}),
	payouts_approvedBy: many(payouts, {
		relationName: "payouts_approvedBy_users_id"
	}),
	arInvitations_invitedBy: many(arInvitations, {
		relationName: "arInvitations_invitedBy_users_id"
	}),
	arInvitations_acceptedUserId: many(arInvitations, {
		relationName: "arInvitations_acceptedUserId_users_id"
	}),
	licenseRequests_buyerUserId: many(licenseRequests, {
		relationName: "licenseRequests_buyerUserId_users_id"
	}),
	licenseRequests_operatorId: many(licenseRequests, {
		relationName: "licenseRequests_operatorId_users_id"
	}),
	distributions: many(distributions),
	writerStatements: many(writerStatements),
	audioPlays: many(audioPlays),
	arInterests: many(arInterests),
	holds_requesterUserId: many(holds, {
		relationName: "holds_requesterUserId_users_id"
	}),
	holds_decidedBy: many(holds, {
		relationName: "holds_decidedBy_users_id"
	}),
	syncBuyers: many(syncBuyers),
	syncBriefs: many(syncBriefs),
	briefSubmissions: many(briefSubmissions),
	notifications: many(notifications),
	networkRequests_hiddenBy: many(networkRequests, {
		relationName: "networkRequests_hiddenBy_users_id"
	}),
	networkRequests_authorUserId: many(networkRequests, {
		relationName: "networkRequests_authorUserId_users_id"
	}),
	applications: many(applications),
	collaborations: many(collaborations),
	credits_userId: many(credits, {
		relationName: "credits_userId_users_id"
	}),
	credits_reviewedBy: many(credits, {
		relationName: "credits_reviewedBy_users_id"
	}),
	writerProfiles: many(writerProfiles),
	pushSubscriptions: many(pushSubscriptions),
	dataSubjectRequests: many(dataSubjectRequests),
	taxProfiles: many(taxProfiles),
	payoutMethods: many(payoutMethods),
	kycChecks: many(kycChecks),
	memberships: many(memberships),
	membershipPlanPeriods: many(membershipPlanPeriods),
	works: many(works),
	workFiles: many(workFiles),
	statementFiles: many(statementFiles),
	distributionRuns_calculatedBy: many(distributionRuns, {
		relationName: "distributionRuns_calculatedBy_users_id"
	}),
	distributionRuns_approvedBy: many(distributionRuns, {
		relationName: "distributionRuns_approvedBy_users_id"
	}),
	distributionRuns_publishedBy: many(distributionRuns, {
		relationName: "distributionRuns_publishedBy_users_id"
	}),
	workAliases: many(workAliases),
	licenseApprovals: many(licenseApprovals),
	notificationPreferences: many(notificationPreferences),
	userRoles_userId: many(userRoles, {
		relationName: "userRoles_userId_users_id"
	}),
	userRoles_grantedBy: many(userRoles, {
		relationName: "userRoles_grantedBy_users_id"
	}),
}));

export const signaturesRelations = relations(signatures, ({one, many}) => ({
	splitShares: many(splitShares),
	user_signerUserId: one(users, {
		fields: [signatures.signerUserId],
		references: [users.id],
		relationName: "signatures_signerUserId_users_id"
	}),
	user_onBehalfOfUserId: one(users, {
		fields: [signatures.onBehalfOfUserId],
		references: [users.id],
		relationName: "signatures_onBehalfOfUserId_users_id"
	}),
	agreements: many(agreements),
}));

export const statementPeriodsRelations = relations(statementPeriods, ({one, many}) => ({
	publisher: one(publishers, {
		fields: [statementPeriods.publisherId],
		references: [publishers.id]
	}),
	writerStatements: many(writerStatements),
	statementFiles: many(statementFiles),
	distributionRuns: many(distributionRuns),
}));

export const publishersRelations = relations(publishers, ({many}) => ({
	statementPeriods: many(statementPeriods),
	writerProfiles: many(writerProfiles),
	plans: many(plans),
	works: many(works),
}));

export const advancesRelations = relations(advances, ({one}) => ({
	user: one(users, {
		fields: [advances.writerUserId],
		references: [users.id]
	}),
}));

export const agreementsRelations = relations(agreements, ({one}) => ({
	user: one(users, {
		fields: [agreements.userId],
		references: [users.id]
	}),
	legalDocument: one(legalDocuments, {
		fields: [agreements.legalDocumentId],
		references: [legalDocuments.id]
	}),
	signature: one(signatures, {
		fields: [agreements.signatureId],
		references: [signatures.id]
	}),
}));

export const legalDocumentsRelations = relations(legalDocuments, ({many}) => ({
	agreements: many(agreements),
}));

export const membershipPaymentsRelations = relations(membershipPayments, ({one}) => ({
	user: one(users, {
		fields: [membershipPayments.userId],
		references: [users.id]
	}),
}));

export const worksRelations = relations(works, ({one, many}) => ({
	splitVersions: many(splitVersions),
	workStatusHistories: many(workStatusHistory),
	workConflicts_workId: many(workConflicts, {
		relationName: "workConflicts_workId_works_id"
	}),
	workConflicts_conflictingWorkId: many(workConflicts, {
		relationName: "workConflicts_conflictingWorkId_works_id"
	}),
	disputes: many(disputes),
	statementLines: many(statementLines),
	licenseRequests: many(licenseRequests),
	writerStatements: many(writerStatements),
	arInterests: many(arInterests),
	holds: many(holds),
	briefSubmissions: many(briefSubmissions),
	collaborations: many(collaborations),
	credits: many(credits),
	publisher: one(publishers, {
		fields: [works.publisherId],
		references: [publishers.id]
	}),
	user: one(users, {
		fields: [works.createdBy],
		references: [users.id]
	}),
	workFiles: many(workFiles),
	recordings: many(recordings),
	matchSuggestions: many(matchSuggestions),
	workAliases: many(workAliases),
}));

export const workStatusHistoryRelations = relations(workStatusHistory, ({one}) => ({
	work: one(works, {
		fields: [workStatusHistory.workId],
		references: [works.id]
	}),
}));

export const workConflictsRelations = relations(workConflicts, ({one}) => ({
	work_workId: one(works, {
		fields: [workConflicts.workId],
		references: [works.id],
		relationName: "workConflicts_workId_works_id"
	}),
	work_conflictingWorkId: one(works, {
		fields: [workConflicts.conflictingWorkId],
		references: [works.id],
		relationName: "workConflicts_conflictingWorkId_works_id"
	}),
	user: one(users, {
		fields: [workConflicts.reviewedBy],
		references: [users.id]
	}),
}));

export const disputesRelations = relations(disputes, ({one}) => ({
	work: one(works, {
		fields: [disputes.workId],
		references: [works.id]
	}),
	splitVersion: one(splitVersions, {
		fields: [disputes.splitVersionId],
		references: [splitVersions.id]
	}),
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
}));

export const publisherSubmissionsRelations = relations(publisherSubmissions, ({one}) => ({
	user: one(users, {
		fields: [publisherSubmissions.createdBy],
		references: [users.id]
	}),
}));

export const writerTerminationsRelations = relations(writerTerminations, ({one}) => ({
	user: one(users, {
		fields: [writerTerminations.userId],
		references: [users.id]
	}),
}));

export const beneficiaryChangesRelations = relations(beneficiaryChanges, ({one}) => ({
	user_writerUserId: one(users, {
		fields: [beneficiaryChanges.writerUserId],
		references: [users.id],
		relationName: "beneficiaryChanges_writerUserId_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [beneficiaryChanges.approvedBy],
		references: [users.id],
		relationName: "beneficiaryChanges_approvedBy_users_id"
	}),
}));

export const statementLinesRelations = relations(statementLines, ({one, many}) => ({
	statementFile: one(statementFiles, {
		fields: [statementLines.fileId],
		references: [statementFiles.id]
	}),
	work: one(works, {
		fields: [statementLines.matchedWorkId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [statementLines.matchedBy],
		references: [users.id]
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

export const writerLedgerEntriesRelations = relations(writerLedgerEntries, ({one}) => ({
	user: one(users, {
		fields: [writerLedgerEntries.writerUserId],
		references: [users.id]
	}),
	writerStatement: one(writerStatements, {
		fields: [writerLedgerEntries.writerStatementId],
		references: [writerStatements.id]
	}),
}));

export const writerStatementsRelations = relations(writerStatements, ({one, many}) => ({
	writerLedgerEntries: many(writerLedgerEntries),
	distributionRun: one(distributionRuns, {
		fields: [writerStatements.runId],
		references: [distributionRuns.id]
	}),
	statementPeriod: one(statementPeriods, {
		fields: [writerStatements.periodId],
		references: [statementPeriods.id]
	}),
	user: one(users, {
		fields: [writerStatements.writerUserId],
		references: [users.id]
	}),
	work: one(works, {
		fields: [writerStatements.topWorkId],
		references: [works.id]
	}),
}));

export const taxCertificatesRelations = relations(taxCertificates, ({one}) => ({
	user: one(users, {
		fields: [taxCertificates.writerUserId],
		references: [users.id]
	}),
}));

export const payoutsRelations = relations(payouts, ({one}) => ({
	user_writerUserId: one(users, {
		fields: [payouts.writerUserId],
		references: [users.id],
		relationName: "payouts_writerUserId_users_id"
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
	user_approvedBy: one(users, {
		fields: [payouts.approvedBy],
		references: [users.id],
		relationName: "payouts_approvedBy_users_id"
	}),
}));

export const payoutMethodsRelations = relations(payoutMethods, ({one, many}) => ({
	payouts: many(payouts),
	user: one(users, {
		fields: [payoutMethods.userId],
		references: [users.id]
	}),
}));

export const arInvitationsRelations = relations(arInvitations, ({one}) => ({
	user_invitedBy: one(users, {
		fields: [arInvitations.invitedBy],
		references: [users.id],
		relationName: "arInvitations_invitedBy_users_id"
	}),
	user_acceptedUserId: one(users, {
		fields: [arInvitations.acceptedUserId],
		references: [users.id],
		relationName: "arInvitations_acceptedUserId_users_id"
	}),
}));

export const licenseRequestsRelations = relations(licenseRequests, ({one, many}) => ({
	user_buyerUserId: one(users, {
		fields: [licenseRequests.buyerUserId],
		references: [users.id],
		relationName: "licenseRequests_buyerUserId_users_id"
	}),
	work: one(works, {
		fields: [licenseRequests.workId],
		references: [works.id]
	}),
	syncBrief: one(syncBriefs, {
		fields: [licenseRequests.briefId],
		references: [syncBriefs.id]
	}),
	syncRateCard: one(syncRateCard, {
		fields: [licenseRequests.rateCardId],
		references: [syncRateCard.id]
	}),
	user_operatorId: one(users, {
		fields: [licenseRequests.operatorId],
		references: [users.id],
		relationName: "licenseRequests_operatorId_users_id"
	}),
	licenseApprovals: many(licenseApprovals),
}));

export const syncBriefsRelations = relations(syncBriefs, ({one, many}) => ({
	licenseRequests: many(licenseRequests),
	user: one(users, {
		fields: [syncBriefs.buyerUserId],
		references: [users.id]
	}),
	briefSubmissions: many(briefSubmissions),
}));

export const syncRateCardRelations = relations(syncRateCard, ({many}) => ({
	licenseRequests: many(licenseRequests),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({one}) => ({
	notification: one(notifications, {
		fields: [notificationDeliveries.notificationId],
		references: [notifications.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one, many}) => ({
	notificationDeliveries: many(notificationDeliveries),
	domainEvent: one(domainEvents, {
		fields: [notifications.eventId],
		references: [domainEvents.id]
	}),
	user: one(users, {
		fields: [notifications.recipientUserId],
		references: [users.id]
	}),
}));

export const distributionsRelations = relations(distributions, ({one}) => ({
	distributionRun: one(distributionRuns, {
		fields: [distributions.runId],
		references: [distributionRuns.id]
	}),
	statementLine: one(statementLines, {
		fields: [distributions.lineId],
		references: [statementLines.id]
	}),
	splitShare: one(splitShares, {
		fields: [distributions.splitShareId],
		references: [splitShares.id]
	}),
	user: one(users, {
		fields: [distributions.writerUserId],
		references: [users.id]
	}),
	fxRate: one(fxRates, {
		fields: [distributions.fxRateId],
		references: [fxRates.id]
	}),
}));

export const distributionRunsRelations = relations(distributionRuns, ({one, many}) => ({
	distributions: many(distributions),
	reconciliations: many(reconciliations),
	writerStatements: many(writerStatements),
	statementPeriod: one(statementPeriods, {
		fields: [distributionRuns.periodId],
		references: [statementPeriods.id]
	}),
	user_calculatedBy: one(users, {
		fields: [distributionRuns.calculatedBy],
		references: [users.id],
		relationName: "distributionRuns_calculatedBy_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [distributionRuns.approvedBy],
		references: [users.id],
		relationName: "distributionRuns_approvedBy_users_id"
	}),
	user_publishedBy: one(users, {
		fields: [distributionRuns.publishedBy],
		references: [users.id],
		relationName: "distributionRuns_publishedBy_users_id"
	}),
}));

export const fxRatesRelations = relations(fxRates, ({many}) => ({
	distributions: many(distributions),
}));

export const reconciliationsRelations = relations(reconciliations, ({one}) => ({
	distributionRun: one(distributionRuns, {
		fields: [reconciliations.runId],
		references: [distributionRuns.id]
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

export const workFilesRelations = relations(workFiles, ({one, many}) => ({
	audioPlays: many(audioPlays),
	networkRequests: many(networkRequests),
	applications: many(applications),
	work: one(works, {
		fields: [workFiles.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [workFiles.ownerUserId],
		references: [users.id]
	}),
}));

export const arInterestsRelations = relations(arInterests, ({one}) => ({
	work: one(works, {
		fields: [arInterests.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [arInterests.arUserId],
		references: [users.id]
	}),
}));

export const holdsRelations = relations(holds, ({one}) => ({
	work: one(works, {
		fields: [holds.workId],
		references: [works.id]
	}),
	user_requesterUserId: one(users, {
		fields: [holds.requesterUserId],
		references: [users.id],
		relationName: "holds_requesterUserId_users_id"
	}),
	user_decidedBy: one(users, {
		fields: [holds.decidedBy],
		references: [users.id],
		relationName: "holds_decidedBy_users_id"
	}),
}));

export const syncBuyersRelations = relations(syncBuyers, ({one}) => ({
	user: one(users, {
		fields: [syncBuyers.userId],
		references: [users.id]
	}),
}));

export const guardiansRelations = relations(guardians, ({one}) => ({
	writerProfile: one(writerProfiles, {
		fields: [guardians.writerUserId],
		references: [writerProfiles.userId]
	}),
}));

export const writerProfilesRelations = relations(writerProfiles, ({one, many}) => ({
	guardians: many(guardians),
	user: one(users, {
		fields: [writerProfiles.userId],
		references: [users.id]
	}),
	publisher: one(publishers, {
		fields: [writerProfiles.publisherId],
		references: [publishers.id]
	}),
	proSociety: one(proSocieties, {
		fields: [writerProfiles.societyCode],
		references: [proSocieties.code]
	}),
}));

export const briefSubmissionsRelations = relations(briefSubmissions, ({one}) => ({
	syncBrief: one(syncBriefs, {
		fields: [briefSubmissions.briefId],
		references: [syncBriefs.id]
	}),
	work: one(works, {
		fields: [briefSubmissions.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [briefSubmissions.submittedBy],
		references: [users.id]
	}),
}));

export const domainEventsRelations = relations(domainEvents, ({many}) => ({
	notifications: many(notifications),
}));

export const networkRequestsRelations = relations(networkRequests, ({one, many}) => ({
	user_hiddenBy: one(users, {
		fields: [networkRequests.hiddenBy],
		references: [users.id],
		relationName: "networkRequests_hiddenBy_users_id"
	}),
	user_authorUserId: one(users, {
		fields: [networkRequests.authorUserId],
		references: [users.id],
		relationName: "networkRequests_authorUserId_users_id"
	}),
	workFile: one(workFiles, {
		fields: [networkRequests.demoFileId],
		references: [workFiles.id]
	}),
	applications: many(applications),
	collaborations: many(collaborations),
}));

export const applicationsRelations = relations(applications, ({one, many}) => ({
	networkRequest: one(networkRequests, {
		fields: [applications.requestId],
		references: [networkRequests.id]
	}),
	user: one(users, {
		fields: [applications.applicantUserId],
		references: [users.id]
	}),
	workFile: one(workFiles, {
		fields: [applications.sampleFileId],
		references: [workFiles.id]
	}),
	collaborations: many(collaborations),
}));

export const collaborationsRelations = relations(collaborations, ({one}) => ({
	networkRequest: one(networkRequests, {
		fields: [collaborations.requestId],
		references: [networkRequests.id]
	}),
	application: one(applications, {
		fields: [collaborations.applicationId],
		references: [applications.id]
	}),
	work: one(works, {
		fields: [collaborations.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [collaborations.closedBy],
		references: [users.id]
	}),
}));

export const creditsRelations = relations(credits, ({one}) => ({
	user_userId: one(users, {
		fields: [credits.userId],
		references: [users.id],
		relationName: "credits_userId_users_id"
	}),
	work: one(works, {
		fields: [credits.workId],
		references: [works.id]
	}),
	user_reviewedBy: one(users, {
		fields: [credits.reviewedBy],
		references: [users.id],
		relationName: "credits_reviewedBy_users_id"
	}),
}));

export const proSocietiesRelations = relations(proSocieties, ({many}) => ({
	writerProfiles: many(writerProfiles),
}));

export const plansRelations = relations(plans, ({one, many}) => ({
	publisher: one(publishers, {
		fields: [plans.publisherId],
		references: [publishers.id]
	}),
	planPrices: many(planPrices),
	memberships: many(memberships),
}));

export const planPricesRelations = relations(planPrices, ({one}) => ({
	plan: one(plans, {
		fields: [planPrices.planCode],
		references: [plans.code]
	}),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({one}) => ({
	user: one(users, {
		fields: [pushSubscriptions.userId],
		references: [users.id]
	}),
}));

export const dataSubjectRequestsRelations = relations(dataSubjectRequests, ({one}) => ({
	user: one(users, {
		fields: [dataSubjectRequests.userId],
		references: [users.id]
	}),
}));

export const taxProfilesRelations = relations(taxProfiles, ({one}) => ({
	user: one(users, {
		fields: [taxProfiles.userId],
		references: [users.id]
	}),
}));

export const kycChecksRelations = relations(kycChecks, ({one}) => ({
	user: one(users, {
		fields: [kycChecks.userId],
		references: [users.id]
	}),
}));

export const membershipsRelations = relations(memberships, ({one}) => ({
	user: one(users, {
		fields: [memberships.userId],
		references: [users.id]
	}),
	plan: one(plans, {
		fields: [memberships.planCode],
		references: [plans.code]
	}),
}));

export const membershipPlanPeriodsRelations = relations(membershipPlanPeriods, ({one}) => ({
	user: one(users, {
		fields: [membershipPlanPeriods.userId],
		references: [users.id]
	}),
}));

export const recordingsRelations = relations(recordings, ({one}) => ({
	work: one(works, {
		fields: [recordings.workId],
		references: [works.id]
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

export const workAliasesRelations = relations(workAliases, ({one}) => ({
	work: one(works, {
		fields: [workAliases.workId],
		references: [works.id]
	}),
	user: one(users, {
		fields: [workAliases.createdBy],
		references: [users.id]
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

export const notificationPreferencesRelations = relations(notificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id]
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user_userId: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
		relationName: "userRoles_userId_users_id"
	}),
	user_grantedBy: one(users, {
		fields: [userRoles.grantedBy],
		references: [users.id],
		relationName: "userRoles_grantedBy_users_id"
	}),
}));
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  acceptWorkspaceInvite,
  createWorkspace,
  inviteWorkspaceMember,
  listUserWorkspaces,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from "@/server/services/workspaces";
import {
  createApiTokenForUser,
  deleteUserAccountCompletely,
  listApiTokensForUser,
  listUserAuditLogs,
  listUserSessions,
  revokeAllUserSessions,
  revokeApiTokenForUser,
} from "@/server/services/auth";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
} from "@/server/services/organization";
import {
  createWebhook,
  deleteWebhook,
  listUserWebhooks,
} from "@/server/services/webhooks";
import {
  createRssFeed,
  deleteRssFeed,
  listUserRssFeeds,
  syncRssFeed,
} from "@/server/services/feeds";

export async function GET() {
  try {
    const user = await requireCurrentUser("read");
    const [workspaces, apiTokens, automationRules, webhookInfo, rssFeeds, sessions, auditLogs] =
      await Promise.all([
        listUserWorkspaces(user.id),
        listApiTokensForUser(user.id),
        listAutomationRules(user.id),
        listUserWebhooks(user.id),
        listUserRssFeeds(user.id),
        listUserSessions(user.id),
        listUserAuditLogs(user.id),
      ]);
    return NextResponse.json({
      workspaces,
      apiTokens,
      automationRules,
      webhooks: webhookInfo.webhooks,
      webhookDeliveries: webhookInfo.recentDeliveries,
      rssFeeds,
      sessions,
      auditLogs,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();

    if (body.action === "createWorkspace") {
      const workspace = await createWorkspace({
        ownerId: user.id,
        name: body.name ?? "",
      });
      return NextResponse.json({ workspace }, { status: 201 });
    }

    if (body.action === "inviteMember") {
      const invite = await inviteWorkspaceMember({
        actorId: user.id,
        workspaceId: body.workspaceId ?? "",
        invitedEmail: body.invitedEmail ?? "",
        role: body.role ?? "member",
      });
      return NextResponse.json({ invite }, { status: 201 });
    }

    if (body.action === "acceptInvite") {
      const accepted = await acceptWorkspaceInvite({
        userId: user.id,
        inviteToken: body.inviteToken ?? "",
      });
      return NextResponse.json({ accepted });
    }

    if (body.action === "removeMember") {
      await removeWorkspaceMember({
        actorId: user.id,
        workspaceId: body.workspaceId ?? "",
        targetUserId: body.targetUserId ?? "",
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "transferOwnership") {
      await transferWorkspaceOwnership({
        currentOwnerId: user.id,
        workspaceId: body.workspaceId ?? "",
        newOwnerUserId: body.newOwnerUserId ?? "",
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createApiToken") {
      const token = await createApiTokenForUser(
        user.id,
        body.name ?? "Token API",
        body.scopes ?? ["read", "write"]
      );
      return NextResponse.json({ token }, { status: 201 });
    }

    if (body.action === "revokeApiToken") {
      await revokeApiTokenForUser(user.id, body.tokenId ?? "");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createAutomation" || body.action === "createAutomationRule") {
      const rule = await createAutomationRule({
        ownerId: user.id,
        name: body.name ?? "",
        conditions: body.conditions ?? {},
        actions: body.actions ?? {},
      });
      return NextResponse.json({ rule }, { status: 201 });
    }

    if (body.action === "deleteAutomation" || body.action === "deleteAutomationRule") {
      await deleteAutomationRule(user.id, body.ruleId ?? "");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createRssFeed") {
      const feed = await createRssFeed({
        ownerId: user.id,
        feedUrl: body.feedUrl ?? "",
        title: body.title,
        autoTags: body.autoTags,
        collectionId: body.collectionId,
      });
      return NextResponse.json({ feed }, { status: 201 });
    }

    if (body.action === "syncRssFeed") {
      const syncResult = await syncRssFeed(user.id, body.feedId ?? "");
      return NextResponse.json({ syncResult });
    }

    if (body.action === "deleteRssFeed") {
      await deleteRssFeed(user.id, body.feedId ?? "");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "createWebhook") {
      const webhook = await createWebhook({
        ownerId: user.id,
        name: body.name ?? "",
        targetUrl: body.targetUrl ?? "",
        events: body.events,
      });
      return NextResponse.json({ webhook }, { status: 201 });
    }

    if (body.action === "deleteWebhook") {
      await deleteWebhook(user.id, body.webhookId ?? "");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "revokeAllSessions") {
      await revokeAllUserSessions(user.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "deleteAccount") {
      const result = await deleteUserAccountCompletely({
        userId: user.id,
        passwordConfirmation: body.passwordConfirmation ?? "",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

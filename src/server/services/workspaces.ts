import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaces, workspaceMembers, auditLogs } from "@/db/schema";
import { generateId, generateSecureToken, sha256Hex } from "@/lib/security/crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export type WorkspaceRole = "owner" | "admin" | "member";

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export async function createWorkspace(input: {
  ownerId: string;
  name: string;
}): Promise<{ id: string; name: string; ownerId: string }> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new ValidationError("Nome do workspace deve ter pelo menos 2 caracteres.");
  }

  const db = await getDb();
  const id = generateId("ws");
  const now = new Date();

  await db.insert(workspaces).values({
    id,
    name,
    ownerId: input.ownerId,
    isPersonal: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceMembers).values({
    id: generateId("wsm"),
    workspaceId: id,
    userId: input.ownerId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return { id, name, ownerId: input.ownerId };
}

export async function getMemberRoleInWorkspace(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const db = await getDb();
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership) return null;
  return membership.role;
}

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = "member"
): Promise<WorkspaceRole> {
  const role = await getMemberRoleInWorkspace(userId, workspaceId);
  if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT[minRole]) {
    throw new ForbiddenError("Acesso negado ao workspace solicitado.");
  }
  return role;
}

export async function inviteWorkspaceMember(input: {
  actorId: string;
  workspaceId: string;
  invitedEmail: string;
  role: WorkspaceRole;
  expiresInMs?: number;
}): Promise<{ memberId: string; inviteToken: string; expiresAt: Date }> {
  const actorRole = await requireWorkspaceRole(input.actorId, input.workspaceId, "admin");

  if (ROLE_WEIGHT[input.role] > ROLE_WEIGHT[actorRole]) {
    throw new ForbiddenError(
      "Você não pode conceder um papel com permissões superiores às suas."
    );
  }

  const db = await getDb();
  const inviteToken = generateSecureToken(24);
  const inviteTokenHash = sha256Hex(inviteToken);
  const expiresAt = new Date(Date.now() + (input.expiresInMs ?? 1000 * 60 * 60 * 48));
  const memberId = generateId("wsm");

  await db.insert(workspaceMembers).values({
    id: memberId,
    workspaceId: input.workspaceId,
    invitedEmail: input.invitedEmail.trim().toLowerCase(),
    role: input.role,
    status: "invited",
    inviteTokenHash,
    inviteExpiresAt: expiresAt,
  });

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    action: "workspace.member_invited",
    targetType: "workspace_member",
    targetId: memberId,
    metadata: { role: input.role },
  });

  return { memberId, inviteToken, expiresAt };
}

export async function acceptWorkspaceInvite(input: {
  userId: string;
  inviteToken: string;
}): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const db = await getDb();
  const tokenHash = sha256Hex(input.inviteToken.trim());
  const now = new Date();

  const [invite] = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.inviteTokenHash, tokenHash))
    .limit(1);

  if (!invite || invite.status !== "invited") {
    throw new ValidationError("Convite inválido ou já utilizado.");
  }

  if (!invite.inviteExpiresAt || invite.inviteExpiresAt <= now) {
    await db
      .update(workspaceMembers)
      .set({ status: "expired", updatedAt: now })
      .where(eq(workspaceMembers.id, invite.id));
    throw new ValidationError("Este convite para o workspace expirou.");
  }

  await db
    .update(workspaceMembers)
    .set({
      userId: input.userId,
      status: "active",
      inviteTokenHash: null,
      updatedAt: now,
    })
    .where(eq(workspaceMembers.id, invite.id));

  return { workspaceId: invite.workspaceId, role: invite.role };
}

export async function removeWorkspaceMember(input: {
  actorId: string;
  workspaceId: string;
  targetUserId: string;
}): Promise<void> {
  await requireWorkspaceRole(input.actorId, input.workspaceId, "admin");
  const db = await getDb();

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  if (!ws) {
    throw new NotFoundError("Workspace não encontrado.");
  }

  if (ws.ownerId === input.targetUserId) {
    throw new ValidationError(
      "Não é possível remover o proprietário do workspace sem transferir a propriedade primeiro."
    );
  }

  await db
    .update(workspaceMembers)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId)
      )
    );
}

export async function transferWorkspaceOwnership(input: {
  currentOwnerId: string;
  workspaceId: string;
  newOwnerUserId: string;
}): Promise<void> {
  await requireWorkspaceRole(input.currentOwnerId, input.workspaceId, "owner");
  const targetRole = await getMemberRoleInWorkspace(input.newOwnerUserId, input.workspaceId);

  if (!targetRole) {
    throw new ValidationError(
      "O novo proprietário precisa ser um membro ativo do workspace."
    );
  }

  const db = await getDb();
  const now = new Date();

  await db
    .update(workspaces)
    .set({ ownerId: input.newOwnerUserId, updatedAt: now })
    .where(eq(workspaces.id, input.workspaceId));

  await db
    .update(workspaceMembers)
    .set({ role: "admin", updatedAt: now })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.currentOwnerId)
      )
    );

  await db
    .update(workspaceMembers)
    .set({ role: "owner", updatedAt: now })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.newOwnerUserId)
      )
    );

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: input.currentOwnerId,
    workspaceId: input.workspaceId,
    action: "workspace.ownership_transferred",
    targetType: "workspace",
    targetId: input.workspaceId,
    metadata: { newOwnerUserId: input.newOwnerUserId },
  });
}

export async function listUserWorkspaces(userId: string) {
  const db = await getDb();
  const memberships = await db
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isPersonal: workspaces.isPersonal,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active"))
    );

  return memberships;
}


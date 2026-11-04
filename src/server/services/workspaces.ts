import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  users,
  workspaces,
  workspaceMembers,
  auditLogs,
  items,
  collections,
  tags,
  assistantConversations,
} from "@/db/schema";
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

export interface WorkspaceMemberSummary {
  memberId: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  invitedEmail: string | null;
  role: WorkspaceRole;
  status: "invited" | "active" | "revoked" | "expired";
}

export async function listWorkspaceMembers(
  actorId: string,
  workspaceId: string
): Promise<WorkspaceMemberSummary[]> {
  await requireWorkspaceRole(actorId, workspaceId, "member");
  const db = await getDb();

  const rows = await db
    .select({
      memberId: workspaceMembers.id,
      userId: workspaceMembers.userId,
      displayName: users.displayName,
      email: users.email,
      invitedEmail: workspaceMembers.invitedEmail,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return rows.filter((r) => r.status === "active" || r.status === "invited");
}

export async function updateWorkspaceMemberRole(input: {
  actorId: string;
  workspaceId: string;
  targetUserId: string;
  role: "admin" | "member";
}): Promise<{ userId: string; role: WorkspaceRole }> {
  const actorRole = await requireWorkspaceRole(
    input.actorId,
    input.workspaceId,
    "admin"
  );
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
      "O papel do proprietário só pode ser alterado mediante transferência de propriedade."
    );
  }

  const targetRole = await getMemberRoleInWorkspace(
    input.targetUserId,
    input.workspaceId
  );
  if (!targetRole) {
    throw new NotFoundError("Membro ativo não encontrado neste workspace.");
  }

  if (actorRole !== "owner" && targetRole === "admin") {
    throw new ForbiddenError(
      "Apenas o proprietário do workspace pode alterar o papel de outro administrador."
    );
  }

  const now = new Date();
  await db
    .update(workspaceMembers)
    .set({ role: input.role, updatedAt: now })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
        eq(workspaceMembers.status, "active")
      )
    );

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: input.actorId,
    workspaceId: input.workspaceId,
    action: "workspace.member_role_updated",
    targetType: "workspace_member",
    targetId: input.targetUserId,
    metadata: { previousRole: targetRole, newRole: input.role },
  });

  return { userId: input.targetUserId, role: input.role };
}

export async function listUserWorkspaces(userId: string) {
  const db = await getDb();
  const memberships = await db
    .select({
      id: workspaces.id,
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

  if (memberships.length === 0) return [];

  const wsIds = memberships.map((m) => m.id);
  const allMembersRows = await db
    .select({
      memberId: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      displayName: users.displayName,
      email: users.email,
      invitedEmail: workspaceMembers.invitedEmail,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(workspaceMembers.userId, users.id))
    .where(inArray(workspaceMembers.workspaceId, wsIds));

  return memberships.map((ws) => ({
    ...ws,
    members: allMembersRows
      .filter(
        (m) =>
          m.workspaceId === ws.id &&
          (m.status === "active" || m.status === "invited")
      )
      .map((m) => ({
        memberId: m.memberId,
        userId: m.userId,
        displayName: m.displayName,
        email: m.email,
        invitedEmail: m.invitedEmail,
        role: m.role,
        status: m.status,
      })),
  }));
}

/**
 * Permite que um membro ou administrador saia voluntariamente de um workspace
 * preservando seus itens pessoais sem deixar o workspace órfão de proprietário.
 */
export async function leaveWorkspace(input: {
  userId: string;
  workspaceId: string;
  retainPersonalItems?: boolean;
}): Promise<{ retainedItemsCount: number }> {
  const role = await getMemberRoleInWorkspace(input.userId, input.workspaceId);
  if (!role) {
    throw new ForbiddenError("Você não é um membro ativo deste workspace.");
  }

  if (role === "owner") {
    throw new ValidationError(
      "O proprietário não pode sair do workspace sem antes transferir a propriedade ou excluir o workspace."
    );
  }

  const db = await getDb();
  const now = new Date();
  let retainedItemsCount = 0;

  if (input.retainPersonalItems !== false) {
    const authoredItems = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.workspaceId, input.workspaceId),
          eq(items.ownerId, input.userId)
        )
      );
    retainedItemsCount = authoredItems.length;

    if (retainedItemsCount > 0) {
      await db
        .update(items)
        .set({ workspaceId: null, updatedAt: now })
        .where(
          and(
            eq(items.workspaceId, input.workspaceId),
            eq(items.ownerId, input.userId)
          )
        );
    }
  }

  await db
    .update(workspaceMembers)
    .set({ status: "revoked", updatedAt: now })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId)
      )
    );

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: input.userId,
    workspaceId: input.workspaceId,
    action: "workspace.member_left",
    targetType: "workspace",
    targetId: input.workspaceId,
    metadata: { retainedItemsCount },
  });

  return { retainedItemsCount };
}

/**
 * Exclui um workspace colaborativo mediante confirmação do proprietário (`owner`),
 * aplicando política explícita de retenção dos dados (`retain_to_personal` por padrão).
 */
export async function deleteWorkspace(input: {
  ownerId: string;
  workspaceId: string;
  itemRetentionPolicy?: "retain_to_personal" | "delete_all";
}): Promise<{
  deletedWorkspaceId: string;
  retainedItemsCount: number;
  deletedItemsCount: number;
}> {
  await requireWorkspaceRole(input.ownerId, input.workspaceId, "owner");
  const db = await getDb();
  const policy = input.itemRetentionPolicy ?? "retain_to_personal";
  const now = new Date();

  const wsItems = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.workspaceId, input.workspaceId));

  let retainedItemsCount = 0;
  let deletedItemsCount = 0;

  if (policy === "retain_to_personal") {
    retainedItemsCount = wsItems.length;
    await db
      .update(items)
      .set({ workspaceId: null, updatedAt: now })
      .where(eq(items.workspaceId, input.workspaceId));
    await db
      .update(collections)
      .set({ workspaceId: null, updatedAt: now })
      .where(eq(collections.workspaceId, input.workspaceId));
    await db
      .update(tags)
      .set({ workspaceId: null })
      .where(eq(tags.workspaceId, input.workspaceId));
    await db
      .update(assistantConversations)
      .set({ workspaceId: null, updatedAt: now })
      .where(eq(assistantConversations.workspaceId, input.workspaceId));
  } else {
    deletedItemsCount = wsItems.length;
    await db.delete(items).where(eq(items.workspaceId, input.workspaceId));
    await db
      .delete(collections)
      .where(eq(collections.workspaceId, input.workspaceId));
    await db.delete(tags).where(eq(tags.workspaceId, input.workspaceId));
  }

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: input.ownerId,
    workspaceId: null,
    action: "workspace.deleted",
    targetType: "workspace",
    targetId: input.workspaceId,
    metadata: {
      policy,
      retainedItemsCount,
      deletedItemsCount,
    },
  });

  await db
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, input.workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, input.workspaceId));

  return {
    deletedWorkspaceId: input.workspaceId,
    retainedItemsCount,
    deletedItemsCount,
  };
}



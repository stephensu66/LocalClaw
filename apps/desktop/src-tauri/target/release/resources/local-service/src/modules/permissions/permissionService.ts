import type { PrismaClient } from '@prisma/client';
import type { PermissionGrantDTO, PermissionKey } from '@openclaw/shared';
import { SseHub } from '../../realtime/sse';

export class PermissionError extends Error {
  constructor(public denied: PermissionKey[]) {
    super(`Permission denied: ${denied.join(', ')}`);
  }
}

export class PermissionService {
  constructor(private prisma: PrismaClient, private sse: SseHub) {}

  private readonly allKeys: PermissionKey[] = [
    'FILE_READ',
    'FILE_WRITE',
    'SHELL_EXEC',
    'PYTHON_EXEC',
    'INTERNET_ACCESS',
    'BROWSER',
  ];

  async list(): Promise<PermissionGrantDTO[]> {
    let items = await this.prisma.permissionGrant.findMany();
    const existing = new Set(items.map((item) => item.key as PermissionKey));
    const missing = this.allKeys.filter((key) => !existing.has(key));
    if (missing.length > 0) {
      await this.prisma.permissionGrant.createMany({
        data: missing.map((key) => ({ key, granted: false })),
      });
      items = await this.prisma.permissionGrant.findMany();
    }
    return items.map((item) => ({
      key: item.key as PermissionKey,
      granted: item.granted,
      scope: item.scopeJson ? JSON.parse(item.scopeJson) : null,
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async set(
    key: PermissionKey,
    granted: boolean,
    scope?: Record<string, unknown> | null
  ): Promise<PermissionGrantDTO> {
    const updated = await this.prisma.permissionGrant.upsert({
      where: { key },
      update: { granted, scopeJson: scope ? JSON.stringify(scope) : null },
      create: { key, granted, scopeJson: scope ? JSON.stringify(scope) : null },
    });

    const dto: PermissionGrantDTO = {
      key,
      granted: updated.granted,
      scope: updated.scopeJson ? JSON.parse(updated.scopeJson) : null,
      updatedAt: updated.updatedAt.toISOString(),
    };

    this.sse.broadcast({ type: 'permission.updated', payload: dto });
    return dto;
  }

  async assert(required: PermissionKey[]): Promise<void> {
    if (!required || required.length === 0) return;

    const grants = await this.prisma.permissionGrant.findMany({
      where: { key: { in: required } },
    });

    const grantedSet = new Set(grants.filter((g) => g.granted).map((g) => g.key as PermissionKey));
    const denied = required.filter((k) => !grantedSet.has(k));

    if (denied.length > 0) {
      throw new PermissionError(denied);
    }
  }
}

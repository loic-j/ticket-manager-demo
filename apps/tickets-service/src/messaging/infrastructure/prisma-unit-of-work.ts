import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(work);
  }
}

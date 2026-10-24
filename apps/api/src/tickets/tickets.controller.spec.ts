import { Test } from '@nestjs/testing';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [TicketsService],
    }).compile();

    controller = moduleRef.get(TicketsController);
  });

  it('creates and lists tickets', () => {
    const created = controller.create({
      title: 'Broken keyboard',
      description: '',
      priority: 'high',
    });
    expect(created.status).toBe('open');
    expect(controller.findAll()).toContainEqual(created);
  });
});

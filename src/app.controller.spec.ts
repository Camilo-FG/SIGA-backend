import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports the service as healthy', () => {
      const health = appController.getHealth();

      expect(health.status).toBe('ok');
      expect(health.service).toBe('siga-backend');
      expect(Date.parse(health.timestamp)).not.toBeNaN();
    });
  });
});

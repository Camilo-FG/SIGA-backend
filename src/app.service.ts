import { Injectable } from '@nestjs/common';

export interface HealthCheck {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthCheck {
    return {
      status: 'ok',
      service: 'siga-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

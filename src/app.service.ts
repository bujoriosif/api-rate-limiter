import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  postLogin(userName: string, password: string) {
    return 'login successful!';
  }
}

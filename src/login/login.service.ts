import { Injectable } from '@nestjs/common';

@Injectable()
export class LoginService {
  postLogin(userName: string, password: string) {
    return 'login successful!';
  }
}

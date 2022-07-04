import { InjectionToken } from '@nestjs/common';

export const FTP_CONFIG: InjectionToken = Symbol('FTP_CONFIG');

export interface FtpConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

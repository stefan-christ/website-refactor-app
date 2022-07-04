import { InjectionToken } from '@nestjs/common';
import { AppConfig } from '../../app-config';
import { FtpConfig } from '../ftp/ftp-config';

export const CONFIGURATION: InjectionToken = Symbol('CONFIGURATION');

export interface Configuration {
    app?: AppConfig;
    ftp?: FtpConfig;
}

import { InjectionToken } from '@nestjs/common';

export const CLI_SETTINGS: InjectionToken = Symbol('CLI_SETTINGS');

export interface CliSettings {
    lineSep: string;
}

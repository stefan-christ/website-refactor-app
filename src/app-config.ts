import { InjectionToken } from '@nestjs/common';

export const APP_CONFIG: InjectionToken = Symbol('APP_CONFIG');

export interface AppConfig {
    wwwDir?: string;
    workingDir?: string;
    timestamp?: 'file' | 'folder';
    refactor?: {
        sourceFileTypes?: string[];
        replacementExclusionFileTypes?: string[];
    };
    tweaking?: {
        filenameCharacters?: string;
        validLeadSequences: string[];
        validTrailSequences: string[];
    };
    verboseLogging?: boolean;
}

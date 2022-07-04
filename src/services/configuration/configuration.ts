import { InjectionToken } from '@nestjs/common';
import { FtpConfig } from '../ftp/ftp-config';

export const CONFIG: InjectionToken = Symbol('CONFIG');

export interface Configuration {
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
    ftp?: FtpConfig;
    verboseLogging?: boolean;
}

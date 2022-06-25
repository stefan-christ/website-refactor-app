import { InjectionToken } from '@nestjs/common';

export const CONFIG: InjectionToken = Symbol('CONFIG');

export interface Configuration {
    wwwDir?: string;
    workingDir?: string;
    refactor?: {
        sourceFileTypes?: string[];
        replacementExclusionFileTypes?: string[];
    };
    tweaking?: {
        filenameCharacters?: string;
        validLeadSequences: string[];
        validTrailSequences: string[];
    };
    verboseLogging: boolean;
}

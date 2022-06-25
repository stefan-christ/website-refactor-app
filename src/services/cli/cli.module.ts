import { Module } from '@nestjs/common';

import { CliSettings, CLI_SETTINGS } from './cli-settings';
import { CliService } from './cli.service';

@Module({
    providers: [
        CliService,
        {
            provide: CLI_SETTINGS,
            useFactory: (): CliSettings => {
                return {
                    lineSep: '\n',
                };
            },
        },
    ],
    exports: [CliService],
})
export class CliModule {}

import { Module } from '@nestjs/common';

import { IoModule } from '../io/io.module';
import { IoService } from '../io/io.service';
import { CONFIGURATION, Configuration } from './configuration';

@Module({
    imports: [IoModule],
    providers: [
        {
            provide: CONFIGURATION,
            useFactory: async (io: IoService): Promise<Configuration> => {
                if (io.pathExists('../configuration.jsonc')) {
                    return io.readJsonFile<Configuration>(
                        '../configuration.jsonc',
                    );
                } else if (io.pathExists('../configuration.json')) {
                    return io.readJsonFile<Configuration>(
                        '../configuration.json',
                    );
                }
                throw new Error('no configuration file');
            },
            inject: [IoService],
        },
    ],
    exports: [CONFIGURATION],
})
export class ConfigurationModule {}

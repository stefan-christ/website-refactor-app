import { Module } from '@nestjs/common';

import { IoModule } from '../io/io.module';
import { IoService } from '../io/io.service';
import { CONFIG, Configuration } from './configuration';

@Module({
    imports: [IoModule],
    providers: [
        {
            provide: CONFIG,
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
    exports: [CONFIG],
})
export class ConfigurationModule {}

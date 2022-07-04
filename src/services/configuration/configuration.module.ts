import { Module } from '@nestjs/common';
import { AppConfig, APP_CONFIG } from '../../app-config';
import { FtpConfig, FTP_CONFIG } from '../ftp/ftp-config';

import { IoModule } from '../io/io.module';
import { IoService } from '../io/io.service';
import { CONFIGURATION, Configuration } from './configuration';

@Module({
    imports: [IoModule],
    providers: [
        {
            provide: CONFIGURATION,
            useFactory: async (io: IoService): Promise<Configuration> => {
                const jsonPath = io.join('..', 'configuration.json');
                const jsoncPath = io.join('..', 'configuration.jsonc');
                if (io.pathExists(jsoncPath)) {
                    return io.readJsonFile<Configuration>(jsoncPath);
                } else if (io.pathExists(jsonPath)) {
                    return io.readJsonFile<Configuration>(jsonPath);
                }
                throw new Error('no configuration file');
            },
            inject: [IoService],
        },

        {
            provide: APP_CONFIG,
            useFactory: (configuration: Configuration): AppConfig => {
                if (!configuration.app) {
                    throw new Error('no app config');
                }
                return configuration.app;
            },
            inject: [CONFIGURATION],
        },

        {
            provide: FTP_CONFIG,
            useFactory: (configuration: Configuration): FtpConfig => {
                if (!configuration.ftp) {
                    throw new Error('no ftp config');
                }
                return configuration.ftp;
            },
            inject: [CONFIGURATION],
        },
    ],
    exports: [APP_CONFIG, FTP_CONFIG],
})
export class ConfigurationModule {}

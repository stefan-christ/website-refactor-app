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
                let configuration: Configuration;
                if (io.pathExists(jsoncPath)) {
                    configuration = await io.readJsonFile<Configuration>(
                        jsoncPath,
                    );
                } else if (io.pathExists(jsonPath)) {
                    configuration = await io.readJsonFile<Configuration>(
                        jsonPath,
                    );
                }
                if (!configuration) {
                    throw new Error('Configuration file not found');
                }

                if (!configuration.app) {
                    throw new Error('App configuration not defined');
                }
                if (!io.pathExists(configuration.app.wwwDir)) {
                    throw new Error(
                        'WWW dir path of the app configuration could not be resolved',
                    );
                }
                if (!io.pathExists(configuration.app.workingDir)) {
                    throw new Error(
                        'Working dir path of the app configuration could not be resolved',
                    );
                }

                if (!configuration.ftp) {
                    throw new Error('FTP configuration not defined');
                }
                return configuration;
            },
            inject: [IoService],
        },
        {
            provide: APP_CONFIG,
            useFactory: (configuration: Configuration): AppConfig => {
                return configuration.app;
            },
            inject: [CONFIGURATION],
        },

        {
            provide: FTP_CONFIG,
            useFactory: (configuration: Configuration): FtpConfig => {
                return configuration.ftp;
            },
            inject: [CONFIGURATION],
        },
    ],
    exports: [APP_CONFIG, FTP_CONFIG],
})
export class ConfigurationModule {}

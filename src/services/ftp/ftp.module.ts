import { Module } from '@nestjs/common';

import { ConfigurationModule } from '../configuration/configuration.module';
import { FtpService } from './ftp.service';

@Module({
    imports: [ConfigurationModule],
    providers: [FtpService],
    exports: [FtpService],
})
export class FtpModule {}

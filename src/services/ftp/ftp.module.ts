import { Module } from '@nestjs/common';

import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { IoModule } from '../io/io.module';
import { FtpService } from './ftp.service';

@Module({
    imports: [ConfigurationModule, CliModule, IoModule],
    providers: [FtpService],
    exports: [FtpService],
})
export class FtpModule {}

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FileProviderModule } from '../file-provider/file-provider.module';
import { IoModule } from '../io/io.module';

import { ReportService } from './report.service';

@Module({
    imports: [ConfigurationModule, IoModule, FileProviderModule],
    providers: [ReportService],
    exports: [ReportService],
})
export class ReportModule {}

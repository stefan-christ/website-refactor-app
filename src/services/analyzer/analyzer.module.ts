import { Module } from '@nestjs/common';

import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { IoModule } from '../io/io.module';
import { AnalyzerService } from './analyzer.service';

@Module({
    imports: [ConfigurationModule, IoModule, CliModule],
    providers: [AnalyzerService],
    exports: [AnalyzerService],
})
export class AnalyzerModule {}

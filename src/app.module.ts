import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzerModule } from './services/analyzer/analyzer.module';
import { CliModule } from './services/cli/cli.module';
import { ConfigurationModule } from './services/configuration/configuration.module';
import { FileProviderModule } from './services/file-provider/file-provider.module';
import { IoModule } from './services/io/io.module';
import { RefactorModule } from './services/refactor/refactor.module';

@Module({
    imports: [
        IoModule,
        CliModule,
        ConfigurationModule,
        AnalyzerModule,
        RefactorModule,
        FileProviderModule,
    ],
    providers: [AppService],
})
export class AppModule {}
